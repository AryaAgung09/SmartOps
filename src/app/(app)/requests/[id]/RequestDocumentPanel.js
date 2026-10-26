"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  categoryLabel,
  formatFileSize,
} from "@/lib/documents";

export default function RequestDocumentPanel({
  requestId,
  category,
  fileName,
  fileSize,
  fulfilledAt,
  canUpload,
}) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleUpload(event) {
    event.preventDefault();

    if (!file) {
      setError("Pilih file dokumen terlebih dahulu.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/requests/${requestId}/document`,
        {
          method: "POST",
          body: formData,
        }
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Gagal mengunggah dokumen."
        );
      }

      setFile(null);
      setMessage(result.message || "Dokumen berhasil diunggah.");
      router.refresh();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="dashboard-section">
      <div className="section-header">
        <div>
          <h2>Dokumen Request</h2>
          <p>
            Kategori: <strong>{categoryLabel(category)}</strong>
          </p>
        </div>
      </div>

      {fileName ? (
        <div className="document-result">
          <div>
            <strong>{fileName}</strong>
            <span>
              {formatFileSize(fileSize)} -{" "}
              {fulfilledAt
                ? new Date(fulfilledAt).toLocaleString("id-ID")
                : "-"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <a
              className="secondary-button"
              href={`/api/requests/${requestId}/document?inline=1`}
              target="_blank"
              rel="noreferrer"
            >
              Buka
            </a>
            <a
              className="primary-button"
              href={`/api/requests/${requestId}/document`}
            >
              Unduh
            </a>
          </div>
        </div>
      ) : (
        <p className="approval-next-info">
          {canUpload
            ? "Request telah disetujui. Unggah dokumen agar dapat diakses oleh pemilik request."
            : "Dokumen belum tersedia. HR akan mengunggah dokumen setelah request disetujui."}
        </p>
      )}

      {canUpload && (
        <form
          onSubmit={handleUpload}
          style={{ marginTop: "16px" }}
        >
          <div className="form-group">
            <label htmlFor="request-file">
              {fileName ? "Ganti dokumen" : "Unggah dokumen"}
            </label>
            <input
              id="request-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(event) =>
                setFile(event.target.files?.[0] || null)
              }
              disabled={loading}
            />
            <small>Maksimal 10 MB.</small>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Mengunggah..." : "Unggah Dokumen"}
          </button>
        </form>
      )}

      {message && <div className="form-success">{message}</div>}
      {error && <div className="form-error">{error}</div>}
    </section>
  );
}
