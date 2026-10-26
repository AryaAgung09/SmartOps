import Link from "next/link";
import { connection } from "next/server";
import { getFinanceOptions } from "@/lib/financeQueries";
import InvoiceForm from "../../InvoiceForm";

export const instant = false;

export default async function NewInvoicePage() {
  await connection();

  const options = await getFinanceOptions();

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">New Invoice</span>
            <h1>Invoice Baru</h1>
            <p>Catat tagihan vendor dan tentukan jatuh tempo pembayaran.</p>
          </div>
          <Link href="/finance/invoices" className="doc-secondary-btn">
            Kembali
          </Link>
        </header>

        <section className="doc-form-card">
          <InvoiceForm departments={options.departments} vendors={options.vendors} />
        </section>
      </div>
    </main>
  );
}
