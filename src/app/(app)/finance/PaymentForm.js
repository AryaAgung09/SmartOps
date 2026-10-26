"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PAYMENT_DIRECTIONS,
  PAYMENT_METHODS,
  formatCurrency,
} from "@/lib/finance";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function targetKey(type, id) {
  return id ? `${type}:${id}` : "";
}

export default function PaymentForm({
  targets = { invoices: [], expenses: [], vendors: [] },
  defaultInvoiceId = null,
  defaultExpenseId = null,
  lockTarget = false,
}) {
  const router = useRouter();
  const invoices = targets.invoices || [];
  const expenses = targets.expenses || [];
  const vendors = targets.vendors || [];

  const initialType = defaultInvoiceId
    ? "invoice"
    : defaultExpenseId
      ? "expense"
      : invoices.length
        ? "invoice"
        : expenses.length
          ? "expense"
          : "standalone";
  const initialId =
    defaultInvoiceId ||
    defaultExpenseId ||
    (initialType === "invoice" ? invoices[0]?.id : initialType === "expense" ? expenses[0]?.id : null);
  const initialTarget =
    initialType === "invoice"
      ? invoices.find((invoice) => invoice.id === initialId)
      : initialType === "expense"
        ? expenses.find((expense) => expense.id === initialId)
        : null;

  const [targetType, setTargetType] = useState(initialType);
  const [targetId, setTargetId] = useState(initialId ? String(initialId) : "");
  const [direction, setDirection] = useState("OUTBOUND");
  const [form, setForm] = useState({
    amount: initialTarget ? String(initialTarget.outstanding) : "",
    paymentDate: today(),
    method: "BANK_TRANSFER",
    reference: "",
    notes: "",
    vendorId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedInvoice = targetType === "invoice"
    ? invoices.find((invoice) => String(invoice.id) === targetId)
    : null;
  const selectedExpense = targetType === "expense"
    ? expenses.find((expense) => String(expense.id) === targetId)
    : null;
  const remaining = selectedInvoice?.outstanding || selectedExpense?.outstanding || 0;
  const options = targetType === "invoice" ? invoices : targetType === "expense" ? expenses : [];
  const locked = lockTarget && (defaultInvoiceId || defaultExpenseId);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectType(type) {
    setTargetType(type);
    const list = type === "invoice" ? invoices : type === "expense" ? expenses : [];
    const first = list[0];
    setTargetId(first ? String(first.id) : "");
    update("amount", first?.outstanding ? String(first.outstanding) : "");
    setMessage("");
  }

  function selectTarget(value) {
    setTargetId(value);
    const list = targetType === "invoice" ? invoices : expenses;
    const target = list.find((item) => String(item.id) === value);
    update("amount", target?.outstanding ? String(target.outstanding) : "");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const payload = {
        amount: Number(form.amount),
        paymentDate: form.paymentDate,
        method: form.method,
        reference: form.reference,
        notes: form.notes,
      };

      if (targetType === "invoice") {
        payload.invoiceId = Number(targetId);
      } else if (targetType === "expense") {
        payload.expenseId = Number(targetId);
      } else {
        payload.direction = direction;
        if (form.vendorId) payload.vendorId = Number(form.vendorId);
      }

      const response = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mencatat pembayaran.");
      }

      setMessage("Pembayaran berhasil dicatat.");
      setForm((current) => ({
        ...current,
        amount: "",
        reference: "",
        notes: "",
      }));
      router.refresh();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="fin-payment-form" onSubmit={handleSubmit}>
      <div className="doc-form-head">
        <div>
          <h2>Catat Pembayaran</h2>
          <p>Pembayaran invoice dan pengeluaran otomatis memperbarui status.</p>
        </div>
      </div>

      {error && <div className="doc-form-error">{error}</div>}
      {message && <div className="fin-success-message">{message}</div>}

      <div className="doc-form-grid">
        {!locked && (
          <label className="doc-field">
            <span>Jenis Pembayaran</span>
            <select value={targetType} onChange={(event) => selectType(event.target.value)} disabled={loading}>
              <option value="invoice">Bayar Invoice</option>
              <option value="expense">Bayar Pengeluaran</option>
              <option value="standalone">Pemasukan / Pengeluaran Lain</option>
            </select>
          </label>
        )}

        {targetType !== "standalone" ? (
          <label className="doc-field">
            <span>{targetType === "invoice" ? "Invoice" : "Pengeluaran"} *</span>
            <select
              value={targetId}
              onChange={(event) => selectTarget(event.target.value)}
              required
              disabled={loading || locked}
            >
              {options.length === 0 && <option value="">Tidak ada tagihan terbuka</option>}
              {options.map((item) => (
                <option key={item.id} value={item.id}>
                  {targetType === "invoice"
                    ? `${item.invoiceNumber} - ${item.vendor?.name || "Vendor"}`
                    : `${item.title} - ${item.vendor?.name || "Tanpa vendor"}`}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="doc-field">
              <span>Arah</span>
              <select
                value={direction}
                onChange={(event) => setDirection(event.target.value)}
                disabled={loading}
              >
                {PAYMENT_DIRECTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
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
          </>
        )}

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
          {remaining > 0 && (
            <small className="fin-field-hint">Sisa tagihan: {formatCurrency(remaining)}</small>
          )}
        </label>

        <label className="doc-field">
          <span>Tanggal Pembayaran *</span>
          <input
            type="date"
            value={form.paymentDate}
            onChange={(event) => update("paymentDate", event.target.value)}
            required
            disabled={loading}
          />
        </label>

        <label className="doc-field">
          <span>Metode</span>
          <select
            value={form.method}
            onChange={(event) => update("method", event.target.value)}
            disabled={loading}
          >
            {PAYMENT_METHODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="doc-field">
          <span>Referensi</span>
          <input
            type="text"
            value={form.reference}
            onChange={(event) => update("reference", event.target.value)}
            placeholder="No. transfer / cek"
            maxLength={120}
            disabled={loading}
          />
        </label>

        <label className="doc-field doc-field-wide">
          <span>Catatan</span>
          <textarea
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            rows={2}
            maxLength={2000}
            disabled={loading}
          />
        </label>
      </div>

      <div className="doc-form-actions">
        <button
          type="submit"
          className="doc-primary-btn"
          disabled={loading || (targetType !== "standalone" && !targetId)}
        >
          {loading ? "Menyimpan..." : "Simpan Pembayaran"}
        </button>
      </div>
    </form>
  );
}
