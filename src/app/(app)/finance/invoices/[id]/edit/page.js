import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getFinanceOptions, getInvoiceById } from "@/lib/financeQueries";
import { toNumber } from "@/lib/finance";
import InvoiceForm from "../../../InvoiceForm";

export const instant = false;

export default async function EditInvoicePage({ params }) {
  await connection();

  const id = Number((await params).id);
  if (!id) notFound();

  const [invoice, options] = await Promise.all([getInvoiceById(id), getFinanceOptions()]);
  if (!invoice) notFound();
  if (invoice.paid > 0 || ["PAID", "CANCELLED"].includes(invoice.displayStatus)) {
    redirect(`/finance/invoices/${invoice.id}`);
  }

  const editable = {
    ...invoice,
    amount: toNumber(invoice.amount),
  };

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">Edit Invoice</span>
            <h1>Edit Invoice</h1>
            <p>Perbarui data invoice sebelum pembayaran dicatat.</p>
          </div>
          <Link href={`/finance/invoices/${invoice.id}`} className="doc-secondary-btn">
            Kembali
          </Link>
        </header>

        <section className="doc-form-card">
          <InvoiceForm
            mode="edit"
            invoice={editable}
            departments={options.departments}
            vendors={options.vendors}
          />
        </section>
      </div>
    </main>
  );
}
