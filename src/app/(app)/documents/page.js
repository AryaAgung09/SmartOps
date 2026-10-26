import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getDocumentList } from "@/lib/documentQueries";
import { isFeatureAllowed } from "@/lib/featureAccess";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUSES,
  categoryLabel,
  daysUntilExpiry,
  formatFileSize,
  statusLabel,
} from "@/lib/documents";

export const instant = false;

function statusClass(status) {
  return String(status || "").toLowerCase();
}

function ExpiryCell({ document }) {
  if (!document.expiryDate) {
    return <span className="doc-muted">Tanpa kedaluwarsa</span>;
  }

  const days = daysUntilExpiry(document.expiryDate);
  const dateText = new Date(document.expiryDate).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  let hint = `${days} hari lagi`;
  if (days < 0) hint = `${Math.abs(days)} hari lalu`;
  if (days === 0) hint = "Hari ini";

  return (
    <span className="doc-expiry">
      <strong>{dateText}</strong>
      <small>{hint}</small>
    </span>
  );
}

export default async function DocumentsPage({ searchParams }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const params = await searchParams;
  const search = String(params?.search || "").trim();
  const category = DOCUMENT_CATEGORIES.some((item) => item.value === params?.category)
    ? params.category
    : "";
  const status = DOCUMENT_STATUSES.some((item) => item.value === params?.status)
    ? params.status
    : "";
  const page = Math.max(Number(params?.page) || 1, 1);
  const ownerId = Number(params?.ownerId) || null;

  const { documents, summary, pagination } = await getDocumentList(actor, {
    search,
    category,
    status,
    ownerId,
    page,
    limit: 15,
  });

  const canManage = await isFeatureAllowed(actor.role, "documents-upload");
  const hasFilters = Boolean(search || category || status || ownerId);

  function pageHref(targetPage) {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (category) query.set("category", category);
    if (status) query.set("status", status);
    if (ownerId) query.set("ownerId", String(ownerId));
    query.set("page", String(targetPage));
    return `/documents?${query.toString()}`;
  }

  return (
    <main className="doc-page">
      <div className="doc-dashboard">
        <header className="doc-hero">
          <div className="doc-hero-main">
            <span className="doc-eyebrow">Document Control</span>
            <h1>Document &amp; Contract Center</h1>
            <p>
              Kelola kontrak, surat keputusan, sertifikat, dan dokumen
              kepegawaian dengan masa berlaku yang terpantau.
            </p>
            <div className="doc-hero-tags">
              <span className="doc-live-tag">
                <span />
                {pagination.total} dokumen terdaftar
              </span>
              <span className="doc-range-tag">
                {summary.expiring} perlu perhatian
              </span>
            </div>
          </div>

          <div className="doc-hero-actions">
            {canManage && (
              <Link href="/documents/new" className="doc-primary-btn">
                <span aria-hidden="true">+</span>
                Upload Dokumen
              </Link>
            )}
            <Link href="/employees" className="doc-secondary-btn">
              Employee Directory
            </Link>
          </div>
        </header>

        <section className="doc-kpi-grid" aria-label="Document summary">
          <article className="doc-kpi doc-kpi-blue">
            <span className="doc-kpi-label">Total Documents</span>
            <strong>{summary.total}</strong>
            <small>Seluruh dokumen dalam cakupan Anda</small>
          </article>
          <article className="doc-kpi doc-kpi-green">
            <span className="doc-kpi-label">Active</span>
            <strong>{summary.active}</strong>
            <small>Berlaku atau tanpa masa kedaluwarsa</small>
          </article>
          <article className="doc-kpi doc-kpi-amber">
            <span className="doc-kpi-label">Expiring Soon</span>
            <strong>{summary.expiring}</strong>
            <small>Kedaluwarsa dalam 30 hari</small>
          </article>
          <article className="doc-kpi doc-kpi-rose">
            <span className="doc-kpi-label">Expired</span>
            <strong>{summary.expired}</strong>
            <small>Perlu diperbarui atau diarsipkan</small>
          </article>
        </section>

        <section className="doc-card">
          <div className="doc-card-head">
            <div>
              <h2>Document Library</h2>
              <p>Cari dan filter dokumen berdasarkan kategori atau status.</p>
            </div>
            <span className="doc-chip">{pagination.total} hasil</span>
          </div>

          <form className="doc-filters" method="get">
            {ownerId && <input type="hidden" name="ownerId" value={ownerId} />}
            <div className="doc-filter-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Cari judul, file, atau nama karyawan..."
                aria-label="Cari dokumen"
              />
            </div>

            <select name="category" defaultValue={category} aria-label="Filter kategori">
              <option value="">Semua kategori</option>
              {DOCUMENT_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select name="status" defaultValue={status} aria-label="Filter status">
              <option value="">Semua status</option>
              {DOCUMENT_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <button type="submit">Terapkan</button>

            {hasFilters && (
              <Link href="/documents" className="doc-reset-link">
                Reset
              </Link>
            )}
          </form>

          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Owner</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <Link href={`/documents/${document.id}`} className="doc-title-link">
                        <span className="doc-file-icon" aria-hidden="true">
                          ▤
                        </span>
                        <span>
                          <strong>{document.title}</strong>
                          <small>
                            {formatFileSize(document.fileSize)} · {document.fileName}
                          </small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="doc-category">{categoryLabel(document.category)}</span>
                    </td>
                    <td>
                      <span className="doc-owner">
                        <span className="doc-avatar">
                          {(document.owner?.name || "C").charAt(0).toUpperCase()}
                        </span>
                        {document.owner?.name || "Perusahaan"}
                      </span>
                    </td>
                    <td>
                      <ExpiryCell document={document} />
                    </td>
                    <td>
                      <span className={`doc-status ${statusClass(document.status)}`}>
                        {statusLabel(document.status)}
                      </span>
                    </td>
                    <td>
                      <Link href={`/documents/${document.id}`} className="doc-row-action">
                        Lihat
                      </Link>
                    </td>
                  </tr>
                ))}

                {!documents.length && (
                  <tr>
                    <td colSpan={6}>
                      <div className="doc-empty">
                        <strong>Belum ada dokumen</strong>
                        <span>
                          {hasFilters
                            ? "Tidak ada dokumen yang cocok dengan filter."
                            : "Unggah dokumen pertama untuk mulai mengelola arsip HR."}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="doc-pagination">
              <span>
                Halaman {pagination.page} dari {pagination.pages}
              </span>
              <div>
                {pagination.page > 1 && (
                  <Link href={pageHref(pagination.page - 1)}>Sebelumnya</Link>
                )}
                {pagination.page < pagination.pages && (
                  <Link href={pageHref(pagination.page + 1)}>Berikutnya</Link>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
