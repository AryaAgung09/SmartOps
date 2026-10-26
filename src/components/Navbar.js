"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";

const contexts = {
  "/dashboard": "Operations overview",
  "/hr-dashboard": "People analytics",
  "/employees": "Employee directory",
  "/users": "Access and user management",
  "/requests": "Workflow requests",
  "/attendance": "Time and attendance",
  "/leaves": "Leave management",
  "/payroll": "Payroll operations",
  "/my-payroll": "Personal payroll statement",
  "/documents": "Document and contract management",
  "/notifications": "Updates and notifications",
  "/my-profile": "Personal profile",
  "/finance": "Finance and cash flow",
  "/access-control": "Role feature access",
};

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const context = Object.entries(contexts).find(([path]) => pathname === path || pathname.startsWith(`${path}/`));

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

  return <header className="navbar"><div className="navbar-context"><span className="navbar-kicker">SMARTOPS</span><h1>{context?.[1] || "Operations workspace"}</h1></div><div className="navbar-actions"><Link href="/notifications" className="notification-link"><span className="notification-icon-wrapper"><span className="notification-icon">♧</span>{unreadCount > 0 && <span className="notification-dot" />}</span><span className="navbar-notification-label">Notifications</span>{unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}</Link><div className="navbar-user"><div className="navbar-avatar">{session?.user?.name?.charAt(0)?.toUpperCase() || "U"}</div><div><strong>{session?.user?.name || "User"}</strong><small>{session?.user?.role || ""}</small></div></div><button type="button" className="logout-button" onClick={() => signOut({ callbackUrl: "/login" })}>Logout</button></div></header>;
}
