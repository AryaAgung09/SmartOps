"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function LeavesPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN" || role === "HR";
  const currentUserId = Number(session?.user?.id);

  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [lRes, bRes] = await Promise.all([
        fetch("/api/leaves"),
        fetch("/api/leave-balances"),
      ]);
      const l = await lRes.json();
      const b = await bRes.json();
      if (l.success) setLeaves(l.data || []);
      if (b.success) setBalances(b.data || []);
    } catch (e) {
      setMessage("Gagal memuat data cuti");
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function approve(id) {
    try {
      const res = await fetch(`/api/leaves/${id}/approve`, { method: "POST" });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Gagal menyetujui");
      setMessage("Cuti disetujui");
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function reject(id) {
    try {
      const res = await fetch(`/api/leaves/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Gagal menolak");
      setMessage("Cuti ditolak");
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function cancel(id) {
    try {
      const res = await fetch(`/api/leaves/${id}/cancel`, { method: "POST" });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Gagal membatalkan");
      setMessage("Cuti dibatalkan");
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Leave & Time-Off</h1>
          <p>Pengajuan dan persetujuan cuti</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link href="/leaves/create" className="btn">Ajukan Cuti</Link>
        </div>
      </div>

      {message && <p>{message}</p>}

      <section>
        <h2>Saldo Cuti</h2>
        <table>
          <thead>
            <tr><th>Jenis Cuti</th><th>Alokasi</th><th>Adjustment</th><th>Digunakan</th><th>Pending</th><th>Tersedia</th></tr>
          </thead>
          <tbody>
            {balances.map((b) => {
              const available = (b.allocatedDays + b.adjustmentDays) - b.usedDays - b.pendingDays;
              return (
                <tr key={b.id}>
                  <td>{b.leaveType?.name}</td>
                  <td>{b.allocatedDays}</td>
                  <td>{b.adjustmentDays}</td>
                  <td>{b.usedDays}</td>
                  <td>{b.pendingDays}</td>
                  <td>{available}</td>
                </tr>
              );
            })}
            {balances.length === 0 && <tr><td colSpan={6}>Belum ada saldo</td></tr>}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: "24px" }}>
        <h2>Pengajuan Cuti</h2>
        <table>
          <thead>
            <tr><th>{isAdmin ? "Karyawan" : ""}</th><th>Jenis</th><th>Periode</th><th>Hari</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {leaves.map((l) => {
              const isOwner = Number(l.userId) === currentUserId || Number(l.user?.id) === currentUserId;
              const canApproveReject = l.status === "PENDING" && !isOwner && isAdmin;
              const canCancel = l.status === "PENDING" && isOwner;
              return (
                <tr key={l.id}>
                  {isAdmin && <td>{l.user?.name}</td>}
                  <td>{l.leaveType?.name}</td>
                  <td>{new Date(l.startDate).toLocaleDateString("id-ID")} - {new Date(l.endDate).toLocaleDateString("id-ID")}</td>
                  <td>{l.totalDays}</td>
                  <td><span className={`ui-status ${String(l.status || "").toLowerCase()}`}>{l.status}</span></td>
                  <td style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {canApproveReject && (
                      <>
                        <button onClick={() => approve(l.id)}>Setujui</button>
                        <button onClick={() => reject(l.id)}>Tolak</button>
                      </>
                    )}
                    {canCancel && <button onClick={() => cancel(l.id)}>Batalkan</button>}
                  </td>
                </tr>
              );
            })}
            {leaves.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5}>Tidak ada data</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
