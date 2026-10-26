"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateLeavePage() {
  const router = useRouter();
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
  const [message, setMessage] = useState("");
  const [typesError, setTypesError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/leave-types");
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.message || "Gagal mengambil jenis cuti");
        setTypes(result.data || []);
        if (!result.data?.length) setTypesError("Belum ada jenis cuti aktif yang tersedia.");
      } catch (e) {
        setTypesError(e.message || "Gagal mengambil jenis cuti");
      }
    }
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Gagal mengajukan cuti");
      setMessage("Pengajuan cuti terkirim");
      setTimeout(() => router.push("/leaves"), 800);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="leave-create-page">
      <div className="page-header leave-create-header">
        <div>
          <span className="module-eyebrow">LEAVE & TIME-OFF</span>
          <h1>Ajukan Cuti</h1>
          <p>Rencanakan waktu istirahat dan kirim pengajuan untuk ditinjau.</p>
        </div>
        <div className="leave-header-badge"><span>WORKFLOW</span><strong>Submit - Review</strong></div>
      </div>

      <section className="leave-create-card">
        <div className="leave-form-heading">
          <div><h2>Informasi Pengajuan</h2><p>Lengkapi detail cuti dengan tanggal dan alasan yang jelas.</p></div>
          <span className="leave-required-note">* Wajib diisi</span>
        </div>

        {message && <div className={`leave-form-alert ${message.includes("terkirim") ? "success" : "error"}`} role="alert">{message}</div>}

        <form onSubmit={submit}>
          <div className="leave-form-grid">
            <label>Jenis Cuti <span>*</span>
              <select value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })} required disabled={!types.length || loading}>
                <option value="">{typesError || "Pilih jenis cuti"}</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <small>{typesError || "Pilih jenis cuti sesuai kebutuhan Anda."}</small>
            </label>
          </div>

          <div className="leave-date-section">
            <div className="leave-subsection-heading"><h3>Periode Cuti</h3><span>Tentukan rentang tanggal pengajuan</span></div>
            <div className="leave-form-grid leave-date-grid">
              <label>Tanggal Mulai <span>*</span><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required disabled={loading} /><small>Hari pertama cuti.</small></label>
              <label>Tanggal Selesai <span>*</span><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required disabled={loading} /><small>Hari terakhir cuti.</small></label>
            </div>
          </div>

          <label className="leave-reason-field">Alasan Pengajuan
            <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Jelaskan alasan atau kebutuhan cuti Anda..." rows={6} disabled={loading} />
            <small>Tambahkan konteks agar pengajuan lebih mudah diproses oleh approver.</small>
          </label>

          <div className="leave-form-footer"><div className="leave-policy-note"><span>i</span><p>Pengajuan akan masuk ke proses review setelah dikirim. Status dapat dipantau dari halaman Leave.</p></div><div className="form-actions"><button type="button" className="button-secondary" onClick={() => router.push("/leaves")} disabled={loading}>Batal</button><button type="submit" className="button-primary" disabled={loading || !types.length}>{loading ? "Mengirim..." : "Ajukan Cuti"}</button></div></div>
        </form>
      </section>
    </main>
  );
}

