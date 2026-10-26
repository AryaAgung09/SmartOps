"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

const REVIEWER_ROLES = ["ADMIN", "HR"];
const correctionTypes = [
  ["CLOCK_IN_MISSING", "Lupa Clock In"],
  ["CLOCK_OUT_MISSING", "Lupa Clock Out"],
  ["CLOCK_IN_INCORRECT", "Jam Clock In Salah"],
  ["CLOCK_OUT_INCORRECT", "Jam Clock Out Salah"],
  ["CLOCK_IN_OUT_INCORRECT", "Koreksi Jam Masuk dan Keluar"],
  ["OTHER", "Lainnya"],
];

const typeLabels = Object.fromEntries(correctionTypes);

function formatDate(value, options = {}) {
  return value ? new Date(value).toLocaleDateString("id-ID", options) : "-";
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-";
}

function dateInputValue(value) {
  return value ? new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }) : "";
}

function timeInputValue(value) {
  return value ? new Date(value).toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) : "";
}

function toIsoDateTime(date, time) {
  return date && time ? new Date(`${date}T${time}:00+07:00`).toISOString() : null;
}

function StatusBadge({ status }) {
  return <span className={`ui-status ${String(status || "").toLowerCase()}`}>{status || "-"}</span>;
}

export default function CorrectionsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const role = session?.user?.role;
  const isReviewer = REVIEWER_ROLES.includes(role);
  const [attendances, setAttendances] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState("");
  const [form, setForm] = useState({ correctionType: "", requestedClockIn: "", requestedClockOut: "", reason: "" });
  const [statusFilter, setStatusFilter] = useState(null);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewMode, setReviewMode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [fetch("/api/attendance/corrections")];
      if (!isReviewer) requests.push(fetch("/api/attendance?scope=me&limit=100"));
      const responses = await Promise.all(requests);
      const correctionResult = await responses[0].json();
      if (!responses[0].ok || !correctionResult.success) throw new Error(correctionResult.message || "Gagal mengambil data koreksi");
      setCorrections(correctionResult.data || []);
      if (!isReviewer) {
        const attendanceResult = await responses[1].json();
        if (attendanceResult.success) setAttendances(attendanceResult.data || []);
      }
    } catch (loadError) {
      setError(loadError.message || "Gagal mengambil data koreksi");
    } finally {
      setLoading(false);
    }
  }, [isReviewer]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return undefined;
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load, sessionStatus]);

  const selectedAttendance = attendances.find((item) => String(item.id) === String(selectedAttendanceId));
  const needsClockIn = ["CLOCK_IN_MISSING", "CLOCK_IN_INCORRECT", "CLOCK_IN_OUT_INCORRECT"].includes(form.correctionType);
  const needsClockOut = ["CLOCK_OUT_MISSING", "CLOCK_OUT_INCORRECT", "CLOCK_IN_OUT_INCORRECT"].includes(form.correctionType);

  const effectiveStatusFilter = statusFilter === null ? (isReviewer ? "PENDING" : "") : statusFilter;
  const filteredCorrections = useMemo(() => corrections.filter((item) => {
    if (effectiveStatusFilter && item.status !== effectiveStatusFilter) return false;
    if (employeeFilter && String(item.requestedById) !== employeeFilter) return false;
    if (typeFilter && item.correctionType !== typeFilter) return false;
    return true;
  }), [corrections, effectiveStatusFilter, employeeFilter, typeFilter]);

  const stats = useMemo(() => ({
    pending: corrections.filter((item) => item.status === "PENDING").length,
    approved: corrections.filter((item) => item.status === "APPROVED").length,
    rejected: corrections.filter((item) => item.status === "REJECTED").length,
    total: corrections.length,
  }), [corrections]);

  const employees = useMemo(() => Array.from(new Map(corrections.map((item) => [item.requestedById, item.requestedBy]).filter(([, employee]) => employee)).values()), [corrections]);

  function updateForm(name, value) {
    setError("");
    setMessage("");
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!selectedAttendance) return setError("Tanggal absensi wajib dipilih.");
    if (!form.correctionType) return setError("Jenis koreksi wajib dipilih.");
    if (!form.reason.trim()) return setError("Alasan koreksi wajib diisi.");
    if (needsClockIn && !form.requestedClockIn) return setError("Jam masuk seharusnya wajib diisi.");
    if (needsClockOut && !form.requestedClockOut) return setError("Jam keluar seharusnya wajib diisi.");
    setSubmitting(true);
    try {
      const response = await fetch("/api/attendance/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: selectedAttendance.id,
          correctionType: form.correctionType,
          requestedClockIn: toIsoDateTime(dateInputValue(selectedAttendance.date), form.requestedClockIn),
          requestedClockOut: toIsoDateTime(dateInputValue(selectedAttendance.date), form.requestedClockOut),
          reason: form.reason,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal mengajukan koreksi");
      setMessage("Koreksi absensi berhasil diajukan. Menunggu persetujuan HR.");
      setSelectedAttendanceId("");
      setForm({ correctionType: "", requestedClockIn: "", requestedClockOut: "", reason: "" });
      await load();
    } catch (submitError) {
      setError(submitError.message || "Gagal mengajukan koreksi");
    } finally {
      setSubmitting(false);
    }
  }

  function openReview(id, mode) {
    setReviewingId(id);
    setReviewMode(mode);
    setReviewNote("");
    setError("");
  }

  async function review() {
    if (reviewMode === "reject" && !reviewNote.trim()) return setError("Alasan penolakan wajib diisi.");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/attendance/corrections/${reviewingId}/${reviewMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal memproses koreksi");
      setMessage(reviewMode === "approve" ? "Koreksi berhasil disetujui dan attendance diperbarui." : "Koreksi berhasil ditolak.");
      setReviewingId(null);
      await load();
    } catch (reviewError) {
      setError(reviewError.message || "Gagal memproses koreksi");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="corrections-page">
    <div className="page-header">
      <div><span className="module-eyebrow">ATTENDANCE WORKFLOW</span><h1>{isReviewer ? "Correction Requests" : "My Correction Requests"}</h1><p>{isReviewer ? "Review and approve attendance changes submitted by your team." : "Ajukan perubahan attendance tanpa mengubah record secara langsung."}</p></div>
      {!isReviewer && <a className="button-primary" href="#create-correction">+ Ajukan Koreksi</a>}
    </div>

    {isReviewer && <div className="correction-stat-grid"><div><span>Pending</span><strong>{stats.pending}</strong><small>Needs review</small></div><div><span>Approved</span><strong>{stats.approved}</strong><small>Processed requests</small></div><div><span>Rejected</span><strong>{stats.rejected}</strong><small>Unapproved requests</small></div><div><span>Total</span><strong>{stats.total}</strong><small>All requests</small></div></div>}
    {message && <div className="form-success" role="status">{message}</div>}
    {error && <div className="form-error" role="alert">{error}</div>}

    {!isReviewer && <section id="create-correction" className="correction-card correction-create-card"><div className="correction-section-heading"><div><h2>Ajukan Koreksi Absensi</h2><p>Attendance asli tetap aman sampai request disetujui approver.</p></div><span className="workflow-pill">SUBMIT - REVIEW - UPDATE</span></div><form onSubmit={submit}><div className="correction-form-grid"><label>Tanggal Absensi<span>*</span><select value={selectedAttendanceId} onChange={(event) => { setSelectedAttendanceId(event.target.value); setError(""); }} disabled={submitting} required><option value="">Pilih tanggal attendance</option>{attendances.map((item) => <option key={item.id} value={item.id}>{formatDate(item.date, { day: "2-digit", month: "short", year: "numeric" })} - {item.status}</option>)}</select></label><label>Jenis Koreksi<span>*</span><select value={form.correctionType} onChange={(event) => updateForm("correctionType", event.target.value)} disabled={submitting} required><option value="">Pilih jenis koreksi</option>{correctionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      {selectedAttendance && <div className="original-attendance-panel"><div><span>Original Attendance</span><strong>{formatDate(selectedAttendance.date, { day: "2-digit", month: "long", year: "numeric" })}</strong></div><div><small>Clock In</small><strong>{formatTime(selectedAttendance.clockIn)}</strong></div><div><small>Clock Out</small><strong>{formatTime(selectedAttendance.clockOut)}</strong></div><div><small>Status</small><StatusBadge status={selectedAttendance.status} /></div></div>}
      {(needsClockIn || needsClockOut) && <div className="correction-form-grid"><label className={needsClockIn ? "" : "correction-hidden-field"}>Jam Masuk Seharusnya{needsClockIn && <span>*</span>}<input type="time" value={form.requestedClockIn} onChange={(event) => updateForm("requestedClockIn", event.target.value)} disabled={submitting || !needsClockIn} required={needsClockIn} /></label><label className={needsClockOut ? "" : "correction-hidden-field"}>Jam Keluar Seharusnya{needsClockOut && <span>*</span>}<input type="time" value={form.requestedClockOut} onChange={(event) => updateForm("requestedClockOut", event.target.value)} disabled={submitting || !needsClockOut} required={needsClockOut} /></label></div>}
      <label>Alasan Koreksi<span>*</span><textarea value={form.reason} onChange={(event) => updateForm("reason", event.target.value)} placeholder="Jelaskan alasan koreksi absensi..." rows={5} disabled={submitting} required /></label><div className="correction-form-footer"><small>Untuk tanggal tanpa attendance record, gunakan workflow attendance yang tersedia saat ini atau hubungi HR.</small><button type="submit" disabled={submitting}>{submitting ? "Mengajukan..." : "Ajukan Koreksi"}</button></div></form></section>}

    <section className="correction-card"><div className="correction-section-heading"><div><h2>{isReviewer ? "Pending Correction Requests" : "Correction History"}</h2><p>{isReviewer ? "Compare original and requested values before making a decision." : "Track the status and approval history of your submissions."}</p></div><div className="correction-filters"><select value={effectiveStatusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All status</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>{isReviewer && <><select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}><option value="">All employees</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">All types</option>{correctionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></>}</div></div><div className="correction-table-wrap"><table><thead><tr>{isReviewer && <th>Employee</th>}<th>Date</th><th>Type</th><th>Original</th><th>Requested</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={isReviewer ? 8 : 7}><div className="correction-empty">Loading correction requests...</div></td></tr> : filteredCorrections.map((item) => <tr key={item.id}>{isReviewer && <td><strong>{item.requestedBy?.name || "-"}</strong><small>{item.requestedBy?.employeeId || "-"}</small></td>}<td>{formatDate(item.attendance?.date, { day: "2-digit", month: "short", year: "numeric" })}</td><td>{typeLabels[item.correctionType] || "Lainnya"}</td><td><small>In {formatTime(item.attendance?.clockIn)}</small><small>Out {formatTime(item.attendance?.clockOut)}</small></td><td><small>In {formatTime(item.requestedClockIn)}</small><small>Out {formatTime(item.requestedClockOut)}</small></td><td className="correction-reason-cell">{item.reason}</td><td><StatusBadge status={item.status} /></td><td><Link className="detail-button" href={`/attendance/corrections/${item.id}`}>View</Link>{isReviewer && item.status === "PENDING" && <div className="correction-row-actions"><button type="button" onClick={() => openReview(item.id, "approve")}>Approve</button><button type="button" className="danger-button" onClick={() => openReview(item.id, "reject")}>Reject</button></div>}</td></tr>)}{!loading && !filteredCorrections.length && <tr><td colSpan={isReviewer ? 8 : 7}><div className="correction-empty"><strong>No correction requests found</strong><span>Try changing the filter or submit a new request.</span></div></td></tr>}</tbody></table></div></section>

    {reviewingId && <div className="correction-modal-backdrop" role="presentation"><div className="correction-modal" role="dialog" aria-modal="true" aria-labelledby="review-title"><h2 id="review-title">{reviewMode === "approve" ? "Approve Attendance Correction" : "Reject Attendance Correction"}</h2><p>{reviewMode === "approve" ? "Attendance akan diperbarui sesuai nilai yang diminta setelah approval." : "Rejection reason wajib disimpan untuk menjaga audit trail."}</p><label>{reviewMode === "approve" ? "Approval Note (optional)" : "Rejection Reason *"}<textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder={reviewMode === "approve" ? "Tambahkan catatan approval..." : "Jelaskan alasan penolakan..."} rows={4} /></label><div className="form-actions"><button type="button" className="button-secondary" onClick={() => setReviewingId(null)} disabled={submitting}>Cancel</button><button type="button" className={reviewMode === "approve" ? "button-primary" : "danger-button"} onClick={review} disabled={submitting}>{submitting ? "Processing..." : reviewMode === "approve" ? "Approve Request" : "Reject Request"}</button></div></div></div>}
  </main>;
}

