import { ROLES } from "@/lib/roles";

export { ROLES, ROLE_LABELS, ROLE_OPTIONS, roleLabel } from "@/lib/roles";

const ALL_ROLES = ROLES;
const HR_ROLES = ["ADMIN", "HR"];
const FINANCE_ROLES = ["ADMIN", "FINANCE", "HR"];
const ADMIN_ROLES = ["ADMIN"];

export const FEATURE_SECTIONS = [
  {
    label: "Overview",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: "dashboard",
        defaultRoles: ALL_ROLES,
        fixedRoles: ALL_ROLES,
      },
      {
        key: "notifications",
        label: "Notifications",
        href: "/notifications",
        icon: "bell",
        defaultRoles: ALL_ROLES,
        fixedRoles: ALL_ROLES,
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        key: "hr-dashboard",
        label: "HR Dashboard",
        href: "/hr-dashboard",
        icon: "briefcase",
        defaultRoles: HR_ROLES,
      },
      {
        key: "employees",
        label: "Employees",
        href: "/employees",
        icon: "employees",
        defaultRoles: HR_ROLES,
      },
      {
        key: "users",
        label: "Users",
        href: "/users",
        icon: "users",
        defaultRoles: HR_ROLES,
      },
      {
        key: "my-profile",
        label: "My Profile",
        href: "/my-profile",
        icon: "profile",
        defaultRoles: ALL_ROLES,
        fixedRoles: ALL_ROLES,
      },
    ],
  },
  {
    label: "Time & Attendance",
    items: [
      {
        key: "attendance",
        label: "Attendance",
        href: "/attendance",
        icon: "clock",
        defaultRoles: ALL_ROLES,
      },
      {
        key: "attendance-report",
        label: "Attendance Report",
        href: "/attendance/report",
        icon: "report",
        defaultRoles: ALL_ROLES,
      },
      {
        key: "attendance-corrections",
        label: "Correction Requests",
        href: "/attendance/corrections",
        icon: "edit",
        defaultRoles: ALL_ROLES,
      },
      {
        key: "leaves",
        label: "Leave & Time-Off",
        href: "/leaves",
        icon: "calendar",
        defaultRoles: ALL_ROLES,
      },
      {
        key: "requests",
        label: "Requests",
        href: "/requests",
        icon: "inbox",
        defaultRoles: ALL_ROLES,
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        key: "finance",
        label: "Finance",
        href: "/finance",
        icon: "finance",
        defaultRoles: FINANCE_ROLES,
      },
    ],
  },
  {
    label: "Payroll",
    items: [
      {
        key: "payroll",
        label: "Payroll",
        href: "/payroll",
        icon: "banknote",
        defaultRoles: ALL_ROLES,
      },
      {
        key: "payroll-periods",
        label: "Payroll Periods",
        href: "/payroll/periods",
        icon: "calendar-check",
        defaultRoles: HR_ROLES,
      },
      {
        key: "my-payroll",
        label: "My Payroll",
        href: "/my-payroll",
        icon: "receipt",
        defaultRoles: ALL_ROLES,
      },
    ],
  },
  {
    label: "Documents",
    items: [
      {
        key: "documents",
        label: "Document Center",
        href: "/documents",
        icon: "folder",
        defaultRoles: ALL_ROLES,
      },
      {
        key: "documents-upload",
        label: "Upload Document",
        href: "/documents/new",
        icon: "upload",
        defaultRoles: HR_ROLES,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        key: "access-control",
        label: "Feature Access",
        href: "/access-control",
        icon: "shield",
        defaultRoles: ADMIN_ROLES,
        fixedRoles: ADMIN_ROLES,
      },
    ],
  },
];

export const FEATURES = FEATURE_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.label }))
);

export const FEATURE_BY_KEY = Object.fromEntries(
  FEATURES.map((feature) => [feature.key, feature])
);

const ROUTE_FEATURES = [...FEATURES]
  .filter((feature) => feature.href)
  .sort((a, b) => b.href.length - a.href.length);

export function defaultFeatureRoles(key) {
  return FEATURE_BY_KEY[key]?.defaultRoles || [];
}

export function fixedFeatureValue(key, role) {
  const feature = FEATURE_BY_KEY[key];
  if (!feature?.fixedRoles) return null;
  return feature.fixedRoles.includes(role);
}

export function isFeatureLocked(key) {
  return Boolean(FEATURE_BY_KEY[key]?.fixedRoles);
}

export function routeFeatureKey(pathname) {
  const cleanPath = String(pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  const feature = ROUTE_FEATURES.find(
    (item) => cleanPath === item.href || cleanPath.startsWith(`${item.href}/`)
  );
  return feature?.key || null;
}
