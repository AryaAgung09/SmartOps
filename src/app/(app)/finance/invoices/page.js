import Link from "next/link";
import { connection } from "next/server";
import { getFinanceOptions, getInvoiceList } from "@/lib/financeQueries";
import {
  INVOICE_STATUSES,
  formatCurrency,
  formatDate,
  invoiceStatusLabel,
  statusClass,
} from "@/lib/finance";
import FinanceActionButton from "../FinanceActionButton";

export const instant = false;

export default async function InvoicesPage({ searchParams }) {
  await connection();

  const params = await searchParams;
  const search = String(params?.search || "").trim();
  const status = INVOICE_STATUSES.some((item) => item.value === params?.status)
    ? params.status
    : "";
  const vendorId = Number(params?.vendorId) || null;
  const page = Math.max(Number(params?.page) || 1, 1);

  const [{ invoices, summary, pagination }, options] = await Promise.all([
    getInvoiceList({ search, status, vendorId, page, limit: 15 }),
    getFinanceOptions(),
  ]);

  const hasFilters = Boolean(search || status || vendorId);

  function pageHref(targetPage) {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    if (vendorId) query.set("vendorId", String(vendorId));
    query.set("page", String(targetPage));
    return `/finance/invoices?${query.toString()}`;
  }

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">Accounts Payable</span>
            <h1>Invoice Vendor</h1>
            <p>
              Kelola tagihan vendor, jatuh tempo, pembayaran sebagian, dan
              status pelunasan.
            </p>
          </div>
          <Link href="/finance/invoices/new" className="doc-primary-btn">
            <span aria-hidden="true">+</span>
            Invoice Baru
          </Link>
        </header>

        <section className="doc-kpi-grid" aria-label="Invoice summary">
          <article className="doc-kpi doc-kpi-blue">
            <span className="doc-kpi-label">Total Invoice</span>
            <strong>{summary.total}</strong>
            <small>Seluruh invoice tercatat</small>
          </article>
          <article className="doc-kpi doc-kpi-amber">
            <span className="doc-kpi-label">Outstanding</span>
            <strong>{formatCurrency(summary.outstanding)}</strong>
            <small>Sisa tagihan berjalan</small>
          </article>
          <article className="doc-kpi doc-kpi-rose">
            <span className="doc-kpi-label">Jatuh Tempo</span>
            <strong>{summary.overdue}</strong>
            <small>Invoice melewati due date</small>
          </article>
          <article className="doc-kpi doc-kpi-green">
            <span className="doc-kpi-label">Lunas</span>
            <strong>{summary.paid}</strong>
            <small>Invoice selesai dibayar</small>
          </article>
        </section>

        <section className="doc-card">
          <div className="doc-card-head">
            <div>
              <h2>Invoice Register</h2>
              <p>Filter tagihan berdasarkan status atau vendor.</p>
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
                placeholder="Cari nomor invoice atau vendor..."
                aria-label="Cari invoice"
              />
            </div>
            <select name="status" defaultValue={status} aria-label="Filter status">
              <option value="">Semua status</option>
              {INVOICE_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select name="vendorId" defaultValue={vendorId || ""} aria-label="Filter vendor">
              <option value="">Semua vendor</option>
              {options.vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
            <button type="submit">Terapkan</button>
            {hasFilters && (
              <Link href="/finance/invoices" className="doc-reset-link">
                Reset
              </Link>
            )}
          </form>

          <div className="doc-table-wrap">
            <table className="doc-table fin-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Tanggal</th>
                  <th>Jumlah</th>
                  <th>Dibayar</th>
                  <th>Sisa</th>
                  <th>Status</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="fin-table-empty">
                      Belum ada invoice yang sesuai filter.
                    </td>
                  </tr>
                )}
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <div className="fin-table-title">
                        <Link href={`/finance/invoices/${invoice.id}`}>
                          <strong>{invoice.invoiceNumber}</strong>
                        </Link>
                        <small>
                          {invoice.vendor?.name || "Vendor"} · {invoice.department?.name || "Umum"}
                        </small>
                      </div>
                    </td>
                    <td>
                      <span className="fin-date-range">
                        <strong>{formatDate(invoice.issueDate)}</strong>
                        <small>Due {formatDate(invoice.dueDate)}</small>
                      </span>
                    </td>
                    <td className="fin-money">{formatCurrency(invoice.amount)}</td>
                    <td>{formatCurrency(invoice.paid)}</td>
                    <td className="fin-money">{formatCurrency(invoice.outstanding)}</td>
                    <td>
                      <span className={`fin-status ${statusClass(invoice.displayStatus)}`}>
                        {invoiceStatusLabel(invoice.displayStatus)}
                      </span>
                    </td>
                    <td>
                      <div className="fin-row-actions">
                        {invoice.displayStatus === "DRAFT" && (
                          <FinanceActionButton
                            endpoint={`/api/finance/invoices/${invoice.id}`}
                            body={{ status: "SENT" }}
                            label="Kirim"
                          />
                        )}
                        {invoice.displayStatus !== "DRAFT" &&
                          invoice.displayStatus !== "CANCELLED" &&
                          invoice.displayStatus !== "PAID" && (
                            <Link
                              href={`/finance/invoices/${invoice.id}`}
                              className="fin-action-btn primary"
                            >
                              Bayar
                            </Link>
                          )}
                        {invoice.displayStatus === "DRAFT" && (
                          <FinanceActionButton
                            endpoint={`/api/finance/invoices/${invoice.id}`}
                            method="DELETE"
                            label="Hapus"
                            className="fin-action-btn danger"
                            confirmMessage={`Hapus invoice ${invoice.invoiceNumber}?`}
                          />
                        )}
                        {invoice.paid === 0 &&
                          !["PAID", "CANCELLED", "DRAFT"].includes(invoice.displayStatus) && (
                            <FinanceActionButton
                              endpoint={`/api/finance/invoices/${invoice.id}`}
                              body={{ status: "CANCELLED" }}
                              label="Batalkan"
                              className="fin-action-btn danger"
                              confirmMessage={`Batalkan invoice ${invoice.invoiceNumber}?`}
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
