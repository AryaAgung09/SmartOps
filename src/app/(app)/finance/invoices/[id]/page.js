import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getInvoiceById } from "@/lib/financeQueries";
import {
  formatCurrency,
  formatDate,
  invoiceStatusLabel,
  paymentMethodLabel,
  statusClass,
} from "@/lib/finance";
import FinanceActionButton from "../../FinanceActionButton";
import PaymentForm from "../../PaymentForm";

export const instant = false;

export default async function InvoiceDetailPage({ params }) {
  await connection();

  const id = Number((await params).id);
  if (!id) notFound();

  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  const canEdit = invoice.paid === 0 && !["PAID", "CANCELLED"].includes(invoice.displayStatus);
  const canCancel =
    invoice.paid === 0 && !["PAID", "CANCELLED", "DRAFT"].includes(invoice.displayStatus);
  const paymentTargets = {
    invoices: [
      {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        vendor: invoice.vendor ? { name: invoice.vendor.name } : null,
        outstanding: invoice.outstanding,
      },
    ],
    expenses: [],
    vendors: [],
  };

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="doc-detail-head fin-detail-head">
          <div>
            <Link href="/finance/invoices" className="fin-back-link">
              ← Invoice
            </Link>
            <span className="doc-eyebrow">Accounts Payable</span>
            <h1>{invoice.invoiceNumber}</h1>
            <p>
              {invoice.vendor?.name || "Vendor"} · {invoice.department?.name || "Umum"} · due{" "}
              {formatDate(invoice.dueDate)}
            </p>
          </div>
          <div className="doc-detail-actions">
            <span className={`fin-status ${statusClass(invoice.displayStatus)}`}>
              {invoiceStatusLabel(invoice.displayStatus)}
            </span>
            {canEdit && (
              <Link href={`/finance/invoices/${invoice.id}/edit`} className="doc-secondary-btn">
                Edit
              </Link>
            )}
            {invoice.displayStatus === "DRAFT" && (
              <FinanceActionButton
                endpoint={`/api/finance/invoices/${invoice.id}`}
                body={{ status: "SENT" }}
                label="Kirim Invoice"
              />
            )}
            {canCancel && (
              <FinanceActionButton
                endpoint={`/api/finance/invoices/${invoice.id}`}
                body={{ status: "CANCELLED" }}
                label="Batalkan"
                className="fin-action-btn danger"
                confirmMessage={`Batalkan invoice ${invoice.invoiceNumber}?`}
              />
            )}
          </div>
        </header>

        <section className="doc-kpi-grid" aria-label="Invoice amounts">
          <article className="doc-kpi doc-kpi-blue">
            <span className="doc-kpi-label">Nilai Invoice</span>
            <strong>{formatCurrency(invoice.amount)}</strong>
            <small>Diterbitkan {formatDate(invoice.issueDate)}</small>
          </article>
          <article className="doc-kpi doc-kpi-green">
            <span className="doc-kpi-label">Sudah Dibayar</span>
            <strong>{formatCurrency(invoice.paid)}</strong>
            <small>{invoice.payments.length} pembayaran</small>
          </article>
          <article className="doc-kpi doc-kpi-amber">
            <span className="doc-kpi-label">Sisa Tagihan</span>
            <strong>{formatCurrency(invoice.outstanding)}</strong>
            <small>{invoice.outstanding > 0 ? "Belum lunas" : "Lunas"}</small>
          </article>
          <article className="doc-kpi doc-kpi-rose">
            <span className="doc-kpi-label">Jatuh Tempo</span>
            <strong className="fin-kpi-text">{formatDate(invoice.dueDate)}</strong>
            <small>{invoice.displayStatus === "OVERDUE" ? "Melewati jatuh tempo" : "Dalam periode"}</small>
          </article>
        </section>

        <section className="doc-detail-grid">
          <article className="doc-card">
            <div className="doc-card-head">
              <div>
                <h2>Detail Invoice</h2>
                <p>Informasi vendor dan pencatatan tagihan.</p>
              </div>
            </div>
            <dl className="fin-detail-list">
              <div>
                <dt>Nomor Invoice</dt>
                <dd>{invoice.invoiceNumber}</dd>
              </div>
              <div>
                <dt>Vendor</dt>
                <dd>{invoice.vendor?.name || "-"}</dd>
              </div>
              <div>
                <dt>Email Vendor</dt>
                <dd>{invoice.vendor?.email || "-"}</dd>
              </div>
              <div>
                <dt>Departemen</dt>
                <dd>{invoice.department?.name || "-"}</dd>
              </div>
              <div>
                <dt>Tanggal Invoice</dt>
                <dd>{formatDate(invoice.issueDate)}</dd>
              </div>
              <div>
                <dt>Jatuh Tempo</dt>
                <dd>{formatDate(invoice.dueDate)}</dd>
              </div>
              <div>
                <dt>Dibuat oleh</dt>
                <dd>{invoice.createdBy?.name || "-"}</dd>
              </div>
              <div>
                <dt>Dibayar pada</dt>
                <dd>{formatDate(invoice.paidAt)}</dd>
              </div>
              <div className="wide">
                <dt>Catatan</dt>
                <dd>{invoice.notes || "Tidak ada catatan."}</dd>
              </div>
            </dl>
          </article>

          <article className="doc-card">
            <div className="doc-card-head">
              <div>
                <h2>Riwayat Pembayaran</h2>
                <p>Pembayaran yang tercatat untuk invoice ini.</p>
              </div>
            </div>
            <div className="fin-timeline">
              {invoice.payments.length === 0 && (
                <div className="fin-empty">Belum ada pembayaran.</div>
              )}
              {invoice.payments.map((payment) => (
                <div className="fin-timeline-item" key={payment.id}>
                  <div>
                    <strong>{formatCurrency(payment.amount)}</strong>
                    <small>
                      {formatDate(payment.paymentDate)} · {paymentMethodLabel(payment.method)} ·{" "}
                      {payment.reference || "Tanpa referensi"}
                    </small>
                  </div>
                  <span>{payment.createdBy?.name || "-"}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        {invoice.outstanding > 0 && invoice.displayStatus !== "CANCELLED" && (
          <section className="doc-card">
            <PaymentForm targets={paymentTargets} defaultInvoiceId={invoice.id} lockTarget />
          </section>
        )}
      </div>
    </main>
  );
}
