"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FinanceActionButton({
  endpoint,
  method = "PATCH",
  body = null,
  label,
  confirmMessage = "",
  className = "fin-action-btn",
  pendingLabel = "Memproses...",
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Aksi gagal diproses.");
      }
      router.refresh();
    } catch (error) {
      window.alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={className} onClick={handleClick} disabled={loading}>
      {loading ? pendingLabel : label}
    </button>
  );
}
