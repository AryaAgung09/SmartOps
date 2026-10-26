import Link from "next/link";
import { connection } from "next/server";
import VendorForm from "../../VendorForm";

export const instant = false;

export default async function NewVendorPage() {
  await connection();

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">New Vendor</span>
            <h1>Vendor Baru</h1>
            <p>Simpan data pemasok untuk invoice dan pengeluaran perusahaan.</p>
          </div>
          <Link href="/finance/vendors" className="doc-secondary-btn">
            Kembali
          </Link>
        </header>

        <section className="doc-form-card">
          <VendorForm />
        </section>
      </div>
    </main>
  );
}
