export const ROLES = [
  "ADMIN",
  "STAFF",
  "HR",
  "IT",
  "FINANCE",
  "GENERAL_AFFAIR",
  "MARKETING",
  "SALES",
  "LOGISTICS",
  "OUTSOURCING",
];

export const ROLE_LABELS = {
  ADMIN: "Admin",
  STAFF: "Staf",
  HR: "HR",
  IT: "IT",
  FINANCE: "Finance",
  GENERAL_AFFAIR: "General Affair",
  MARKETING: "Marketing",
  SALES: "Sales",
  LOGISTICS: "Logistics",
  OUTSOURCING: "Outsourcing",
};

export const ROLE_OPTIONS = ROLES.map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

const PROTECTED_ROLES = ["ADMIN", "HR"];

export const HR_ASSIGNABLE_ROLES = ROLES.filter((role) => !PROTECTED_ROLES.includes(role));

export const HR_ASSIGNABLE_ROLE_OPTIONS = ROLE_OPTIONS.filter((item) =>
  HR_ASSIGNABLE_ROLES.includes(item.value)
);

export function roleLabel(value) {
  return ROLE_LABELS[value] || value || "-";
}

export function isHrRole(role) {
  return role === "ADMIN" || role === "HR";
}

export function isApproverRole(role) {
  return ROLES.includes(role);
}
