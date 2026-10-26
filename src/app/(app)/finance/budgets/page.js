import Link from "next/link";
import { connection } from "next/server";
import { getBudgetList, getFinanceOptions } from "@/lib/financeQueries";
import {
  BUDGET_STATUSES,
  formatCurrency,
  formatDate,
  statusClass,
} from "@/lib/finance";
import FinanceActionButton from "../FinanceActionButton";

export const instant = false;

export default async function BudgetsPage({ searchParams }) {
  await connection();

  const params = await searchParams;
  const search = String(params?.search || "").trim();
  const status = BUDGET_STATUSES.some((item) => item.value === params?.status)
    ? params.status
    : "";
  const departmentId = Number(params?.departmentId) || null;

  const [{ budgets, summary }, options] = await Promise.all([
    getBudgetList({ search, status, departmentId }),
    getFinanceOptions(),
  ]);

  const hasFilters = Boolean(search || status || departmentId);

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">Budget Planning</span>
            <h1>Budget &amp; Anggaran</h1>
            <p>
              Tetapkan plafon anggaran per departemen dan pantau realisasinya
              secara otomatis dari pengeluaran yang disetujui.
            </p>
          </div>
          <Link href="/finance/budgets/new" className="doc-primary-btn">
            <span aria-hidden="true">+</span>
            Budget Baru
          </Link>
        </header>

        <section className="doc-kpi-grid" aria-label="Budget summary">
          <article className="doc-kpi doc-kpi-blue">
            <span className="doc-kpi-label">Total Budget</span>
            <strong>{formatCurrency(summary.amount)}</strong>
            <small>{summary.total} budget terdaftar</small>
          </article>
          <article className="doc-kpi doc-kpi-green">
            <span className="doc-kpi-label">Budget Aktif</span>
            <strong>{summary.active}</strong>
            <small>Sedang berjalan</small>
          </article>
          <article className="doc-kpi doc-kpi-amber">
            <span className="doc-kpi-label">Realisasi</span>
            <strong>{formatCurrency(summary.spent)}</strong>
            <small>Dari pengeluaran disetujui</small>
          </article>
          <article className="doc-kpi doc-kpi-rose">
            <span className="doc-kpi-label">Sisa Anggaran</span>
            <strong>{formatCurrency(summary.amount - summary.spent)}</strong>
            <small>Total seluruh budget</small>
          </article>
        </section>

        <section className="doc-card">
          <div className="doc-card-head">
            <div>
              <h2>Daftar Budget</h2>
              <p>Filter budget berdasarkan status atau departemen.</p>
            </div>
            <span className="doc-chip">{budgets.length} hasil</span>
          </div>

          <form className="doc-filters" method="get">
            <div className="doc-filter-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Cari nama budget..."
                aria-label="Cari budget"
              />
            </div>
            <select name="status" defaultValue={status} aria-label="Filter status">
              <option value="">Semua status</option>
              {BUDGET_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select name="departmentId" defaultValue={departmentId || ""} aria-label="Filter departemen">
              <option value="">Semua departemen</option>
              {options.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <button type="submit">Terapkan</button>
            {hasFilters && (
              <Link href="/finance/budgets" className="doc-reset-link">
                Reset
              </Link>
            )}
          </form>

          <div className="doc-table-wrap">
            <table className="doc-table fin-table">
              <thead>
                <tr>
                  <th>Budget</th>
                  <th>Periode</th>
                  <th>Plafon</th>
                  <th>Pemakaian</th>
                  <th>Status</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {budgets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="fin-table-empty">
                      Belum ada budget yang sesuai filter.
                    </td>
                  </tr>
                )}
                {budgets.map((budget) => (
                  <tr key={budget.id}>
                    <td>
                      <div className="fin-table-title">
                        <strong>{budget.name}</strong>
                        <small>
                          {budget.department?.name || "Perusahaan"} · {budget.expenseCount} pengeluaran
                        </small>
                      </div>
                    </td>
                    <td>
                      <span className="fin-date-range">
                        <strong>{formatDate(budget.periodStart)}</strong>
                        <small>s.d. {formatDate(budget.periodEnd)}</small>
                      </span>
                    </td>
                    <td className="fin-money">{formatCurrency(budget.amount)}</td>
                    <td>
                      <div className="fin-usage-cell">
                        <div className="fin-budget-meta">
                          <span>{formatCurrency(budget.spent)}</span>
                          <span className={budget.remaining < 0 ? "is-danger" : ""}>
                            {budget.remaining < 0 ? "Lewat " : "Sisa "}
                            {formatCurrency(Math.abs(budget.remaining))}
                          </span>
                        </div>
                        <div className="fin-progress">
                          <span
                            style={{ width: `${Math.min(budget.percent, 100)}%` }}
                            className={budget.percent >= 90 ? "danger" : budget.percent >= 70 ? "warning" : ""}
                          />
                        </div>
                        <small>{budget.percent}% terpakai</small>
                      </div>
                    </td>
                    <td>
                      <span className={`fin-status ${statusClass(budget.status)}`}>
                        {budget.status === "ACTIVE" ? "Aktif" : "Ditutup"}
                      </span>
                    </td>
                    <td>
                      <div className="fin-row-actions">
                        <FinanceActionButton
                          endpoint={`/api/finance/budgets/${budget.id}`}
                          body={{ status: budget.status === "ACTIVE" ? "CLOSED" : "ACTIVE" }}
                          label={budget.status === "ACTIVE" ? "Tutup" : "Aktifkan"}
                        />
                        {budget.expenseCount === 0 && (
                          <FinanceActionButton
                            endpoint={`/api/finance/budgets/${budget.id}`}
                            method="DELETE"
                            label="Hapus"
                            className="fin-action-btn danger"
                            confirmMessage={`Hapus budget "${budget.name}"?`}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
