import Link from "next/link";
import { connection } from "next/server";
import { getExpenseList, getFinanceOptions } from "@/lib/financeQueries";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  categoryLabel,
  expenseStatusLabel,
  formatCurrency,
  formatDate,
  statusClass,
} from "@/lib/finance";
import FinanceActionButton from "../FinanceActionButton";

export const instant = false;

export default async function ExpensesPage({ searchParams }) {
  await connection();

  const params = await searchParams;
  const search = String(params?.search || "").trim();
  const category = EXPENSE_CATEGORIES.some((item) => item.value === params?.category)
    ? params.category
    : "";
  const status = EXPENSE_STATUSES.some((item) => item.value === params?.status)
    ? params.status
    : "";
  const departmentId = Number(params?.departmentId) || null;
  const page = Math.max(Number(params?.page) || 1, 1);

  const [{ expenses, summary, pagination }, options] = await Promise.all([
    getExpenseList({ search, category, status, departmentId, page, limit: 15 }),
    getFinanceOptions(),
  ]);

  const hasFilters = Boolean(search || category || status || departmentId);

  function pageHref(targetPage) {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (category) query.set("category", category);
    if (status) query.set("status", status);
    if (departmentId) query.set("departmentId", String(departmentId));
    query.set("page", String(targetPage));
    return `/finance/expenses?${query.toString()}`;
  }

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">Expense Tracking</span>
            <h1>Pengeluaran Perusahaan</h1>
            <p>
              Catat biaya operasional, ajukan approval, lalu selesaikan
              pembayaran dengan jejak audit yang rapi.
            </p>
          </div>
          <Link href="/finance/expenses/new" className="doc-primary-btn">
            <span aria-hidden="true">+</span>
            Catat Pengeluaran
          </Link>
        </header>

        <section className="doc-kpi-grid" aria-label="Expense summary">
          <article className="doc-kpi doc-kpi-blue">
            <span className="doc-kpi-label">Total Pengeluaran</span>
            <strong>{formatCurrency(summary.amount)}</strong>
            <small>{summary.total} transaksi</small>
          </article>
          <article className="doc-kpi doc-kpi-amber">
            <span className="doc-kpi-label">Menunggu Approval</span>
            <strong>{summary.pending}</strong>
            <small>Perlu ditinjau finance</small>
          </article>
          <article className="doc-kpi doc-kpi-green">
            <span className="doc-kpi-label">Disetujui</span>
            <strong>{summary.approved}</strong>
            <small>Siap dibayarkan</small>
          </article>
          <article className="doc-kpi doc-kpi-rose">
            <span className="doc-kpi-label">Dibayar</span>
            <strong>{summary.paid}</strong>
            <small>Pembayaran selesai</small>
          </article>
        </section>

        <section className="doc-card">
          <div className="doc-card-head">
            <div>
              <h2>Expense Ledger</h2>
              <p>Cari pengeluaran berdasarkan status, kategori, atau departemen.</p>
            </div>
            <span className="doc-chip">{pagination.total} hasil</span>
          </div>

          <form className="doc-filters" method="get">
            <div className="doc-filter-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Cari judul, vendor, atau catatan..."
                aria-label="Cari pengeluaran"
              />
            </div>
            <select name="category" defaultValue={category} aria-label="Filter kategori">
              <option value="">Semua kategori</option>
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={status} aria-label="Filter status">
              <option value="">Semua status</option>
              {EXPENSE_STATUSES.map((item) => (
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
              <Link href="/finance/expenses" className="doc-reset-link">
                Reset
              </Link>
            )}
          </form>

          <div className="doc-table-wrap">
            <table className="doc-table fin-table">
              <thead>
                <tr>
                  <th>Pengeluaran</th>
                  <th>Tanggal</th>
                  <th>Vendor / Departemen</th>
                  <th>Budget</th>
                  <th>Jumlah</th>
                  <th>Status</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="fin-table-empty">
                      Belum ada pengeluaran yang sesuai filter.
                    </td>
                  </tr>
                )}
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>
                      <div className="fin-table-title">
                        <Link href={`/finance/expenses/${expense.id}`}>
                          <strong>{expense.title}</strong>
                        </Link>
                        <small>{categoryLabel(expense.category)}</small>
                      </div>
                    </td>
                    <td>{formatDate(expense.expenseDate)}</td>
                    <td>
                      <div className="fin-table-title">
                        <strong>{expense.vendor?.name || "Tanpa vendor"}</strong>
                        <small>{expense.department?.name || "Umum"}</small>
                      </div>
                    </td>
                    <td>{expense.budget?.name || "-"}</td>
                    <td className="fin-money">{formatCurrency(expense.amount)}</td>
                    <td>
                      <span className={`fin-status ${statusClass(expense.status)}`}>
                        {expenseStatusLabel(expense.status)}
                      </span>
                    </td>
                    <td>
                      <div className="fin-row-actions">
                        {expense.status === "DRAFT" && (
                          <FinanceActionButton
                            endpoint={`/api/finance/expenses/${expense.id}`}
                            body={{ status: "PENDING" }}
                            label="Ajukan"
                          />
                        )}
                        {expense.status === "PENDING" && (
                          <>
                            <FinanceActionButton
                              endpoint={`/api/finance/expenses/${expense.id}`}
                              body={{ status: "APPROVED" }}
                              label="Setujui"
                              className="fin-action-btn success"
                            />
                            <FinanceActionButton
                              endpoint={`/api/finance/expenses/${expense.id}`}
                              body={{ status: "REJECTED" }}
                              label="Tolak"
                              className="fin-action-btn danger"
                            />
                          </>
                        )}
                        {expense.status === "APPROVED" && (
                          <Link
                            href={`/finance/payments?expenseId=${expense.id}`}
                            className="fin-action-btn primary"
                          >
                            Bayar
                          </Link>
                        )}
                        {["DRAFT", "REJECTED"].includes(expense.status) && (
                          <FinanceActionButton
                            endpoint={`/api/finance/expenses/${expense.id}`}
                            method="DELETE"
                            label="Hapus"
                            className="fin-action-btn danger"
                            confirmMessage={`Hapus pengeluaran "${expense.title}"?`}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="fin-pagination">
              {pagination.page > 1 && <Link href={pageHref(pagination.page - 1)}>Sebelumnya</Link>}
              <span>
                Halaman {pagination.page} dari {pagination.pages}
              </span>
              {pagination.page < pagination.pages && (
                <Link href={pageHref(pagination.page + 1)}>Berikutnya</Link>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
