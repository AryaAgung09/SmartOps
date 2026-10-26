import Link from "next/link";
import { connection } from "next/server";
import { getFinanceOverview } from "@/lib/financeQueries";
import {
  categoryLabel,
  expenseStatusLabel,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  invoiceStatusLabel,
  statusClass,
} from "@/lib/finance";

export const instant = false;

export default async function FinanceOverviewPage() {
  await connection();

  const overview = await getFinanceOverview();
  const maxFlow = Math.max(
    ...overview.cashFlow.flatMap((month) => [month.inbound, month.outbound]),
    1
  );
  const maxCategory = Math.max(
    ...overview.spendingByCategory.map((item) => item.amount),
    1
  );

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="doc-hero fin-hero">
          <div className="doc-hero-main">
            <span className="doc-eyebrow">Finance Control</span>
            <h1>Finance Command Center</h1>
            <p>
              Pantau anggaran, pengeluaran, tagihan vendor, dan arus kas dalam
              satu workspace keuangan.
            </p>
            <div className="doc-hero-tags">
              <span className="doc-live-tag">
                <span />
                {overview.budgetRows.length} budget aktif
              </span>
              <span className="doc-range-tag">
                {overview.pendingCount} pengeluaran menunggu approval
              </span>
            </div>
          </div>

          <div className="doc-hero-actions">
            <Link href="/finance/expenses/new" className="doc-primary-btn">
              <span aria-hidden="true">+</span>
              Catat Pengeluaran
            </Link>
            <Link href="/finance/invoices/new" className="doc-secondary-btn">
              Invoice Baru
            </Link>
          </div>
        </header>

        <section className="doc-kpi-grid" aria-label="Finance summary">
          <article className="doc-kpi doc-kpi-blue">
            <span className="doc-kpi-label">Total Budget</span>
            <strong>{formatCompactCurrency(overview.totalBudget)}</strong>
            <small>{overview.budgetRows.length} budget aktif</small>
          </article>
          <article className="doc-kpi doc-kpi-amber">
            <span className="doc-kpi-label">Realisasi</span>
            <strong>{formatCompactCurrency(overview.totalSpent)}</strong>
            <small>{overview.utilization}% dari total budget</small>
          </article>
          <article className="doc-kpi doc-kpi-rose">
            <span className="doc-kpi-label">Outstanding Invoice</span>
            <strong>{formatCompactCurrency(overview.outstanding)}</strong>
            <small>{overview.overdueCount} invoice jatuh tempo</small>
          </article>
          <article className="doc-kpi doc-kpi-green">
            <span className="doc-kpi-label">Arus Kas Bulan Ini</span>
            <strong>{formatCompactCurrency(overview.netCash)}</strong>
            <small>
              Masuk {formatCompactCurrency(overview.cashIn)} / keluar{" "}
              {formatCompactCurrency(overview.cashOut)}
            </small>
          </article>
        </section>

        <section className="fin-grid fin-grid-main">
          <article className="doc-card fin-card">
            <div className="doc-card-head">
              <div>
                <h2>Cash Flow</h2>
                <p>Pemasukan dan pengeluaran enam bulan terakhir.</p>
              </div>
              <span className="doc-chip">6 bulan</span>
            </div>

            <div className="fin-cashflow">
              {overview.cashFlow.map((month) => (
                <div className="fin-flow-month" key={month.label}>
                  <div className="fin-flow-bars">
                    <span
                      className="fin-flow-bar inbound"
                      style={{ height: `${Math.max((month.inbound / maxFlow) * 100, 3)}%` }}
                      title={`Masuk ${formatCurrency(month.inbound)}`}
                    />
                    <span
                      className="fin-flow-bar outbound"
                      style={{ height: `${Math.max((month.outbound / maxFlow) * 100, 3)}%` }}
                      title={`Keluar ${formatCurrency(month.outbound)}`}
                    />
                  </div>
                  <strong>{month.label}</strong>
                  <small>{formatCompactCurrency(month.inbound - month.outbound)}</small>
                </div>
              ))}
            </div>

            <div className="fin-legend">
              <span><i className="inbound" /> Pemasukan</span>
              <span><i className="outbound" /> Pengeluaran</span>
            </div>
          </article>

          <article className="doc-card fin-card">
            <div className="doc-card-head">
              <div>
                <h2>Budget Watch</h2>
                <p>Pemakaian anggaran yang paling dekat dengan batas.</p>
              </div>
              <Link href="/finance/budgets" className="fin-text-link">
                Kelola
              </Link>
            </div>

            <div className="fin-budget-list">
              {overview.budgetRows.length === 0 && (
                <div className="fin-empty">
                  Belum ada budget aktif.{" "}
                  <Link href="/finance/budgets">Buat budget pertama</Link>.
                </div>
              )}
              {overview.budgetRows.slice(0, 4).map((budget) => (
                <div className="fin-budget-row" key={budget.id}>
                  <div className="fin-budget-top">
                    <div>
                      <strong>{budget.name}</strong>
                      <small>
                        {budget.department} · s.d. {formatDate(budget.periodEnd)}
                      </small>
                    </div>
                    <span className={budget.percent >= 90 ? "is-danger" : ""}>
                      {budget.percent}%
                    </span>
                  </div>
                  <div className="fin-progress">
                    <span
                      style={{ width: `${Math.min(budget.percent, 100)}%` }}
                      className={budget.percent >= 90 ? "danger" : budget.percent >= 70 ? "warning" : ""}
                    />
                  </div>
                  <div className="fin-budget-meta">
                    <span>{formatCurrency(budget.spent)} terpakai</span>
                    <span>{formatCurrency(budget.remaining)} tersisa</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="fin-grid">
          <article className="doc-card fin-card">
            <div className="doc-card-head">
              <div>
                <h2>Pengeluaran Terbaru</h2>
                <p>Aktivitas biaya terakhir perusahaan.</p>
              </div>
              <Link href="/finance/expenses" className="fin-text-link">
                Semua
              </Link>
            </div>

            <div className="fin-list">
              {overview.recentExpenses.length === 0 && (
                <div className="fin-empty">Belum ada pengeluaran tercatat.</div>
              )}
              {overview.recentExpenses.map((expense) => (
                <div className="fin-list-row" key={expense.id}>
                  <div className="fin-list-main">
                    <strong>{expense.title}</strong>
                    <small>
                      {categoryLabel(expense.category)} · {expense.vendor?.name || expense.department?.name || "Umum"} ·{" "}
                      {formatDate(expense.expenseDate)}
                    </small>
                  </div>
                  <div className="fin-list-side">
                    <strong>{formatCurrency(expense.amount)}</strong>
                    <span className={`fin-status ${statusClass(expense.status)}`}>
                      {expenseStatusLabel(expense.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="doc-card fin-card">
            <div className="doc-card-head">
              <div>
                <h2>Invoice Perlu Perhatian</h2>
                <p>Tagihan terbuka yang mendekati jatuh tempo.</p>
              </div>
              <Link href="/finance/invoices" className="fin-text-link">
                Semua
              </Link>
            </div>

            <div className="fin-list">
              {overview.recentInvoices.length === 0 && (
                <div className="fin-empty">Tidak ada invoice terbuka.</div>
              )}
              {overview.recentInvoices.map((invoice) => (
                <Link href={`/finance/invoices/${invoice.id}`} className="fin-list-row" key={invoice.id}>
                  <div className="fin-list-main">
                    <strong>{invoice.invoiceNumber}</strong>
                    <small>
                      {invoice.vendor?.name || "Vendor"} · jatuh tempo {formatDate(invoice.dueDate)}
                    </small>
                  </div>
                  <div className="fin-list-side">
                    <strong>{formatCurrency(invoice.outstanding)}</strong>
                    <span className={`fin-status ${statusClass(invoice.displayStatus)}`}>
                      {invoiceStatusLabel(invoice.displayStatus)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </article>

          <article className="doc-card fin-card">
            <div className="doc-card-head">
              <div>
                <h2>Pengeluaran per Kategori</h2>
                <p>Komposisi realisasi pada bulan berjalan.</p>
              </div>
            </div>

            <div className="fin-category-list">
              {overview.spendingByCategory.length === 0 && (
                <div className="fin-empty">Belum ada realisasi bulan ini.</div>
              )}
              {overview.spendingByCategory.map((item) => (
                <div className="fin-category-row" key={item.category}>
                  <div>
                    <span>{categoryLabel(item.category)}</span>
                    <strong>{formatCurrency(item.amount)}</strong>
                  </div>
                  <div className="fin-progress">
                    <span style={{ width: `${Math.max((item.amount / maxCategory) * 100, 4)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
