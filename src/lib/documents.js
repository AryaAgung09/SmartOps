export const DOCUMENT_CATEGORIES = [
  { value: "CONTRACT", label: "Kontrak Kerja" },
  { value: "DECREE", label: "Surat Keputusan" },
  { value: "CERTIFICATE", label: "Sertifikat" },
  { value: "WARNING_LETTER", label: "Surat Peringatan" },
  { value: "PERSONAL", label: "Dokumen Pribadi" },
  { value: "POLICY", label: "Kebijakan Perusahaan" },
  { value: "OTHER", label: "Lainnya" },
];

export const DOCUMENT_VISIBILITIES = [
  { value: "HR_ONLY", label: "HR & Admin saja" },
  { value: "EMPLOYEE", label: "Dapat dilihat karyawan" },
];

export const DOCUMENT_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRING", label: "Expiring Soon" },
  { value: "EXPIRED", label: "Expired" },
  { value: "ARCHIVED", label: "Archived" },
];

export const EXPIRY_WINDOW_DAYS = 30;

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function categoryLabel(value) {
  return DOCUMENT_CATEGORIES.find((item) => item.value === value)?.label || "Lainnya";
}

export function visibilityLabel(value) {
  return DOCUMENT_VISIBILITIES.find((item) => item.value === value)?.label || "HR & Admin saja";
}

export function statusLabel(value) {
  return DOCUMENT_STATUSES.find((item) => item.value === value)?.label || value;
}

export function isHrRole(role) {
  return role === "ADMIN" || role === "HR";
}

export function startOfToday(now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getDocumentStatus(document, now = new Date()) {
  if (document.archived) return "ARCHIVED";
  if (!document.expiryDate) return "ACTIVE";

  const today = startOfToday(now);
  const expiry = new Date(document.expiryDate);

  if (expiry < today) return "EXPIRED";

  const warningDate = addDays(today, EXPIRY_WINDOW_DAYS);
  if (expiry <= warningDate) return "EXPIRING";

  return "ACTIVE";
}

export function daysUntilExpiry(date, now = new Date()) {
  if (!date) return null;
  const diff = startOfToday(new Date(date)).getTime() - startOfToday(now).getTime();
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

export function canViewDocument(user, document) {
  if (!user || !document) return false;
  if (isHrRole(user.role)) return true;
  if (document.visibility !== "EMPLOYEE") return false;
  return document.ownerId === user.id || document.ownerId === null;
}

export function buildDocumentWhere(user, filters = {}) {
  const conditions = [];

  if (!isHrRole(user.role)) {
    conditions.push({
      visibility: "EMPLOYEE",
      OR: [{ ownerId: user.id }, { ownerId: null }],
    });
  }

  if (filters.search) {
    conditions.push({
      OR: [
        { title: { contains: filters.search } },
        { fileName: { contains: filters.search } },
        { owner: { name: { contains: filters.search } } },
      ],
    });
  }

  if (filters.category) {
    conditions.push({ category: filters.category });
  }

  if (filters.ownerId) {
    conditions.push({ ownerId: filters.ownerId });
  }

  const status = filters.status;
  if (status) {
    const today = startOfToday();
    const warningDate = addDays(today, EXPIRY_WINDOW_DAYS);

    if (status === "ARCHIVED") {
      conditions.push({ archived: true });
    } else if (status === "EXPIRED") {
      conditions.push({ archived: false, expiryDate: { lt: today } });
    } else if (status === "EXPIRING") {
      conditions.push({
        archived: false,
        expiryDate: { gte: today, lte: warningDate },
      });
    } else if (status === "ACTIVE") {
      conditions.push({
        archived: false,
        OR: [{ expiryDate: null }, { expiryDate: { gt: warningDate } }],
      });
    }
  }

  return conditions.length ? { AND: conditions } : {};
}

export function parseDateInput(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function safeFileName(name) {
  const base = String(name || "document")
    .split(/[\\/]/)
    .pop()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

  return base || "document";
}

export function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
