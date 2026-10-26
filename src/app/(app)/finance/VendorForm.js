"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function VendorForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    taxNumber: "",
    notes: "",
  });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/finance/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal menambah vendor.");
      }

      router.push("/finance/vendors");
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
          <h2>Vendor Baru</h2>
          <p>Simpan data pemasok untuk invoice dan pengeluaran perusahaan.</p>
        </div>
        <span className="doc-required-note">* wajib diisi</span>
      </div>

      {error && <div className="doc-form-error">{error}</div>}

      <div className="doc-form-grid">
        <label className="doc-field">
          <span>Nama Vendor *</span>
          <input
            type="text"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            maxLength={120}
            required
            disabled={loading}
          />
        </label>

        <label className="doc-field">
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            maxLength={160}
            disabled={loading}
          />
        </label>

        <label className="doc-field">
          <span>Telepon</span>
          <input
            type="text"
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            maxLength={40}
            disabled={loading}
          />
        </label>

        <label className="doc-field">
          <span>NPWP / Tax Number</span>
          <input
            type="text"
            value={form.taxNumber}
            onChange={(event) => update("taxNumber", event.target.value)}
            maxLength={80}
            disabled={loading}
          />
        </label>

        <label className="doc-field doc-field-wide">
          <span>Alamat</span>
          <textarea
            value={form.address}
            onChange={(event) => update("address", event.target.value)}
            rows={3}
            maxLength={1000}
            disabled={loading}
          />
        </label>

        <label className="doc-field doc-field-wide">
          <span>Catatan</span>
          <textarea
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            rows={4}
            maxLength={2000}
            disabled={loading}
          />
        </label>
      </div>

      <div className="doc-form-actions">
        <Link href="/finance/vendors" className="doc-secondary-btn">
          Batal
        </Link>
        <button type="submit" className="doc-primary-btn" disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan Vendor"}
        </button>
      </div>
    </form>
  );
}
