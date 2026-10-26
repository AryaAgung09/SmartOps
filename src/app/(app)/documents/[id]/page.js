import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { getDocumentById } from "@/lib/documentQueries";
import { isFeatureAllowed } from "@/lib/featureAccess";
import {
  categoryLabel,
  daysUntilExpiry,
  formatFileSize,
  statusLabel,
  visibilityLabel,
} from "@/lib/documents";
import DocumentActions from "./DocumentActions";

export const instant = false;

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function DocumentDetailPage({ params }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const { id } = await params;
  const document = await getDocumentById(Number(id), actor);
  if (!document) redirect("/documents");

  const canManage = await isFeatureAllowed(actor.role, "documents-upload");
  const downloadUrl = `/api/documents/${document.id}/download`;
  const previewUrl = `${downloadUrl}?inline=1`;
  const isImage = document.mimeType?.startsWith("image/");
  const isPdf = document.mimeType === "application/pdf";
  const days = daysUntilExpiry(document.expiryDate);

  return (
    <main className="doc-page">
      <div className="doc-dashboard">
        <header className="doc-detail-head">
          <div>
            <Link href="/documents" className="doc-back-link">
              ← Document Center
            </Link>
            <h1>{document.title}</h1>
            <div className="doc-detail-badges">
              <span className={`doc-status ${String(document.status).toLowerCase()}`}>
                {statusLabel(document.status)}
              </span>
              <span className="doc-category">{categoryLabel(document.category)}</span>
              <span className="doc-chip">{visibilityLabel(document.visibility)}</span>
            </div>
          </div>

          <div className="doc-detail-actions">
            {canManage && (
              <Link href={`/documents/${document.id}/edit`} className="doc-secondary-btn">
                Edit
              </Link>
            )}
            <a href={downloadUrl} className="doc-primary-btn">
              Download File
            </a>
          </div>
        </header>

        <div className="doc-detail-grid">
          <section className="doc-card doc-preview-card">
            <div className="doc-card-head">
              <div>
                <h2>Preview</h2>
                <p>{document.fileName}</p>
              </div>
              <span className="doc-chip">{formatFileSize(document.fileSize)}</span>
            </div>

            <div className="doc-preview">
              {isImage && (
                <Image
                  src={previewUrl}
                  alt={document.title}
                  width={1200}
                  height={800}
                  unoptimized
                  className="doc-preview-image"
                />
              )}

              {isPdf && (
                <iframe
                  src={previewUrl}
                  title={`Preview ${document.title}`}
                  className="doc-preview-frame"
                />
              )}

              {!isImage && !isPdf && (
                <div className="doc-preview-fallback">
                  <span aria-hidden="true">▤</span>
                  <strong>Preview tidak tersedia</strong>
                  <p>Unduh file untuk melihat isi dokumen.</p>
                  <a href={downloadUrl} className="doc-primary-btn">
                    Download File
                  </a>
                </div>
              )}
            </div>
          </section>

          <aside className="doc-detail-side">
            <section className="doc-card">
              <div className="doc-card-head">
                <div>
                  <h2>Detail Dokumen</h2>
                  <p>Metadata dan informasi masa berlaku.</p>
                </div>
              </div>

              <dl className="doc-meta">
                <div>
                  <dt>Kategori</dt>
                  <dd>{categoryLabel(document.category)}</dd>
                </div>
                <div>
                  <dt>Pemilik</dt>
                  <dd>{document.owner?.name || "Perusahaan"}</dd>
                </div>
                <div>
                  <dt>Department</dt>
                  <dd>{document.owner?.department?.name || "—"}</dd>
                </div>
                <div>
                  <dt>Tanggal Terbit</dt>
                  <dd>{formatDate(document.issueDate)}</dd>
                </div>
                <div>
                  <dt>Tanggal Kedaluwarsa</dt>
                  <dd>
                    {formatDate(document.expiryDate)}
                    {days !== null && (
                      <small>
                        {days < 0
                          ? `Lewat ${Math.abs(days)} hari`
                          : days === 0
                            ? "Kedaluwarsa hari ini"
                            : `${days} hari lagi`}
                      </small>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Diunggah Oleh</dt>
                  <dd>{document.uploadedBy?.name || "—"}</dd>
                </div>
                <div>
                  <dt>Tanggal Upload</dt>
                  <dd>
                    {new Date(document.createdAt).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </dd>
                </div>
                <div>
                  <dt>Ukuran File</dt>
                  <dd>{formatFileSize(document.fileSize)}</dd>
                </div>
              </dl>

              {document.notes && (
                <div className="doc-notes">
                  <span>Catatan</span>
                  <p>{document.notes}</p>
                </div>
              )}
            </section>

            {canManage && (
              <section className="doc-card">
                <div className="doc-card-head">
                  <div>
                    <h2>Kelola Dokumen</h2>
                    <p>Kirim pengingat, arsipkan, atau hapus dokumen.</p>
                  </div>
                </div>
                <DocumentActions document={{ id: document.id, archived: document.archived }} />
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
