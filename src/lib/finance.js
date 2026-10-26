export const BUDGET_STATUSES = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "CLOSED", label: "Ditutup" },
];

export const EXPENSE_CATEGORIES = [
  { value: "OPERATIONAL", label: "Operasional" },
  { value: "PAYROLL", label: "Payroll" },
  { value: "MARKETING", label: "Marketing" },
  { value: "TRAVEL", label: "Perjalanan Dinas" },
  { value: "EQUIPMENT", label: "Peralatan" },
  { value: "SOFTWARE", label: "Software" },
  { value: "UTILITIES", label: "Utilitas" },
  { value: "OTHER", label: "Lainnya" },
];

export const EXPENSE_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Menunggu Approval" },
  { value: "APPROVED", label: "Disetujui" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "PAID", label: "Dibayar" },
];

export const INVOICE_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Terkirim" },
  { value: "PARTIALLY_PAID", label: "Dibayar Sebagian" },
  { value: "PAID", label: "Lunas" },
  { value: "OVERDUE", label: "Jatuh Tempo" },
  { value: "CANCELLED", label: "Dibatalkan" },
];

export const PAYMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "Transfer Bank" },
  { value: "CASH", label: "Tunai" },
  { value: "CHEQUE", label: "Cek" },
  { value: "CREDIT_CARD", label: "Kartu Kredit" },
  { value: "OTHER", label: "Lainnya" },
];

export const PAYMENT_DIRECTIONS = [
  { value: "OUTBOUND", label: "Pengeluaran" },
  { value: "INBOUND", label: "Pemasukan" },
];

export function canManageFinance(role) {
  return role === "ADMIN" || role === "HR";
}

export function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

export function formatCompactCurrency(value) {
  const amount = toNumber(value);
  if (Math.abs(amount) >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(1)} M`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1)} jt`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `Rp ${(amount / 1_000).toFixed(0)} rb`;
  }
  return formatCurrency(amount);
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateInput(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function parseDateInput(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function monthStart(value = new Date()) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function monthEnd(value = new Date()) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function addMonths(value, amount) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

export function monthLabel(value) {
  return new Date(value).toLocaleDateString("id-ID", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

export function categoryLabel(value) {
  return EXPENSE_CATEGORIES.find((item) => item.value === value)?.label || value || "-";
}

export function expenseStatusLabel(value) {
  return EXPENSE_STATUSES.find((item) => item.value === value)?.label || value || "-";
}

export function invoiceStatusLabel(value) {
  return INVOICE_STATUSES.find((item) => item.value === value)?.label || value || "-";
}

export function paymentMethodLabel(value) {
  return PAYMENT_METHODS.find((item) => item.value === value)?.label || value || "-";
}

export function paymentDirectionLabel(value) {
  return PAYMENT_DIRECTIONS.find((item) => item.value === value)?.label || value || "-";
}

export function paidAmount(payments = []) {
  return payments.reduce((total, payment) => total + toNumber(payment.amount), 0);
}

export function getInvoiceState(invoice) {
  if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") {
    return invoice.status;
  }

  const paid = paidAmount(invoice.payments);
  const total = toNumber(invoice.amount);

  if (paid >= total && total > 0) return "PAID";
  if (paid > 0) return "PARTIALLY_PAID";
  if (invoice.dueDate && new Date(invoice.dueDate) < startOfToday()) return "OVERDUE";
  return invoice.status === "OVERDUE" ? "OVERDUE" : "SENT";
}

export function withInvoiceTotals(invoice) {
  const paid = paidAmount(invoice.payments);
  return {
    ...invoice,
    paid,
    outstanding: Math.max(toNumber(invoice.amount) - paid, 0),
    displayStatus: getInvoiceState(invoice),
  };
}

export function statusClass(value) {
  return String(value || "").toLowerCase().replaceAll("_", "-");
}

export function budgetUsage(amount, spent) {
  const total = toNumber(amount);
  const used = toNumber(spent);
  const percent = total > 0 ? Math.min(Math.round((used / total) * 100), 999) : 0;
  return {
    spent: used,
    remaining: total - used,
    percent,
  };
}

export function cleanText(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}
