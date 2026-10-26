"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function defaultPeriod() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

export default function BudgetForm({ departments = [] }) {
  const router = useRouter();
  const initialPeriod = defaultPeriod();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    departmentId: "",
    periodStart: initialPeriod.periodStart,
    periodEnd: initialPeriod.periodEnd,
    amount: "",
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
      const response = await fetch("/api/finance/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          departmentId: form.departmentId ? Number(form.departmentId) : null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat budget.");
      }

      router.push("/finance/budgets");
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
          <h2>Budget Baru</h2>
          <p>Tentukan plafon anggaran dan periode pemakaiannya.</p>
        </div>
        <span className="doc-required-note">* wajib diisi</span>
      </div>

      {error && <div className="doc-form-error">{error}</div>}

      <div className="doc-form-grid">
        <label className="doc-field doc-field-wide">
          <span>Nama Budget *</span>
          <input
            type="text"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Contoh: Operasional Q4 2026"
            maxLength={120}
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
            <option value="">Perusahaan</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>

        <label className="doc-field">
          <span>Jumlah Budget *</span>
          <input
            type="number"
            min="1"
            step="1000"
            value={form.amount}
            onChange={(event) => update("amount", event.target.value)}
            placeholder="0"
            required
            disabled={loading}
          />
        </label>

        <label className="doc-field">
          <span>Periode Mulai *</span>
          <input
            type="date"
            value={form.periodStart}
            onChange={(event) => update("periodStart", event.target.value)}
            required
            disabled={loading}
          />
        </label>

        <label className="doc-field">
          <span>Periode Selesai *</span>
          <input
            type="date"
            value={form.periodEnd}
            onChange={(event) => update("periodEnd", event.target.value)}
            required
            disabled={loading}
          />
        </label>

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
        <Link href="/finance/budgets" className="doc-secondary-btn">
          Batal
        </Link>
        <button type="submit" className="doc-primary-btn" disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan Budget"}
        </button>
      </div>
    </form>
  );
}
