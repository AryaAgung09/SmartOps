import Link from "next/link";
import { connection } from "next/server";
import { getVendorList } from "@/lib/financeQueries";
import { formatCurrency } from "@/lib/finance";
import FinanceActionButton from "../FinanceActionButton";

export const instant = false;

export default async function VendorsPage({ searchParams }) {
  await connection();

  const params = await searchParams;
  const search = String(params?.search || "").trim();
  const includeInactive = params?.includeInactive === "1";
  const { vendors, summary } = await getVendorList({ search, includeInactive });
  const hasFilters = Boolean(search || includeInactive);

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">Vendor Directory</span>
            <h1>Vendor &amp; Pemasok</h1>
            <p>
              Simpan data vendor, pantau total tagihan, dan kelola status
              aktif pemasok.
            </p>
          </div>
          <Link href="/finance/vendors/new" className="doc-primary-btn">
            <span aria-hidden="true">+</span>
            Vendor Baru
          </Link>
        </header>

        <section className="doc-kpi-grid" aria-label="Vendor summary">
          <article className="doc-kpi doc-kpi-blue">
            <span className="doc-kpi-label">Total Vendor</span>
            <strong>{summary.total}</strong>
            <small>{summary.active} vendor aktif</small>
          </article>
          <article className="doc-kpi doc-kpi-amber">
            <span className="doc-kpi-label">Outstanding Tagihan</span>
            <strong>{formatCurrency(summary.outstanding)}</strong>
            <small>Seluruh invoice terbuka</small>
          </article>
          <article className="doc-kpi doc-kpi-rose">
            <span className="doc-kpi-label">Total Pengeluaran</span>
            <strong>{formatCurrency(summary.expenseTotal)}</strong>
            <small>Pengeluaran disetujui/dibayar</small>
          </article>
          <article className="doc-kpi doc-kpi-green">
            <span className="doc-kpi-label">Vendor Aktif</span>
            <strong>{summary.active}</strong>
            <small>Siap dipakai transaksi</small>
          </article>
        </section>

        <section className="doc-card">
          <div className="doc-card-head">
            <div>
              <h2>Vendor Register</h2>
              <p>Cari vendor berdasarkan nama, email, atau telepon.</p>
            </div>
            <span className="doc-chip">{vendors.length} hasil</span>
          </div>

          <form className="doc-filters" method="get">
            <div className="doc-filter-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Cari vendor..."
                aria-label="Cari vendor"
              />
            </div>
            <label className="fin-checkbox">
              <input
                type="checkbox"
                name="includeInactive"
                value="1"
                defaultChecked={includeInactive}
              />
              Tampilkan nonaktif
            </label>
            <button type="submit">Terapkan</button>
            {hasFilters && (
              <Link href="/finance/vendors" className="doc-reset-link">
                Reset
              </Link>
            )}
          </form>

          <div className="doc-table-wrap">
            <table className="doc-table fin-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Kontak</th>
                  <th>Pengeluaran</th>
                  <th>Invoice</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 && (
                  <tr>
                    <td colSpan={7} className="fin-table-empty">
                      Belum ada vendor yang sesuai filter.
                    </td>
                  </tr>
                )}
                {vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>
                      <div className="fin-table-title">
                        <strong>{vendor.name}</strong>
                        <small>{vendor.taxNumber || "Tanpa NPWP"}</small>
                      </div>
                    </td>
                    <td>
                      <div className="fin-table-title">
                        <strong>{vendor.email || "-"}</strong>
                        <small>{vendor.phone || "Tanpa telepon"}</small>
                      </div>
                    </td>
                    <td>{formatCurrency(vendor.expenseTotal)}</td>
                    <td>{vendor._count.invoices}</td>
                    <td className="fin-money">{formatCurrency(vendor.outstanding)}</td>
                    <td>
                      <span className={`fin-status ${vendor.isActive ? "active" : "inactive"}`}>
                        {vendor.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td>
                      <div className="fin-row-actions">
                        <FinanceActionButton
                          endpoint={`/api/finance/vendors/${vendor.id}`}
                          body={{ isActive: !vendor.isActive }}
                          label={vendor.isActive ? "Nonaktifkan" : "Aktifkan"}
                        />
                        {vendor._count.expenses + vendor._count.invoices === 0 && (
                          <FinanceActionButton
                            endpoint={`/api/finance/vendors/${vendor.id}`}
                            method="DELETE"
                            label="Hapus"
                            className="fin-action-btn danger"
                            confirmMessage={`Hapus vendor "${vendor.name}"?`}
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
