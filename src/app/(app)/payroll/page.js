"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const UMK_BATAM_2026 = 5357982;

const statusLabels = {
  DRAFT: "Draft",
  CALCULATED: "Dihitung",
  FINALIZED: "Final",
  PAID: "Dibayar",
  CANCELLED: "Dibatalkan",
};

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatMoney(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export default function PayrollPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "HR";

  const [periods, setPeriods] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [periodId, setPeriodId] = useState(() => searchParams.get("periodId") || "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const [periodsResponse, payrollResponse] = await Promise.all([
          fetch("/api/payroll/periods", { cache: "no-store" }),
          fetch(periodId ? `/api/payroll?payrollPeriodId=${periodId}` : "/api/payroll", { cache: "no-store" }),
        ]);
        const periodsResult = await periodsResponse.json();
        const payrollResult = await payrollResponse.json();
        if (!periodsResponse.ok || !periodsResult.success) {
          throw new Error(periodsResult.message || "Gagal memuat periode payroll");
        }
        if (!payrollResponse.ok || !payrollResult.success) {
          throw new Error(payrollResult.message || "Gagal memuat payroll");
        }
        setPeriods(periodsResult.data || []);
        setPayrolls(payrollResult.data || []);
      } else {
        const payrollResponse = await fetch("/api/payroll", { cache: "no-store" });
        const payrollResult = await payrollResponse.json();
        if (!payrollResponse.ok || !payrollResult.success) {
          throw new Error(payrollResult.message || "Gagal memuat payroll");
        }
        setPayrolls(payrollResult.data || []);
      }
    } catch (error) {
      setMessage(error.message || "Gagal memuat payroll");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, periodId]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function updatePayroll(id, action, successMessage) {
    setBusyId(String(id));
    setMessage("");
    try {
      const response = await fetch(`/api/payroll/${id}/${action}`, { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal memperbarui payroll");
      setMessage(successMessage);
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId("");
    }
  }

  async function generateAll() {
    if (!periodId) {
      setMessage("Pilih periode payroll terlebih dahulu");
      return;
    }

    setGenerating(true);
    setMessage("");
    try {
      const response = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payrollPeriodId: periodId, generateAll: true }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal membuat payroll");
      setMessage(result.message || "Payroll berhasil dibuat");
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setGenerating(false);
    }
  }

  const selectedPeriod = periods.find((period) => String(period.id) === String(periodId));
  const columnCount = isAdmin ? 9 : 8;

  return (
    <main className="payroll-page">
      <header className="module-page-header">
        <div>
          <span className="module-eyebrow">COMPENSATION</span>
          <h1>Payroll</h1>
          <p>Penggajian karyawan, basic salary, tunjangan, potongan, dan status pembayaran.</p>
        </div>
        <div className="module-page-actions">
          <span className="payroll-umk-chip">UMK Batam 2026 &middot; {formatMoney(UMK_BATAM_2026)}</span>
          {isAdmin && (
            <Link href="/payroll/periods" className="button-primary">
              Kelola Periode
            </Link>
          )}
          <Link href="/my-payroll" className="button-secondary">
            My Payroll
          </Link>
        </div>
      </header>

      {message && <div className="payroll-message">{message}</div>}

      <section className="emp-card payroll-card">
        <div className="module-section-head">
          <div>
            <h2>Penggajian Karyawan</h2>
            <p>
              {loading
                ? "Memuat data payroll..."
                : `${payrolls.length} payroll ${periodId ? "pada periode terpilih" : "ditampilkan"}.`}
            </p>
          </div>
          <span className="module-chip">
            {periodId ? selectedPeriod?.name || "Periode terpilih" : "Semua periode"}
          </span>
        </div>

        {isAdmin && (
          <div className="payroll-toolbar">
            <label className="payroll-period-filter">
              <span>Periode payroll</span>
              <select value={periodId} onChange={(event) => setPeriodId(event.target.value)}>
                <option value="">Semua periode</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({statusLabels[period.status] || period.status})
                  </option>
                ))}
              </select>
            </label>
            <div className="payroll-toolbar-actions">
              <span className="payroll-toolbar-note">
                Basic default UMK Batam 2026. Absen, half day, dan cuti tanpa gaji dipotong otomatis; cuti berbayar dan libur nasional tidak dipotong. Lembur setelah 17:00 dibayar otomatis 1,5x upah per jam.
              </span>
              <button
                type="button"
                className="button-primary"
                onClick={generateAll}
                disabled={!periodId || generating}
              >
                {generating ? "Memproses payroll..." : "Generate / Hitung Ulang"}
              </button>
            </div>
          </div>
        )}

        <div className="emp-table-wrap payroll-table-wrap">
          <table className="emp-table payroll-table">
            <thead>
              <tr>
                {isAdmin && <th>Karyawan</th>}
                <th>Periode</th>
                <th>Basic</th>
                <th>Allowance</th>
                <th>Deduction</th>
                <th>Gross</th>
                <th>Net</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columnCount}>
                    <div className="payroll-loading">Memuat data payroll...</div>
                  </td>
                </tr>
              ) : (
                payrolls.map((payroll) => {
                  const status = String(payroll.status || "").toLowerCase();
                  return (
                    <tr key={payroll.id}>
                      {isAdmin && (
                        <td>
                          <div className="emp-person">
                            <span className="emp-avatar emp-avatar-active">{initials(payroll.user?.name)}</span>
                            <div>
                              <strong>{payroll.user?.name || "-"}</strong>
                              <small>{payroll.user?.employeeId || payroll.user?.email || "Employee"}</small>
                            </div>
                          </div>
                        </td>
                      )}
                      <td>
                        <div className="payroll-period-cell">
                          <strong>{payroll.payrollPeriod?.name || "-"}</strong>
                          <small>
                            {formatDate(payroll.payrollPeriod?.periodStart)} - {formatDate(payroll.payrollPeriod?.periodEnd)}
                          </small>
                        </div>
                      </td>
                      <td>{formatMoney(payroll.basicSalary)}</td>
                      <td>{formatMoney(payroll.totalAllowance)}</td>
                      <td className="payroll-deduction">{formatMoney(payroll.totalDeduction)}</td>
                      <td>{formatMoney(payroll.grossSalary)}</td>
                      <td className="payroll-net">{formatMoney(payroll.netSalary)}</td>
                      <td>
                        <span className={`ui-status ${status}`}>
                          {statusLabels[payroll.status] || payroll.status}
                        </span>
                      </td>
                      <td>
                        <div className="emp-row-actions payroll-row-actions">
                          {isAdmin && payroll.status === "DRAFT" && (
                            <button
                              type="button"
                              className="payroll-mini-button"
                              onClick={() => updatePayroll(payroll.id, "finalize", "Payroll difinalisasi")}
                              disabled={busyId === String(payroll.id)}
                            >
                              Finalisasi
                            </button>
                          )}
                          {isAdmin && payroll.status === "FINALIZED" && (
                            <button
                              type="button"
                              className="payroll-mini-button payroll-mini-button-green"
                              onClick={() => updatePayroll(payroll.id, "pay", "Payroll lunas dan tercatat di Finance")}
                              disabled={busyId === String(payroll.id)}
                            >
                              Tandai Lunas
                            </button>
                          )}
                          {isAdmin && payroll.expense && (
                            <Link href={`/finance/expenses/${payroll.expense.id}`} className="emp-action">
                              Finance
                            </Link>
                          )}
                          <Link href={`/payroll/${payroll.id}`} className="emp-action">
                            Detail
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {!loading && payrolls.length === 0 && (
                <tr>
                  <td colSpan={columnCount}>
                    <div className="table-empty payroll-empty">
                      <strong>
                        {periodId ? "Belum ada payroll pada periode ini" : "Belum ada data payroll"}
                      </strong>
                      <span>
                        {isAdmin && periodId
                          ? "Klik Generate Payroll untuk membuat slip seluruh karyawan aktif dengan basic salary UMK Batam 2026."
                          : "Payroll akan tampil setelah diproses oleh HR."}
                      </span>
                      {isAdmin && periodId && (
                        <button
                          type="button"
                          className="button-primary payroll-empty-button"
                          onClick={generateAll}
                          disabled={generating}
                        >
                          {generating ? "Membuat payroll..." : "Generate Payroll Karyawan"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
