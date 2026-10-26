"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DocumentActions({ document }) {
  const router = useRouter();
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run(action) {
    setLoading(action);
    setMessage("");
    setError("");

    try {
      let response;

      if (action === "remind") {
        response = await fetch(`/api/documents/${document.id}/remind`, { method: "POST" });
      } else if (action === "archive") {
        response = await fetch(`/api/documents/${document.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: !document.archived }),
        });
      } else {
        response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Aksi gagal diproses.");
      }

      if (action === "delete") {
        router.push("/documents");
        router.refresh();
        return;
      }

      if (action === "remind") {
        setMessage(`Pengingat terkirim ke ${result.data.count} penerima.`);
      } else {
        setMessage(document.archived ? "Dokumen diaktifkan kembali." : "Dokumen diarsipkan.");
        router.refresh();
      }
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setLoading("");
    }
  }

  function handleDelete() {
    if (window.confirm("Hapus dokumen ini secara permanen? Tindakan ini tidak dapat dibatalkan.")) {
      run("delete");
    }
  }

  return (
    <div className="doc-actions">
      <button
        type="button"
        className="doc-secondary-btn"
        onClick={() => run("remind")}
        disabled={Boolean(loading)}
      >
        {loading === "remind" ? "Mengirim..." : "Kirim Pengingat"}
      </button>

      <button
        type="button"
        className="doc-secondary-btn"
        onClick={() => run("archive")}
        disabled={Boolean(loading)}
      >
        {loading === "archive"
          ? "Memproses..."
          : document.archived
            ? "Aktifkan Kembali"
            : "Arsipkan"}
      </button>

      <button
        type="button"
        className="doc-danger-btn"
        onClick={handleDelete}
        disabled={Boolean(loading)}
      >
        {loading === "delete" ? "Menghapus..." : "Hapus"}
      </button>

      {message && <span className="doc-action-success">{message}</span>}
      {error && <span className="doc-action-error">{error}</span>}
    </div>
  );
}
