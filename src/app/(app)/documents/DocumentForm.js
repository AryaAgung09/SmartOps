"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_VISIBILITIES,
  formatFileSize,
} from "@/lib/documents";

export default function DocumentForm({ mode = "create", document = null, employees = [] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: document?.title || "",
    category: document?.category || "CONTRACT",
    ownerId: document?.ownerId ? String(document.ownerId) : "",
    visibility: document?.visibility || "HR_ONLY",
    issueDate: document?.issueDate || "",
    expiryDate: document?.expiryDate || "",
    notes: document?.notes || "",
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (mode === "create" && !file) {
      setError("File dokumen wajib diunggah.");
      return;
    }

    setLoading(true);

    try {
      let response;

      if (mode === "create") {
        const payload = new FormData();
        payload.set("title", form.title);
        payload.set("category", form.category);
        payload.set("ownerId", form.ownerId);
        payload.set("visibility", form.visibility);
        payload.set("issueDate", form.issueDate);
        payload.set("expiryDate", form.expiryDate);
        payload.set("notes", form.notes);
        payload.set("file", file);

        response = await fetch("/api/documents", {
          method: "POST",
          body: payload,
        });
      } else {
        response = await fetch(`/api/documents/${document.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            category: form.category,
            ownerId: form.ownerId ? Number(form.ownerId) : null,
            visibility: form.visibility,
            issueDate: form.issueDate,
            expiryDate: form.expiryDate,
            notes: form.notes,
          }),
        });
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal menyimpan dokumen.");
      }

      router.push(`/documents/${result.data.id}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="doc-form" onSubmit={handleSubmit}>
      <div className="doc-form-head">
        <div>
          <h2>{mode === "create" ? "Upload Dokumen Baru" : "Edit Dokumen"}</h2>
          <p>
            {mode === "create"
              ? "Lengkapi metadata dokumen sebelum mengunggah file."
              : "Perbarui metadata dokumen. File yang sudah ada tidak berubah."}
          </p>
        </div>
        <span className="doc-required-note">* wajib diisi</span>
      </div>

      {error && <div className="doc-form-error">{error}</div>}

      <div className="doc-form-grid">
        <label className="doc-field doc-field-wide">
          <span>Judul Dokumen *</span>
          <input
            type="text"
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Contoh: Kontrak Kerja - Budi Santoso 2026"
            maxLength={160}
            required
            disabled={loading}
          />
        </label>

        <label className="doc-field">
          <span>Kategori *</span>
          <select
            value={form.category}
            onChange={(event) => update("category", event.target.value)}
            required
            disabled={loading}
          >
            {DOCUMENT_CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="doc-field">
          <span>Pemilik Dokumen</span>
          <select
            value={form.ownerId}
            onChange={(event) => update("ownerId", event.target.value)}
            disabled={loading}
          >
            <option value="">Perusahaan / tanpa pemilik</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} — {employee.email}
              </option>
            ))}
          </select>
        </label>

        <label className="doc-field">
          <span>Tanggal Terbit</span>
          <input
            type="date"
            value={form.issueDate}
            onChange={(event) => update("issueDate", event.target.value)}
            disabled={loading}
          />
        </label>

        <label className="doc-field">
          <span>Tanggal Kedaluwarsa</span>
          <input
            type="date"
            value={form.expiryDate}
            onChange={(event) => update("expiryDate", event.target.value)}
            disabled={loading}
          />
        </label>

        <label className="doc-field">
          <span>Visibilitas *</span>
          <select
            value={form.visibility}
            onChange={(event) => update("visibility", event.target.value)}
            required
            disabled={loading}
          >
            {DOCUMENT_VISIBILITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="doc-field doc-field-wide">
          <span>Catatan</span>
          <textarea
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Catatan tambahan, nomor dokumen, atau informasi penting lainnya."
            rows={4}
            maxLength={5000}
            disabled={loading}
          />
        </label>

        {mode === "create" ? (
          <label className="doc-field doc-field-wide">
            <span>File Dokumen *</span>
            <div className="doc-file-input">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
                disabled={loading}
              />
              <p>PDF, JPG, PNG, WEBP, DOC/DOCX, atau XLS/XLSX. Maksimal 10 MB.</p>
            </div>
            {file && (
              <span className="doc-selected-file">
                {file.name} · {formatFileSize(file.size)}
              </span>
            )}
          </label>
        ) : (
          <div className="doc-field doc-field-wide">
            <span>File Saat Ini</span>
            <div className="doc-existing-file">
              <span aria-hidden="true">▤</span>
              <div>
                <strong>{document?.fileName}</strong>
                <small>{formatFileSize(document?.fileSize || 0)}</small>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="doc-form-actions">
        <Link
          href={mode === "edit" ? `/documents/${document.id}` : "/documents"}
          className="doc-secondary-btn"
        >
          Batal
        </Link>
        <button type="submit" className="doc-primary-btn" disabled={loading}>
          {loading ? "Menyimpan..." : mode === "create" ? "Upload Dokumen" : "Simpan Perubahan"}
        </button>
      </div>
    </form>
  );
}
