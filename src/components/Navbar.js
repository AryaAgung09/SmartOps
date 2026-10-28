"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";

const contexts = {
  "/dashboard": "Operations overview",
  "/hr-dashboard": "People analytics",
  "/employees": "Employee directory",
  "/employees/create": "Add employee",
  "/employees/import": "Import employees",
  "/users": "Access and user management",
  "/users/create": "Add user",
  "/requests": "Workflow requests",
  "/requests/create": "Create request",
  "/attendance": "Time and attendance",
  "/attendance/report": "Attendance report",
  "/attendance/corrections": "Attendance corrections",
  "/leaves": "Leave management",
  "/payroll": "Payroll operations",
  "/payroll/periods": "Payroll periods",
  "/my-payroll": "Personal payroll statement",
  "/documents": "Document and contract management",
  "/documents/new": "Upload document",
  "/notifications": "Updates and notifications",
  "/my-profile": "Personal profile",
  "/finance": "Finance and cash flow",
  "/access-control": "Role feature access",
};

const breadcrumbLabels = {
  "hr-dashboard": "HR Dashboard",
  employees: "Employees",
  users: "Users",
  requests: "Requests",
  attendance: "Attendance",
  corrections: "Corrections",
  report: "Report",
  leaves: "Leave",
  payroll: "Payroll",
  periods: "Periods",
  "my-payroll": "My Payroll",
  documents: "Documents",
  new: "New",
  create: "Create",
  import: "Import",
  notifications: "Notifications",
  "my-profile": "My Profile",
  finance: "Finance",
  budgets: "Budgets",
  expenses: "Expenses",
  invoices: "Invoices",
  payments: "Payments",
  vendors: "Vendors",
  "access-control": "Feature Access",
  dashboard: "Dashboard",
  edit: "Edit",
};

function isDynamicSegment(segment) {
  return /^\d+$/.test(segment) || /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(segment);
}

function buildBreadcrumbs(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.flatMap((segment, index) => {
    if (isDynamicSegment(segment)) return [];

    return [{
      label: breadcrumbLabels[segment] || segment.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      href: `/${segments.slice(0, index + 1).join("/")}`,
    }];
  });
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const context = Object.entries(contexts)
    .sort(([first], [second]) => second.length - first.length)
    .find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  const breadcrumbs = buildBreadcrumbs(pathname);

  useEffect(() => {
    let cancelled = false;
    async function loadUnread() {
      try {
        const response = await fetch("/api/notifications/unread", { cache: "no-store" });
        const result = await response.json();
        if (!cancelled && result.success) setUnreadCount(Number(result.data?.count || 0));
      } catch (error) {
        // Keep the topbar available when notifications are unavailable.
      }
    }
    loadUnread();
    const handleRefresh = () => loadUnread();
    window.addEventListener("notifications:changed", handleRefresh);
    return () => { cancelled = true; window.removeEventListener("notifications:changed", handleRefresh); };
  }, []);

  return (
    <header className="navbar">
      <div className="navbar-context">
        <span className="navbar-kicker">SMARTOPS</span>
        <nav className="navbar-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/dashboard">Workspace</Link>
          {breadcrumbs.map((item, index) => (
            <span className="navbar-breadcrumb-item" key={`${item.href}-${index}`}>
              <span aria-hidden="true">/</span>
              {index === breadcrumbs.length - 1 ? (
                <span aria-current="page">{item.label}</span>
              ) : (
                <Link href={item.href}>{item.label}</Link>
              )}
            </span>
          ))}
        </nav>
        <h1>{context?.[1] || "Operations workspace"}</h1>
      </div>
      <div className="navbar-actions">
        <Link
          href="/notifications"
          className="notification-link"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        >
          <span className="notification-icon-wrapper">
            <BellIcon />
            {unreadCount > 0 && <span className="notification-dot" />}
          </span>
          <span className="navbar-notification-label">Notifications</span>
          {unreadCount > 0 && (
            <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </Link>
        <div className="navbar-user">
          <div className="navbar-avatar" aria-hidden="true">
            {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div>
            <strong>{session?.user?.name || "User"}</strong>
            <small>{session?.user?.role || ""}</small>
          </div>
        </div>
        <button type="button" className="logout-button" onClick={() => signOut({ callbackUrl: "/login" })}>
          Logout
        </button>
      </div>
    </header>
  );
}
