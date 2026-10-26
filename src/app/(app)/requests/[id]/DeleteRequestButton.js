"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteRequestButton({
  requestId,
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      "Apakah kamu yakin ingin menghapus request ini?"
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/requests/${requestId}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            "Gagal menghapus request"
        );
      }

      router.push("/requests");
      router.refresh();
    } catch (error) {
      window.alert(
        error.message ||
          "Terjadi kesalahan saat menghapus request"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="danger-button"
      onClick={handleDelete}
      disabled={loading}
    >
      {loading
        ? "Menghapus..."
        : "Hapus Request"}
    </button>
  );
}