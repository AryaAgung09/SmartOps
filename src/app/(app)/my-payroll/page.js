"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const statusLabels = {
  DRAFT: "Draft",
  CALCULATED: "Dihitung",
  FINALIZED: "Final",
  PAID: "Dibayar",
  CANCELLED: "Dibatalkan",
};

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

function payrollYear(payroll) {
  const value = payroll.payrollPeriod?.periodStart || payroll.createdAt;
  return value ? new Date(value).getFullYear() : null;
}

export default function MyPayrollPage() {
  const [payrolls, setPayrolls] = useState([]);
  const [selectedYear, setSelectedYear] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/payroll", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Gagal memuat data payroll");
        }
        if (!cancelled) setPayrolls(Array.isArray(result.data) ? result.data : []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Gagal memuat data payroll");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const years = useMemo(
    () =>
      Array.from(new Set(payrolls.map(payrollYear).filter((year) => Number.isInteger(year)))).sort(
        (left, right) => right - left
      ),
    [payrolls]
  );

  const filteredPayrolls = useMemo(
    () =>
      selectedYear === "all"
        ? payrolls
        : payrolls.filter((payroll) => String(payrollYear(payroll)) === selectedYear),
    [payrolls, selectedYear]
  );

  const latestPayroll = filteredPayrolls[0];
  const paidCount = filteredPayrolls.filter((payroll) => payroll.status === "PAID").length;
  const latestPeriod = latestPayroll?.payrollPeriod?.name || "-";

  return (
    <main className="payslip-list-page">
      <header className="payslip-list-hero">
        <div>
          <span className="payslip-list-eyebrow">EMPLOYEE PAYROLL</span>
          <h1>My Payroll</h1>
          <p>Riwayat penggajian dan slip gaji pribadi Anda.</p>
        </div>
        <div className="payslip-list-hero-meta">
          <span>Total slip</span>
          <strong>{payrolls.length}</strong>
        </div>
      </header>

      {error && <div className="payslip-list-error" role="alert">{error}</div>}

      <section className="payslip-list-stats" aria-label="Payroll summary">
        <article className="payslip-list-stat">
          <span>Total Slip</span>
          <strong>{loading ? "-" : filteredPayrolls.length}</strong>
          <small>Payroll dalam filter aktif</small>
        </article>
        <article className="payslip-list-stat payslip-list-stat-blue">
          <span>Net Terbaru</span>
          <strong>{loading ? "-" : latestPayroll ? formatMoney(latestPayroll.netSalary) : "-"}</strong>
          <small>{latestPayroll?.payrollPeriod?.name || "Belum ada payroll"}</small>
        </article>
        <article className="payslip-list-stat payslip-list-stat-green">
          <span>Sudah Dibayar</span>
          <strong>{loading ? "-" : paidCount}</strong>
          <small>Slip berstatus paid</small>
        </article>
        <article className="payslip-list-stat payslip-list-stat-amber">
          <span>Periode Terbaru</span>
          <strong>{loading ? "-" : latestPeriod}</strong>
          <small>Periode payroll terakhir</small>
        </article>
      </section>

      <section className="payslip-list-card">
        <div className="payslip-list-card-head">
          <div>
            <h2>Riwayat Payroll</h2>
            <p>Pilih periode untuk membuka rincian slip gaji.</p>
          </div>
          <label className="payslip-year-filter">
            <span>Tahun</span>
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              <option value="all">Semua tahun</option>
              {years.map((year) => (
                <option value={year} key={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="payslip-list-loading">
            <span />
            <span />
            <span />
          </div>
        ) : filteredPayrolls.length ? (
          <div className="payslip-table-wrap">
            <table className="payslip-table">
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Tanggal Bayar</th>
                  <th>Gross</th>
                  <th>Potongan</th>
                  <th>Net</th>
                  <th>Status</th>
                  <th aria-label="Aksi" />
                </tr>
              </thead>
              <tbody>
                {filteredPayrolls.map((payroll) => (
                  <tr key={payroll.id}>
                    <td>
                      <div className="payslip-period-cell">
                        <strong>{payroll.payrollPeriod?.name || "-"}</strong>
                        <small>
                          {formatDate(payroll.payrollPeriod?.periodStart)} - {formatDate(payroll.payrollPeriod?.periodEnd)}
                        </small>
                      </div>
                    </td>
                    <td>{formatDate(payroll.payrollPeriod?.payDate)}</td>
                    <td>{formatMoney(payroll.grossSalary)}</td>
                    <td className="payslip-deduction-cell">-{formatMoney(payroll.totalDeduction)}</td>
                    <td><strong>{formatMoney(payroll.netSalary)}</strong></td>
                    <td>
                      <span className={`ui-status ${String(payroll.status || "").toLowerCase()}`}>
                        {statusLabels[payroll.status] || payroll.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/my-payroll/${payroll.id}`} className="payslip-row-action">
                        Lihat slip
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="payslip-list-empty">
            <strong>Belum ada slip gaji</strong>
            <span>
              {selectedYear === "all"
                ? "Slip gaji akan muncul setelah payroll diproses oleh HR."
                : `Tidak ada payroll pada tahun ${selectedYear}.`}
            </span>
          </div>
        )}
      </section>
    </main>
  );
}
