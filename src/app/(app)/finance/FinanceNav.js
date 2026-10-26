"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/finance", label: "Ringkasan" },
  { href: "/finance/budgets", label: "Budget" },
  { href: "/finance/expenses", label: "Pengeluaran" },
  { href: "/finance/invoices", label: "Invoice" },
  { href: "/finance/vendors", label: "Vendor" },
  { href: "/finance/payments", label: "Pembayaran" },
];

export default function FinanceNav() {
  const pathname = usePathname();

  return (
    <nav className="fin-tabs" aria-label="Finance navigation">
      {links.map((link) => {
        const active =
          link.href === "/finance"
            ? pathname === "/finance"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link key={link.href} href={link.href} className={`fin-tab ${active ? "active" : ""}`}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
