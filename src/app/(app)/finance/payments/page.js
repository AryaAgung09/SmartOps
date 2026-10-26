import Link from "next/link";
import { connection } from "next/server";
import { getPaymentList, getPaymentTargets } from "@/lib/financeQueries";
import {
  PAYMENT_DIRECTIONS,
  PAYMENT_METHODS,
  formatCurrency,
  formatDate,
  paymentDirectionLabel,
  paymentMethodLabel,
  statusClass,
} from "@/lib/finance";
import FinanceActionButton from "../FinanceActionButton";
import PaymentForm from "../PaymentForm";

export const instant = false;

export default async function PaymentsPage({ searchParams }) {
  await connection();

  const params = await searchParams;
  const direction = PAYMENT_DIRECTIONS.some((item) => item.value === params?.direction)
    ? params.direction
    : "";
  const method = PAYMENT_METHODS.some((item) => item.value === params?.method)
    ? params.method
    : "";
  const search = String(params?.search || "").trim();
  const page = Math.max(Number(params?.page) || 1, 1);
  const defaultInvoiceId = Number(params?.invoiceId) || null;
  const defaultExpenseId = Number(params?.expenseId) || null;

  const [{ payments, summary, pagination }, targets] = await Promise.all([
    getPaymentList({ direction, method, search, page, limit: 15 }),
    getPaymentTargets(),
  ]);

  const plainTargets = {
    invoices: targets.invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      vendor: invoice.vendor ? { name: invoice.vendor.name } : null,
      outstanding: invoice.outstanding,
    })),
    expenses: targets.expenses.map((expense) => ({
      id: expense.id,
      title: expense.title,
      vendor: expense.vendor ? { name: expense.vendor.name } : null,
      outstanding: expense.outstanding,
    })),
    vendors: targets.vendors,
  };

  const hasFilters = Boolean(direction || method || search);

  function pageHref(targetPage) {
    const query = new URLSearchParams();
    if (direction) query.set("direction", direction);
    if (method) query.set("method", method);
    if (search) query.set("search", search);
    query.set("page", String(targetPage));
    return `/finance/payments?${query.toString()}`;
  }

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">Cash Movement</span>
            <h1>Pembayaran &amp; Arus Kas</h1>
            <p>
              Catat pembayaran invoice, penyelesaian pengeluaran, serta
              pemasukan lain perusahaan.
            </p>
          </div>
        </header>

        <section className="doc-kpi-grid" aria-label="Payment summary">
          <article className="doc-kpi doc-kpi-blue">
            <span className="doc-kpi-label">Total Transaksi</span>
            <strong>{summary.total}</strong>
            <small>Pembayaran tercatat</small>
          </article>
          <article className="doc-kpi doc-kpi-green">
            <span className="doc-kpi-label">Pemasukan</span>
            <strong>{formatCurrency(summary.inbound)}</strong>
            <small>Seluruh transaksi masuk</small>
          </article>
          <article className="doc-kpi doc-kpi-rose">
            <span className="doc-kpi-label">Pengeluaran</span>
            <strong>{formatCurrency(summary.outbound)}</strong>
            <small>Seluruh transaksi keluar</small>
          </article>
          <article className="doc-kpi doc-kpi-amber">
            <span className="doc-kpi-label">Net Cash</span>
            <strong>{formatCurrency(summary.inbound - summary.outbound)}</strong>
            <small>Pemasukan dikurangi pengeluaran</small>
          </article>
        </section>

        <section className="fin-payment-layout">
          <article className="doc-card">
            <PaymentForm
              targets={plainTargets}
              defaultInvoiceId={defaultInvoiceId}
              defaultExpenseId={defaultExpenseId}
            />
          </article>

          <article className="doc-card">
            <div className="doc-card-head">
              <div>
                <h2>Jatuh Tempo Terbuka</h2>
                <p>Tagihan dan pengeluaran yang belum dibayar.</p>
              </div>
            </div>
            <div className="fin-open-targets">
              {plainTargets.invoices.length === 0 && plainTargets.expenses.length === 0 && (
                <div className="fin-empty">Semua tagihan sudah selesai.</div>
              )}
              {plainTargets.invoices.slice(0, 4).map((invoice) => (
                <Link
                  key={`invoice-${invoice.id}`}
                  href={`/finance/payments?invoiceId=${invoice.id}`}
                  className="fin-open-target"
                >
                  <div>
                    <strong>{invoice.invoiceNumber}</strong>
                    <small>{invoice.vendor?.name || "Vendor"}</small>
                  </div>
                  <span>{formatCurrency(invoice.outstanding)}</span>
                </Link>
              ))}
              {plainTargets.expenses.slice(0, 4).map((expense) => (
                <Link
                  key={`expense-${expense.id}`}
                  href={`/finance/payments?expenseId=${expense.id}`}
                  className="fin-open-target"
                >
                  <div>
                    <strong>{expense.title}</strong>
                    <small>{expense.vendor?.name || "Pengeluaran"}</small>
                  </div>
                  <span>{formatCurrency(expense.outstanding)}</span>
                </Link>
              ))}
            </div>
          </article>
        </section>

        <section className="doc-card">
          <div className="doc-card-head">
            <div>
              <h2>Payment History</h2>
              <p>Semua transaksi pembayaran yang telah dicatat.</p>
            </div>
            <span className="doc-chip">{pagination.total} transaksi</span>
          </div>

          <form className="doc-filters" method="get">
            <div className="doc-filter-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Cari referensi, vendor, invoice, atau pengeluaran..."
                aria-label="Cari pembayaran"
              />
            </div>
            <select name="direction" defaultValue={direction} aria-label="Filter arah">
              <option value="">Semua arah</option>
              {PAYMENT_DIRECTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select name="method" defaultValue={method} aria-label="Filter metode">
              <option value="">Semua metode</option>
              {PAYMENT_METHODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <button type="submit">Terapkan</button>
            {hasFilters && (
              <Link href="/finance/payments" className="doc-reset-link">
                Reset
              </Link>
            )}
          </form>

          <div className="doc-table-wrap">
            <table className="doc-table fin-table">
              <thead>
                <tr>
                  <th>Transaksi</th>
                  <th>Tanggal</th>
                  <th>Metode</th>
                  <th>Referensi</th>
                  <th>Arah</th>
                  <th>Jumlah</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="fin-table-empty">
                      Belum ada pembayaran yang sesuai filter.
                    </td>
                  </tr>
                )}
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <div className="fin-table-title">
                        <strong>
                          {payment.invoice?.invoiceNumber ||
                            payment.expense?.title ||
                            payment.vendor?.name ||
                            "Transaksi umum"}
                        </strong>
                        <small>
                          {payment.invoice
                            ? `Invoice · ${payment.vendor?.name || "Vendor"}`
                          : payment.expense
                              ? `${payment.expense.payrollId ? "Payroll" : "Pengeluaran"} · ${payment.vendor?.name || "Tanpa vendor"}`
                              : payment.vendor?.name || "Tanpa vendor"}
                        </small>
                      </div>
                    </td>
                    <td>{formatDate(payment.paymentDate)}</td>
                    <td>{paymentMethodLabel(payment.method)}</td>
                    <td>{payment.reference || "-"}</td>
                    <td>
                      <span className={`fin-status ${statusClass(payment.direction)}`}>
                        {paymentDirectionLabel(payment.direction)}
                      </span>
                    </td>
                    <td className="fin-money">{formatCurrency(payment.amount)}</td>
                    <td>
                      {payment.expense?.payrollId ? (
                        <span className="doc-chip">Otomatis</span>
                      ) : (
                        <FinanceActionButton
                          endpoint={`/api/finance/payments/${payment.id}`}
                          method="DELETE"
                          label="Hapus"
                          className="fin-action-btn danger"
                          confirmMessage="Hapus pembayaran ini? Status invoice atau pengeluaran akan dihitung ulang."
                        />
                      )}
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
