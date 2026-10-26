"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const emptyForm = { name: "", periodStart: "", periodEnd: "", payDate: "" };
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

function getPeriodDays(start, end) {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(diff) || diff < 0) return 0;
  return Math.round(diff / (24 * 60 * 60 * 1000)) + 1;
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
      <path d="M8 14h2M14 14h2M8 17h2" />
    </svg>
  );
}

export default function PayrollPeriodsPage() {
  const router = useRouter();
  const [periods, setPeriods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [generation, setGeneration] = useState({ payrollPeriodId: "", userId: "" });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingPeriodId, setGeneratingPeriodId] = useState("");
  const [notice, setNotice] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [periodsRes, employeesRes] = await Promise.all([
        fetch("/api/payroll/periods", { cache: "no-store" }),
        fetch("/api/employees?limit=100&employmentStatus=ACTIVE", { cache: "no-store" }),
      ]);
      const periodsResult = await periodsRes.json();
      const employeesResult = await employeesRes.json();
      if (!periodsRes.ok || !periodsResult.success) {
        throw new Error(periodsResult.message || "Gagal memuat periode");
      }
      setPeriods(periodsResult.data || []);
      setEmployees(employeesResult.success ? employeesResult.data || [] : []);
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Gagal memuat periode payroll" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, []);

  async function createPeriod(event) {
    event.preventDefault();
    setNotice(null);

    if (form.periodStart && form.periodEnd && form.periodStart > form.periodEnd) {
      setNotice({ type: "error", text: "Tanggal selesai harus sama atau setelah tanggal mulai." });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/payroll/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal membuat periode");
      setForm(emptyForm);
      setNotice({ type: "success", text: "Periode payroll berhasil dibuat." });
      await load();
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Gagal membuat periode" });
    } finally {
      setCreating(false);
    }
  }

  async function generatePayroll(event) {
    event.preventDefault();
    setNotice(null);
    setGenerating(true);
    try {
      const response = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payrollPeriodId: generation.payrollPeriodId,
          ...(generation.userId === "all" ? { generateAll: true } : { userId: generation.userId }),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal membuat payroll");
      setNotice({ type: "success", text: result.message || "Payroll berhasil diproses." });
      await load();
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Gagal membuat payroll" });
    } finally {
      setGenerating(false);
    }
  }

  async function openPayroll(period) {
    setGeneratingPeriodId(String(period.id));
    setNotice(null);
    try {
      if (period.status === "DRAFT") {
        const response = await fetch("/api/payroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payrollPeriodId: period.id, generateAll: true }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Gagal membuat payroll");
      }
      router.push(`/payroll?periodId=${period.id}`);
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Gagal membuka payroll" });
    } finally {
      setGeneratingPeriodId("");
    }
  }

  const draftPeriods = periods.filter((period) => period.status === "DRAFT");
  const finalizedPeriods = periods.filter((period) => period.status === "FINALIZED");
  const paidPeriods = periods.filter((period) => period.status === "PAID");
  const totalPayrolls = periods.reduce((sum, period) => sum + Number(period._count?.payrolls || 0), 0);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPeriods = periods.filter((period) => {
    const matchesStatus = !statusFilter || period.status === statusFilter;
    const matchesQuery =
      !normalizedQuery ||
      String(period.name || "").toLowerCase().includes(normalizedQuery) ||
      formatDate(period.periodStart).toLowerCase().includes(normalizedQuery) ||
      formatDate(period.periodEnd).toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
  const hasFilters = Boolean(normalizedQuery || statusFilter);

  return (
    <main className="payroll-periods-page payroll-page">
      <header className="module-page-header">
        <div>
          <span className="module-eyebrow">PAYROLL OPERATIONS</span>
          <h1>Periode Payroll</h1>
          <p>Kelola siklus penggajian, siapkan payroll karyawan, dan pantau status pembayaran dalam satu tempat.</p>
        </div>
        <div className="module-page-actions">
          <span className="payroll-umk-chip">UMK Batam 2026 &middot; {formatMoney(UMK_BATAM_2026)}</span>
          <Link href="/payroll" className="button-secondary">
            Kembali ke Payroll
          </Link>
        </div>
      </header>

      {notice && (
        <div className={`periods-notice ${notice.type}`} role="status" aria-live="polite">
          <span className="periods-notice-dot" />
          {notice.text}
        </div>
      )}

      <section className="emp-stat-grid periods-stat-grid" aria-label="Ringkasan periode payroll">
        <article className="emp-stat">
          <span>Total periode</span>
          <strong>{periods.length}</strong>
          <small>{totalPayrolls} payroll tergenerate</small>
        </article>
        <article className="emp-stat emp-stat-amber">
          <span>Draft</span>
          <strong>{draftPeriods.length}</strong>
          <small>Siap dihitung atau diproses</small>
        </article>
        <article className="emp-stat emp-stat-slate">
          <span>Final</span>
          <strong>{finalizedPeriods.length}</strong>
          <small>Menunggu pembayaran</small>
        </article>
        <article className="emp-stat emp-stat-green">
          <span>Dibayar</span>
          <strong>{paidPeriods.length}</strong>
          <small>Periode pembayaran selesai</small>
        </article>
      </section>

      <section className="periods-workspace">
        <article id="buat-periode" className="emp-card periods-form-card">
          <div className="module-section-head">
            <div>
              <h2>Buat Periode</h2>
              <p>Tentukan rentang tanggal dan tanggal pembayaran untuk siklus gaji baru.</p>
            </div>
            <span className="module-chip">1 siklus gaji</span>
          </div>

          <form className="periods-form" onSubmit={createPeriod}>
            <label className="periods-field periods-field-full">
              <span>Nama periode</span>
              <input
                placeholder="Contoh: Payroll Oktober 2026"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </label>
            <label className="periods-field">
              <span>Tanggal mulai</span>
              <input
                type="date"
                value={form.periodStart}
                onChange={(event) => setForm({ ...form, periodStart: event.target.value })}
                required
              />
            </label>
            <label className="periods-field">
              <span>Tanggal selesai</span>
              <input
                type="date"
                value={form.periodEnd}
                onChange={(event) => setForm({ ...form, periodEnd: event.target.value })}
                required
              />
            </label>
            <label className="periods-field periods-field-full">
              <span>Tanggal bayar</span>
              <input
                type="date"
                value={form.payDate}
                onChange={(event) => setForm({ ...form, payDate: event.target.value })}
              />
              <small>Opsional, dapat ditentukan setelah periode dibuat.</small>
            </label>
            <div className="periods-form-footer">
              <p>Gunakan rentang tanggal yang tidak tumpang tindih dengan periode lain.</p>
              <button type="submit" className="button-primary" disabled={creating}>
                {creating ? "Menyimpan..." : "Buat Periode"}
              </button>
            </div>
          </form>
        </article>

        <article className="emp-card periods-form-card">
          <div className="module-section-head">
            <div>
              <h2>Generate Payroll</h2>
              <p>Proses payroll seluruh karyawan aktif atau satu karyawan pada periode draft.</p>
            </div>
            <span className="module-chip">{draftPeriods.length} draft</span>
          </div>

          <form className="periods-form" onSubmit={generatePayroll}>
            <label className="periods-field periods-field-full">
              <span>Periode payroll</span>
              <select
                value={generation.payrollPeriodId}
                onChange={(event) => setGeneration({ ...generation, payrollPeriodId: event.target.value })}
                required
              >
                <option value="">Pilih periode draft</option>
                {draftPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({formatDate(period.periodStart)} - {formatDate(period.periodEnd)})
                  </option>
                ))}
              </select>
              {!draftPeriods.length && <small>Belum ada periode draft yang dapat diproses.</small>}
            </label>
            <label className="periods-field periods-field-full">
              <span>Karyawan</span>
              <select
                value={generation.userId}
                onChange={(event) => setGeneration({ ...generation, userId: event.target.value })}
                required
              >
                <option value="">Pilih karyawan</option>
                <option value="all">Semua karyawan aktif ({employees.length})</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} ({employee.employeeId || employee.email})
                  </option>
                ))}
              </select>
            </label>
            <div className="periods-info-panel">
              <div className="periods-info-row">
                <span className="periods-info-icon">Rp</span>
                <div>
                  <strong>Basic salary default</strong>
                  <small>UMK Batam 2026 sebesar {formatMoney(UMK_BATAM_2026)} jika salary structure belum tersedia.</small>
                </div>
              </div>
              <div className="periods-info-row">
                <span className="periods-info-icon periods-info-icon-blue">%</span>
                <div>
                  <strong>Potongan otomatis</strong>
                  <small>Absen, half day, dan cuti tanpa gaji dihitung dari basic salary per hari kerja.</small>
                </div>
              </div>
            </div>
            <div className="periods-form-footer">
              <p>Payroll yang sudah ada dan masih draft akan dihitung ulang.</p>
              <button type="submit" className="button-primary" disabled={!draftPeriods.length || generating}>
                {generating ? "Memproses..." : "Generate Payroll"}
              </button>
            </div>
          </form>
        </article>
      </section>

      <section className="emp-card periods-list-card">
        <div className="module-section-head">
          <div>
            <h2>Daftar Periode</h2>
            <p>
              {loading
                ? "Memuat periode payroll..."
                : `${filteredPeriods.length} dari ${periods.length} periode ditampilkan.`}
            </p>
          </div>
          <span className="module-chip">{totalPayrolls} payroll</span>
        </div>

        <div className="periods-list-toolbar">
          <label className="periods-search">
            <span>Cari periode</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nama atau tanggal periode"
            />
          </label>
          <label className="periods-status-filter">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Semua status</option>
              <option value="DRAFT">Draft</option>
              <option value="CALCULATED">Dihitung</option>
              <option value="FINALIZED">Final</option>
              <option value="PAID">Dibayar</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </label>
        </div>

        <div className="emp-table-wrap">
          <table className="emp-table periods-table">
            <thead>
              <tr>
                <th>Periode</th>
                <th>Rentang</th>
                <th>Tanggal Bayar</th>
                <th>Payroll</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <div className="periods-loading">Memuat periode payroll...</div>
                  </td>
                </tr>
              ) : (
                filteredPeriods.map((period) => (
                  <tr key={period.id}>
                    <td>
                      <div className="periods-name-cell">
                        <span className="periods-icon">
                          <CalendarIcon />
                        </span>
                        <div>
                          <strong>{period.name}</strong>
                          <small>PRD-{String(period.id).padStart(4, "0")}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="periods-date-cell">
                        <strong>{formatDate(period.periodStart)}</strong>
                        <small>
                          s.d. {formatDate(period.periodEnd)} &middot; {getPeriodDays(period.periodStart, period.periodEnd)} hari
                        </small>
                      </div>
                    </td>
                    <td>{formatDate(period.payDate)}</td>
                    <td>
                      <span className="periods-count">{Number(period._count?.payrolls || 0)} payroll</span>
                    </td>
                    <td>
                      <span className={`ui-status ${String(period.status).toLowerCase()}`}>
                        {statusLabels[period.status] || period.status}
                      </span>
                    </td>
                    <td>
                      <div className="emp-row-actions periods-row-actions">
                        {period.status === "DRAFT" ? (
                          <button
                            type="button"
                            className="payroll-mini-button"
                            onClick={() => openPayroll(period)}
                            disabled={generatingPeriodId === String(period.id)}
                          >
                            {generatingPeriodId === String(period.id) ? "Menyiapkan..." : "Generate & Buka"}
                          </button>
                        ) : (
                          <Link href={`/payroll?periodId=${period.id}`} className="emp-action emp-action-primary">
                            Buka Payroll
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {!loading && filteredPeriods.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="table-empty periods-empty">
                      <span className="periods-empty-icon">
                        <CalendarIcon />
                      </span>
                      <strong>{hasFilters ? "Tidak ada periode yang cocok" : "Belum ada periode payroll"}</strong>
                      <span>
                        {hasFilters
                          ? "Ubah kata kunci atau filter status untuk melihat periode lainnya."
                          : "Buat periode pertama untuk mulai menyiapkan payroll karyawan."}
                      </span>
                      {!hasFilters && (
                        <a href="#buat-periode" className="button-primary payroll-empty-button">
                          Buat Periode Pertama
                        </a>
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
