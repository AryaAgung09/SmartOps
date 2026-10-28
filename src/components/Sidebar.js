"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { FEATURE_SECTIONS } from "@/lib/features";

const SECTION_ICONS = {
  Overview: "dashboard",
  People: "employees",
  "Time & Attendance": "clock",
  Finance: "wallet",
  Payroll: "banknote",
  Documents: "folder",
  Administration: "shield",
};

function isActivePath(pathname, href) {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  return pathname.startsWith(`${href}/`);
}

function NavIcon({ name, className = "" }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === "dashboard" && (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      )}
      {name === "bell" && (
        <>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </>
      )}
      {name === "briefcase" && (
        <>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
        </>
      )}
      {name === "employees" && (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      )}
      {name === "users" && (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
          <path d="M19 3v4" />
          <path d="M21 5h-4" />
        </>
      )}
      {name === "profile" && (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      )}
      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
      {name === "report" && (
        <>
          <path d="M3 3v18h18" />
          <path d="M7 16v-5" />
          <path d="M12 16V7" />
          <path d="M17 16v-3" />
        </>
      )}
      {name === "edit" && (
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </>
      )}
      {name === "calendar" && (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18" />
        </>
      )}
      {name === "inbox" && (
        <>
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
        </>
      )}
      {name === "wallet" && (
        <>
          <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          <path d="M16 12h5" />
          <circle cx="16" cy="12" r="1" />
        </>
      )}
      {name === "banknote" && (
        <>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 12h.01M18 12h.01" />
        </>
      )}
      {name === "calendar-check" && (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18" />
          <path d="m9 16 2 2 4-4" />
        </>
      )}
      {name === "receipt" && (
        <>
          <path d="M6 2h12a1 1 0 0 1 1 1v19l-3-2-4 2-4-2-3 2V3a1 1 0 0 1 1-1Z" />
          <path d="M9 7h6M9 11h6M9 15h4" />
        </>
      )}
      {name === "folder" && (
        <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      )}
      {name === "upload" && (
        <>
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3" />
        </>
      )}
      {name === "shield" && (
        <>
          <path d="M12 3 5 6v5c0 4.4 2.8 7.9 7 10 4.2-2.1 7-5.6 7-10V6Z" />
          <path d="m9.5 12 1.8 1.8 3.4-3.6" />
        </>
      )}
      {name === "menu" && <path d="M4 7h16M4 12h16M4 17h16" />}
      {name === "close" && <path d="M6 6l12 12M18 6 6 18" />}
    </svg>
  );
}

export default function Sidebar({ allowedFeatureKeys = [] }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState({});
  const closeButtonRef = useRef(null);
  const mobileTriggerRef = useRef(null);
  const role = session?.user?.role;
  const allowedFeatures = new Set(allowedFeatureKeys);

  const visibleSections = FEATURE_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => allowedFeatures.has(item.key)),
  })).filter((section) => section.items.length > 0);

  const activeHref = visibleSections
    .flatMap((section) => section.items)
    .filter((item) => isActivePath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const activeSection = visibleSections.find((section) =>
    section.items.some((item) => item.href === activeHref)
  )?.label;

  useEffect(() => {
    if (status !== "authenticated") return undefined;
    let cancelled = false;
    async function loadUnread() {
      try {
        const response = await fetch("/api/notifications/unread", { cache: "no-store" });
        const result = await response.json();
        if (!cancelled && result.success) setUnreadNotifications(Number(result.data?.count || 0));
      } catch (error) {
        // Notification count is supplementary to navigation.
      }
    }
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    window.addEventListener("notifications:changed", loadUnread);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("notifications:changed", loadUnread);
    };
  }, [status]);

  useEffect(() => {
    const closeOnPopState = () => setMobileOpen(false);
    window.addEventListener("popstate", closeOnPopState);
    return () => window.removeEventListener("popstate", closeOnPopState);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const mobileTrigger = mobileTriggerRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      mobileTrigger?.focus();
    };
  }, [mobileOpen]);

  function closeMobile() {
    setMobileOpen(false);
  }

  function toggleSection(label) {
    setOpenSections((current) => ({
      ...current,
      [label]: !(current[label] ?? activeSection === label),
    }));
  }

  function renderLink(item) {
    const active = item.href === activeHref;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeMobile}
        className={`sidebar-link ${active ? "active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        <NavIcon name={item.icon} className="sidebar-link-icon" />
        <span className="sidebar-link-text">{item.label}</span>
        {item.href === "/notifications" && unreadNotifications > 0 && (
          <span className="notification-dot" aria-label={`${unreadNotifications} unread notifications`}>
            {unreadNotifications > 9 ? "9+" : unreadNotifications}
          </span>
        )}
      </Link>
    );
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={closeMobile}
        />
      )}
      <aside
        id="primary-navigation"
        className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}
        aria-label="Primary navigation"
      >
        <div className="sidebar-head">
          <Link href="/dashboard" className="sidebar-brand" onClick={closeMobile} aria-label="SmartOps dashboard">
            <span className="sidebar-brand-mark" aria-hidden="true">S</span>
            <span className="sidebar-brand-copy">
              <strong>SmartOps</strong>
              <small>Operations workspace</small>
            </span>
          </Link>
          <button
            type="button"
            className="sidebar-close"
            onClick={closeMobile}
            aria-label="Close navigation"
            ref={closeButtonRef}
          >
            <NavIcon name="close" />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <div className="sidebar-nav-caption" aria-hidden="true">
            <span>Workspace</span>
            <span className="sidebar-nav-caption-line" />
          </div>
          {status === "loading" ? (
            <div className="sidebar-loading" aria-label="Loading navigation">
              <span />
              <span />
              <span />
            </div>
          ) : (
            visibleSections.map((section) => {
              const isOpen = openSections[section.label] ?? activeSection === section.label;
              const sectionActive = activeSection === section.label;
              const sectionId = `sidebar-section-${section.label
                .toLowerCase()
                .replaceAll("&", "and")
                .replaceAll(" ", "-")}`;

              return (
                <div
                  className={`sidebar-section ${isOpen ? "open" : ""} ${
                    sectionActive ? "current" : ""
                  }`}
                  key={section.label}
                >
                  <button
                    type="button"
                    className="sidebar-section-toggle"
                    aria-expanded={isOpen}
                    aria-controls={sectionId}
                    onClick={() => toggleSection(section.label)}
                  >
                    <span className="sidebar-section-icon">
                      <NavIcon name={SECTION_ICONS[section.label] || "dashboard"} />
                    </span>
                    <span className="sidebar-section-label">{section.label}</span>
                    <svg
                      className={`sidebar-section-chevron ${isOpen ? "open" : ""}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="sidebar-links" id={sectionId}>
                      {section.items.map(renderLink)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        <Link
          href="/my-profile"
          className="sidebar-account"
          onClick={closeMobile}
          aria-label={`Open profile for ${session?.user?.name || "user"}`}
        >
          <span className="sidebar-account-avatar">
            {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
            <span className="sidebar-account-status" aria-hidden="true" />
          </span>
          <span className="sidebar-account-info">
            <strong>{session?.user?.name || "User"}</strong>
            <small>{role || "Loading..."}</small>
          </span>
          <svg
            className="sidebar-account-chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      </aside>

      <button
        type="button"
        className="sidebar-mobile-trigger"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        aria-controls="primary-navigation"
        aria-expanded={mobileOpen}
        ref={mobileTriggerRef}
      >
        <NavIcon name="menu" />
      </button>
    </>
  );
}
