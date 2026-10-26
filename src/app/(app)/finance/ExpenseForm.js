"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES } from "@/lib/finance";

function dateValue(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

export default function ExpenseForm({
  mode = "create",
  expense = null,
  departments = [],
  vendors = [],
  budgets = [],
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: expense?.title || "",
    category: expense?.category || "OPERATIONAL",
    amount: expense ? String(Number(expense.amount)) : "",
    expenseDate: dateValue(expense?.expenseDate),
    departmentId: expense?.departmentId ? String(expense.departmentId) : "",
    vendorId: expense?.vendorId ? String(expense.vendorId) : "",
    budgetId: expense?.budgetId ? String(expense.budgetId) : "",
    status: mode === "create" ? "PENDING" : expense?.status || "PENDING",
    notes: expense?.notes || "",
  });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        title: form.title,
        category: form.category,
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        vendorId: form.vendorId ? Number(form.vendorId) : null,
        budgetId: form.budgetId ? Number(form.budgetId) : null,
        notes: form.notes,
      };

      if (mode === "create") payload.status = form.status;

      const response = await fetch(
        mode === "create" ? "/api/finance/expenses" : `/api/finance/expenses/${expense.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal menyimpan pengeluaran.");
      }

      router.push("/finance/expenses");
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
          <h2>{mode === "create" ? "Catat Pengeluaran" : "Edit Pengeluaran"}</h2>
          <p>
            {mode === "create"
              ? "Pengeluaran akan masuk ke alur approval sebelum dapat dibayar."
              : "Perubahan hanya tersedia sebelum pengeluaran disetujui."}
          </p>
        </div>
        <span className="doc-required-note">* wajib diisi</span>
      </div>

      {error && <div className="doc-form-error">{error}</div>}

      <div className="doc-form-grid">
        <label className="doc-field doc-field-wide">
          <span>Judul Pengeluaran *</span>
          <input
            type="text"
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Contoh: Pembelian lisensi software tim finance"
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
            {EXPENSE_CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="doc-field">
          <span>Jumlah *</span>
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
          <span>Tanggal Pengeluaran *</span>
          <input
            type="date"
            value={form.expenseDate}
            onChange={(event) => update("expenseDate", event.target.value)}
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
          <span>Vendor</span>
          <select
            value={form.vendorId}
            onChange={(event) => update("vendorId", event.target.value)}
            disabled={loading}
          >
            <option value="">Tanpa vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </label>

        <label className="doc-field">
          <span>Budget</span>
          <select
            value={form.budgetId}
            onChange={(event) => update("budgetId", event.target.value)}
            disabled={loading}
          >
            <option value="">Tanpa budget</option>
            {budgets.map((budget) => (
              <option key={budget.id} value={budget.id}>
                {budget.name}
              </option>
            ))}
          </select>
        </label>

        {mode === "create" && (
          <label className="doc-field">
            <span>Status Awal</span>
            <select
              value={form.status}
              onChange={(event) => update("status", event.target.value)}
              disabled={loading}
            >
              <option value="PENDING">Ajukan untuk approval</option>
              <option value="DRAFT">Simpan sebagai draft</option>
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
        <Link href="/finance/expenses" className="doc-secondary-btn">
          Batal
        </Link>
        <button type="submit" className="doc-primary-btn" disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan Pengeluaran"}
        </button>
      </div>
    </form>
  );
}
