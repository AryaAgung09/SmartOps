"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  REQUEST_TYPES,
  getRequestType,
} from "@/lib/requestTypes";
import { DOCUMENT_CATEGORIES } from "@/lib/documents";

export default function CreateRequestPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "IT_SUPPORT",
    documentCategory: "",
  });

  const selectedType = getRequestType(form.type);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setError("");

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!form.title.trim()) {
      setError("Judul request wajib diisi.");
      return;
    }

    if (!form.type) {
      setError("Tipe request wajib dipilih.");
      return;
    }

    if (!form.description.trim()) {
      setError("Deskripsi request wajib diisi.");
      return;
    }

    if (
      form.type === "ADMINISTRATIVE" &&
      !form.documentCategory
    ) {
      setError("Kategori dokumen wajib dipilih.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          type: form.type,
          documentCategory:
            form.type === "ADMINISTRATIVE"
              ? form.documentCategory
              : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Gagal membuat request."
        );
      }

      router.push("/requests");
      router.refresh();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="page-header request-create-header">
        <div>
          
          <h1>Ajukan Request</h1>

          
        </div>
      </div>

      <div className="request-create-card form-card">
        <form onSubmit={handleSubmit}>
          <div className="request-form-section">
            <div className="request-form-section-heading">
              <div>
                <h2>Informasi Request</h2>
                <p>Lengkapi detail utama agar request lebih mudah diproses.</p>
              </div>
              <span className="request-required-note">* Wajib diisi</span>
            </div>

            <div className="request-form-grid">
              <div className="form-group request-form-title-field">
                <label htmlFor="title">
                  Judul Request <span>*</span>
                </label>

                <input
                  id="title"
                  name="title"
                  type="text"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Contoh: Permintaan perbaikan laptop kantor"
                  disabled={loading}
                  required
                />
                <small>Gunakan judul singkat yang langsung menjelaskan kebutuhan.</small>
              </div>

              <div className="form-group">
                <label htmlFor="type">
                  Tipe Request <span>*</span>
                </label>

                <select
                  id="type"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  disabled={loading}
                  required
                >
                  {REQUEST_TYPES.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedType && (
              <div className="request-context-note">
                <span className="request-context-icon">i</span>
                <div>
                  <strong>{selectedType.label}</strong>
                  <p>{selectedType.description}</p>
                  <p>
                    Alur approval:{" "}
                    {selectedType.workflow.join(" -> ")}
                  </p>
                </div>
              </div>
            )}

            {form.type === "ADMINISTRATIVE" && (
              <div className="form-group">
                <label htmlFor="documentCategory">
                  Kategori Dokumen <span>*</span>
                </label>

                <select
                  id="documentCategory"
                  name="documentCategory"
                  value={form.documentCategory}
                  onChange={handleChange}
                  disabled={loading}
                  required
                >
                  <option value="">Pilih Kategori Dokumen</option>

                  {DOCUMENT_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <small>
                  HR akan mengunggah dokumen setelah request disetujui.
                </small>
              </div>
            )}

            <div className="form-group request-description-field">
              <div className="request-field-heading">
                <label htmlFor="description">
                  Deskripsi <span>*</span>
                </label>
                <small>{form.description.length} karakter</small>
              </div>

              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Jelaskan masalah, kebutuhan, atau alasan pengajuan request..."
                rows={7}
                disabled={loading}
                required
              />
              <small>Jelaskan masalah, kebutuhan, atau alasan pengajuan request.</small>
            </div>
          </div>

          <div className="request-form-section request-form-context">
            <div className="request-form-section-heading">
              <div>
                <h2>Informasi Pengajuan</h2>
                <p>Informasi organisasi akan mengikuti profil Anda secara otomatis.</p>
              </div>
            </div>
            <div className="request-context-note">
              <span className="request-context-icon">i</span>
              <div>
                <strong>Unit kerja</strong>
                <p>Department request akan ditentukan dari data profil Anda oleh sistem.</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="form-error request-form-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => router.push("/requests")}
              disabled={loading}
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Mengajukan..."
                : "Ajukan Request"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
