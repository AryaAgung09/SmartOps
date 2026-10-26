"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApprovalActions({
  requestId,
  requestType,
  stepLabel,
}) {
  const router = useRouter();

  const [comment, setComment] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function handleApproval(action) {
    const confirmMessage =
      action === "APPROVED"
        ? "Apakah kamu yakin ingin menyetujui request ini?"
        : "Apakah kamu yakin ingin menolak request ini?";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response =
        await fetch(
          `/api/requests/${requestId}/approve`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              action,
              comment,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            "Gagal memproses request."
        );
      }

      setSuccess(
        result.message ||
          "Approval berhasil diproses."
      );

      setComment("");

      /*
       * Refresh halaman agar:
       *
       * - status request berubah
       * - riwayat approval muncul
       * - tombol approval menghilang
       * - data terbaru ditampilkan
       */

      router.refresh();
    } catch (error) {
      setError(
        error.message ||
          "Terjadi kesalahan."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="approval-actions">
      <div className="section-header">
        <div>
          <h3>
            Proses Approval
          </h3>

          <p>
            Request tipe{" "}
            <strong>{requestType}</strong> pada tahap{" "}
            <strong>{stepLabel}</strong> menunggu tindakan Anda.
          </p>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="comment">
          Komentar
        </label>

        <textarea
          id="comment"
          value={comment}
          onChange={(event) =>
            setComment(
              event.target.value
            )
          }
          placeholder="Tambahkan komentar approval..."
          rows={4}
          disabled={loading}
        />
      </div>

      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      {success && (
        <div className="form-success">
          {success}
        </div>
      )}

      <div className="form-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() =>
            handleApproval(
              "REJECTED"
            )
          }
        >
          {loading
            ? "Memproses..."
            : "Tolak"}
        </button>

        <button
          type="button"
          className="primary-button"
          disabled={loading}
          onClick={() =>
            handleApproval(
              "APPROVED"
            )
          }
        >
          {loading
            ? "Memproses..."
            : "Setujui"}
        </button>
      </div>
    </div>
  );
}