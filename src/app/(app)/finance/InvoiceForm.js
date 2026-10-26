"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function dateValue(value, fallback = null) {
  if (!value) return fallback || new Date().toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function InvoiceForm({
  mode = "create",
  invoice = null,
  departments = [],
  vendors = [],
}) {
  const router = useRouter();
  const initialIssueDate = dateValue(invoice?.issueDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    invoiceNumber: invoice?.invoiceNumber || "",
    vendorId: invoice?.vendorId ? String(invoice.vendorId) : "",
    departmentId: invoice?.departmentId ? String(invoice.departmentId) : "",
    issueDate: initialIssueDate,
    dueDate: dateValue(invoice?.dueDate, addDays(initialIssueDate, 30)),
    amount: invoice ? String(Number(invoice.amount)) : "",
    status: invoice?.status || "DRAFT",
    notes: invoice?.notes || "",
  });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleIssueDate(value) {
    setForm((current) => ({
      ...current,
      issueDate: value,
      dueDate: current.dueDate === addDays(current.issueDate, 30) ? addDays(value, 30) : current.dueDate,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        invoiceNumber: form.invoiceNumber,
        vendorId: form.vendorId ? Number(form.vendorId) : null,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        amount: Number(form.amount),
        notes: form.notes,
      };
      if (mode === "create") payload.status = form.status;

      const response = await fetch(
        mode === "create" ? "/api/finance/invoices" : `/api/finance/invoices/${invoice.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal menyimpan invoice.");
      }

      router.push("/finance/invoices");
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
          <h2>{mode === "create" ? "Invoice Baru" : "Edit Invoice"}</h2>
          <p>Catat tagihan vendor beserta jatuh tempo pembayarannya.</p>
        </div>
        <span className="doc-required-note">* wajib diisi</span>
      </div>

      {error && <div className="doc-form-error">{error}</div>}

      <div className="doc-form-grid">
        <label className="doc-field">
          <span>Nomor Invoice *</span>
          <input
            type="text"
            value={form.invoiceNumber}
            onChange={(event) => update("invoiceNumber", event.target.value)}
            placeholder="INV-2026-001"
            maxLength={80}
            required
            disabled={loading}
          />
        </label>

        <label className="doc-field">
          <span>Vendor *</span>
          <select
            value={form.vendorId}
            onChange={(event) => update("vendorId", event.target.value)}
            required
            disabled={loading}
          >
            <option value="">Pilih vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </label>

        <label className="doc-field">
          <span>Jumlah Invoice *</span>
          <input
            type="number"
            min="1"
            step="1000"
            value={form.amount}
            onChange={(event) => update("amount", event.target.value)}
            required
            disabled={loading}
          />
        </label>

        <label className="doc-field">
          <span>Departemen</span>
          <select
            value={form.departmentId}
            onChange={(event) => update("departmentId", event.target.value)}
            disabled={loading}
          >
            <option value="">Tidak ditentukan</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>

        <label className="doc-field">
          <span>Tanggal Invoice *</span>
          <input
            type="date"
            value={form.issueDate}
            onChange={(event) => handleIssueDate(event.target.value)}
            required
            disabled={loading}
          />
        </label>

        <label className="doc-field">
          <span>Jatuh Tempo *</span>
          <input
            type="date"
            value={form.dueDate}
            onChange={(event) => update("dueDate", event.target.value)}
            required
            disabled={loading}
          />
        </label>

        {mode === "create" && (
          <label className="doc-field">
            <span>Status Awal</span>
            <select
              value={form.status}
              onChange={(event) => update("status", event.target.value)}
              disabled={loading}
            >
              <option value="DRAFT">Draft</option>
              <option value="SENT">Terkirim</option>
            </select>
          </label>
        )}

        <label className="doc-field doc-field-wide">
          <span>Catatan</span>
          <textarea
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            rows={4}
            maxLength={5000}
            disabled={loading}
          />
        </label>
      </div>

      <div className="doc-form-actions">
        <Link href="/finance/invoices" className="doc-secondary-btn">
          Batal
        </Link>
        <button type="submit" className="doc-primary-btn" disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan Invoice"}
        </button>
      </div>
    </form>
  );
}
