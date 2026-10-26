"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

function formatDate(value, options = {}) {
  if (!value) return "-";
  const date = new Date(value);
  if (options.timeStyle || options.hour || options.minute) {
    return date.toLocaleString("id-ID", options);
  }
  return date.toLocaleDateString("id-ID", options);
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-";
}

const typeLabels = {
  CLOCK_IN_MISSING: "Lupa Clock In",
  CLOCK_OUT_MISSING: "Lupa Clock Out",
  CLOCK_IN_INCORRECT: "Jam Clock In Salah",
  CLOCK_OUT_INCORRECT: "Jam Clock Out Salah",
  CLOCK_IN_OUT_INCORRECT: "Koreksi Jam Masuk dan Keluar",
  OTHER: "Lainnya",
};

export default function CorrectionDetailClient({ id }) {
  const { data: session } = useSession();
  const [correction, setCorrection] = useState(null);
  const [error, setError] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewMode, setReviewMode] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const isReviewer = ["ADMIN", "HR"].includes(session?.user?.role);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/attendance/corrections/${id}`);
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Gagal mengambil detail koreksi");
        setCorrection(result.data);
      } catch (loadError) {
        setError(loadError.message || "Gagal mengambil detail koreksi");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function review() {
    if (reviewMode === "reject" && !reviewNote.trim()) return setError("Alasan penolakan wajib diisi.");
    setProcessing(true);
    try {
      const response = await fetch(`/api/attendance/corrections/${id}/${reviewMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewNote }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal memproses koreksi");
      window.location.reload();
    } catch (reviewError) {
      setError(reviewError.message || "Gagal memproses koreksi");
      setProcessing(false);
    }
  }

  if (loading) return <main><div className="correction-card correction-empty">Loading correction detail...</div></main>;
  if (error && !correction) return <main><div className="form-error" role="alert">{error}</div><Link href="/attendance/corrections" className="detail-button">Back to corrections</Link></main>;

  return <main className="corrections-page"><div className="page-header"><div><span className="module-eyebrow">ATTENDANCE WORKFLOW</span><h1>Attendance Correction</h1><p>Review the original attendance and requested change before deciding.</p></div><Link href="/attendance/corrections" className="button-secondary">Back to Requests</Link></div>{error && <div className="form-error" role="alert">{error}</div>}<section className="correction-card correction-detail-card"><div className="correction-detail-identity"><div><span>Employee</span><strong>{correction.requestedBy?.name || "-"}</strong><small>{correction.requestedBy?.employeeId || correction.requestedBy?.email || "-"}</small></div><div><span>Date</span><strong>{formatDate(correction.attendance?.date, { day: "2-digit", month: "long", year: "numeric" })}</strong></div><div><span>Status</span><strong className={`ui-status ${String(correction.status).toLowerCase()}`}>{correction.status}</strong></div></div><div className="correction-detail-grid"><section><div className="correction-detail-heading"><h2>Original Attendance</h2><span>Before correction</span></div><div className="correction-value-grid"><div><small>Clock In</small><strong>{formatTime(correction.attendance?.clockIn)}</strong></div><div><small>Clock Out</small><strong>{formatTime(correction.attendance?.clockOut)}</strong></div><div><small>Status</small><strong>{correction.attendance?.status || "-"}</strong></div></div></section><section><div className="correction-detail-heading"><h2>Requested Correction</h2><span>Submitted values</span></div><div className="correction-value-grid"><div><small>Clock In</small><strong>{formatTime(correction.requestedClockIn)}</strong></div><div><small>Clock Out</small><strong>{formatTime(correction.requestedClockOut)}</strong></div><div><small>Type</small><strong>{typeLabels[correction.correctionType] || "Lainnya"}</strong></div></div></section></div><div className="correction-detail-reason"><small>Reason</small><p>{correction.reason}</p></div>{correction.reviewNote && <div className="correction-detail-reason"><small>{correction.status === "REJECTED" ? "Rejection reason" : "Reviewer note"}</small><p>{correction.reviewNote}</p></div>}<div className="correction-history"><div className="correction-detail-heading"><h2>Correction History</h2><span>Audit trail</span></div><div className="history-item"><span className="history-dot submitted" /><div><strong>Employee submitted correction</strong><small>{formatDate(correction.createdAt, { dateStyle: "medium", timeStyle: "short" })}</small></div></div>{correction.status !== "PENDING" && <div className="history-item"><span className={`history-dot ${String(correction.status).toLowerCase()}`} /><div><strong>{correction.status === "APPROVED" ? "Reviewer approved correction" : "Reviewer rejected correction"}</strong><small>{correction.reviewedBy?.name || "Reviewer"} - {formatDate(correction.reviewedAt, { dateStyle: "medium", timeStyle: "short" })}</small></div></div>}</div>{isReviewer && correction.status === "PENDING" && <div className="correction-detail-actions"><button type="button" className="button-primary" onClick={() => { setReviewMode("approve"); setReviewNote(""); }}>Approve</button><button type="button" className="danger-button" onClick={() => { setReviewMode("reject"); setReviewNote(""); }}>Reject</button></div>}</section>{reviewMode && <div className="correction-modal-backdrop"><div className="correction-modal" role="dialog" aria-modal="true"><h2>{reviewMode === "approve" ? "Approve Attendance Correction" : "Reject Attendance Correction"}</h2><p>{reviewMode === "approve" ? "Attendance akan diperbarui setelah approval." : "Alasan penolakan wajib disimpan."}</p><label>{reviewMode === "approve" ? "Approval Note (optional)" : "Rejection Reason *"}<textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={4} /></label><div className="form-actions"><button type="button" className="button-secondary" onClick={() => setReviewMode("")} disabled={processing}>Cancel</button><button type="button" className={reviewMode === "approve" ? "button-primary" : "danger-button"} onClick={review} disabled={processing}>{processing ? "Processing..." : reviewMode === "approve" ? "Approve Request" : "Reject Request"}</button></div></div></div>}</main>;
}

