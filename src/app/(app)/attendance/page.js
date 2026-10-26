"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const APP_TIME_ZONE = "Asia/Jakarta";

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });
}

function formatLiveTime(value) {
  if (!value) return "--:--:--";
  return value.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: APP_TIME_ZONE,
  });
}

function formatDate(value, options = {}) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    timeZone: APP_TIME_ZONE,
    ...options,
  });
}

function formatDuration(value, long = false) {
  const totalMinutes = Number(value) || 0;
  if (!totalMinutes) return "-";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (long) return hours ? `${hours} jam ${minutes} menit` : `${minutes} menit`;
  return hours ? `${hours}j ${minutes}m` : `${minutes}m`;
}

function statusLabel(value) {
  if (!value) return "Belum Absen";
  return String(value)
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export default function AttendancePage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN" || role === "HR";

  const [now, setNow] = useState(null);
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [all, setAll] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");

  useEffect(() => {
    const update = () => setNow(new Date());
    const initialTimer = setTimeout(update, 0);
    const timer = setInterval(update, 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRes, histRes] = await Promise.all([
        fetch("/api/attendance?scope=me&limit=1"),
        fetch("/api/attendance?scope=me&limit=20"),
      ]);
      const todayResult = await todayRes.json();
      const historyResult = await histRes.json();
      if (todayResult.success && todayResult.data && todayResult.data[0]) {
        setToday(todayResult.data[0]);
      } else {
        setToday(null);
      }
      if (historyResult.success) setHistory(historyResult.data || []);

      if (isAdmin) {
        const params = new URLSearchParams();
        if (dateFilter) params.set("date", dateFilter);
        if (employeeFilter) params.set("employeeId", employeeFilter);
        params.set("limit", "50");
        const [allRes, empRes] = await Promise.all([
          fetch(`/api/attendance?${params.toString()}`),
          fetch("/api/employees?limit=100"),
        ]);
        const allResult = await allRes.json();
        const employeeResult = await empRes.json();
        if (allResult.success) setAll(allResult.data || []);
        if (employeeResult.success) setEmployees(employeeResult.data || []);
      }
    } catch (error) {
      setMessage("Gagal memuat attendance");
    } finally {
      setLoading(false);
    }
  }, [dateFilter, employeeFilter, isAdmin]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function clockIn() {
    setMessage("");
    setActionLoading("in");
    try {
      const response = await fetch("/api/attendance/clock-in", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal clock-in");
      }
      setMessage("Clock-in berhasil");
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActionLoading("");
    }
  }

  async function clockOut() {
    setMessage("");
    setActionLoading("out");
    try {
      const response = await fetch("/api/attendance/clock-out", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal clock-out");
      }
      setMessage("Clock-out berhasil");
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActionLoading("");
    }
  }

  const adminSummary = {
    total: all.length,
    completed: all.filter((item) => item.clockIn && item.clockOut).length,
    inProgress: all.filter((item) => item.clockIn && !item.clockOut).length,
    missing: all.filter((item) => !item.clockIn).length,
  };

  const todaySchedule = today?.user?.workSchedule || today?.user?.shift;
  const scheduleStart = todaySchedule?.startTime || "08:00";
  const scheduleEnd = todaySchedule?.endTime || "17:00";
  const scheduleName = todaySchedule?.name || "Reguler 08.00 - 17.00";
  const scheduleLabel =
    scheduleName
      .replace(/\s*[-·]?\s*\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2}\s*$/, "")
      .trim() || scheduleName;

  const scheduleStartMinutes = timeToMinutes(scheduleStart);
  const scheduleEndMinutes = timeToMinutes(scheduleEnd);
  let scheduledMinutes = 0;
  if (scheduleStartMinutes !== null && scheduleEndMinutes !== null) {
    scheduledMinutes = scheduleEndMinutes - scheduleStartMinutes;
    if (scheduledMinutes <= 0) scheduledMinutes += 24 * 60;
  }
  const liveWorkedMinutes =
    today?.clockIn && !today?.clockOut && now
      ? Math.max(0, Math.floor((now.getTime() - new Date(today.clockIn).getTime()) / 60000))
      : Number(today?.workingMinutes) || 0;
  const workProgress =
    scheduledMinutes > 0
      ? Math.min(100, Math.round((liveWorkedMinutes / scheduledMinutes) * 100))
      : 0;
  const clockParts = formatLiveTime(now).split(/[.:]/);
  const [clockHour = "--", clockMinute = "--", clockSecond = "--"] = clockParts;

  if (loading) {
    return (
      <main className="attendance-page">
        <div className="module-loading">
          <span />
          <span />
          <span />
        </div>
      </main>
    );
  }

  return (
    <main className="attendance-page">
      <header className="module-page-header">
        <div>
          <span className="module-eyebrow">TIME &amp; ATTENDANCE</span>
          <h1>Attendance</h1>
          <p>Pantau kehadiran harian, riwayat absensi, dan aktivitas tim Anda.</p>
        </div>
        <div className="module-page-actions">
          <Link href="/attendance/report" className="button-secondary">
            Attendance Report
          </Link>
          <Link href="/attendance/corrections" className="button-primary">
            Request Correction
          </Link>
        </div>
      </header>

      {message && (
        <div
          className={message.toLowerCase().includes("berhasil") ? "form-success" : "form-error"}
          role="status"
        >
          {message}
        </div>
      )}

      <section className="att-today-card att-clock-hero" aria-labelledby="attendance-live-heading">
        <div className="att-today-copy att-clock-copy">
          <div className="att-clock-kicker">
            <span className="module-eyebrow" id="attendance-live-heading">
              Live attendance
            </span>
            <span
              className={`att-clock-status ${
                today?.clockIn && !today?.clockOut ? "is-live" : ""
              }`}
            >
              <span className="att-clock-status-dot" aria-hidden="true" />
              {statusLabel(today?.status)}
            </span>
          </div>

          <div className="att-clock-display">
            <div
              className="att-clock-time"
              role="timer"
              aria-live="off"
              aria-label={`Waktu sekarang ${formatLiveTime(now)}`}
            >
              <span>{clockHour}</span>
              <span className="att-clock-divider">:</span>
              <span>{clockMinute}</span>
              <span className="att-clock-divider att-clock-divider-seconds">:</span>
              <span className="att-clock-seconds">{clockSecond}</span>
            </div>
            <span className="att-clock-zone">WIB</span>
          </div>

          <p className="att-clock-date">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
              <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" strokeLinecap="round" />
            </svg>
            {now
              ? formatDate(now, {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "Memuat tanggal..."}
          </p>

          <div className="att-clock-schedule">
            <div>
              <span>Shift</span>
              <strong>{scheduleLabel}</strong>
            </div>
            <div>
              <span>Jam kerja</span>
              <strong>
                {scheduleStart} - {scheduleEnd}
              </strong>
            </div>
            <div>
              <span>Lembur</span>
              <strong>Otomatis setelah {scheduleEnd}</strong>
            </div>
          </div>
        </div>

        <div className="att-clock-panel">
          <div className="att-clock-panel-head">
            <div>
              <span>Absensi hari ini</span>
              <strong>
                {today?.clockOut
                  ? "Shift selesai"
                  : today?.clockIn
                    ? "Sedang bekerja"
                    : "Siap clock in"}
              </strong>
            </div>
            <span
              className={`att-clock-dot ${
                today?.clockIn && !today?.clockOut ? "is-live" : ""
              }`}
              aria-hidden="true"
            />
          </div>

          <div className="att-clock-progress">
            <div className="att-clock-progress-copy">
              <span>Progres kerja</span>
              <strong>{workProgress}%</strong>
            </div>
            <div
              className="att-clock-progress-track"
              role="progressbar"
              aria-label="Progres kerja hari ini"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={workProgress}
            >
              <span style={{ width: `${workProgress}%` }} />
            </div>
            <small>
              {liveWorkedMinutes
                ? `${formatDuration(liveWorkedMinutes, true)} dari ${formatDuration(scheduledMinutes, true)}`
                : "Belum ada durasi kerja tercatat"}
            </small>
          </div>

          <div className="att-clock-times">
            <div>
              <span>Clock In</span>
              <strong>{formatTime(today?.clockIn)}</strong>
              <small>Waktu masuk</small>
            </div>
            <div>
              <span>Clock Out</span>
              <strong>{formatTime(today?.clockOut)}</strong>
              <small>Waktu keluar</small>
            </div>
          </div>

          <div className="att-clock-actions">
            <button
              type="button"
              className="att-clock-btn att-clock-btn-in"
              onClick={clockIn}
              disabled={Boolean(today?.clockIn) || Boolean(actionLoading)}
            >
              <span aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 7v5l3 2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="8.5" />
                </svg>
              </span>
              {actionLoading === "in" ? "Memproses..." : today?.clockIn ? "Sudah Clock In" : "Clock In"}
            </button>
            <button
              type="button"
              className="att-clock-btn att-clock-btn-out"
              onClick={clockOut}
              disabled={!today?.clockIn || Boolean(today?.clockOut) || Boolean(actionLoading)}
            >
              <span aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" strokeLinecap="round" />
                  <path d="m10 8 4 4-4 4M14 12H4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {actionLoading === "out" ? "Memproses..." : today?.clockOut ? "Sudah Clock Out" : "Clock Out"}
            </button>
          </div>

          <div className="att-clock-meta">
            <div>
              <span>Durasi kerja</span>
              <strong>{formatDuration(liveWorkedMinutes, true)}</strong>
            </div>
            <div>
              <span>Lembur</span>
              <strong>{formatDuration(today?.overtimeMinutes, true)}</strong>
            </div>
          </div>

          <p className="att-clock-hint">
            {today?.clockIn && !today?.clockOut
              ? "Jangan lupa clock out saat selesai bekerja agar durasi dan lembur tercatat."
              : `Jam kerja ${scheduleStart} - ${scheduleEnd}. Lembur dihitung otomatis setelah jam kerja.`}
          </p>
        </div>
      </section>

      <section className="att-card">
        <div className="module-section-head">
          <div>
            <h2>Riwayat absensi</h2>
            <p>20 aktivitas attendance terakhir milik Anda.</p>
          </div>
          <span className="module-chip">{history.length} records</span>
        </div>

        <div className="att-table-wrap">
          <table className="att-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Durasi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="att-date-cell">
                      <strong>
                        {formatDate(item.date, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </strong>
                      <small>{formatDate(item.date, { weekday: "long" })}</small>
                    </div>
                  </td>
                  <td>{formatTime(item.clockIn)}</td>
                  <td>{formatTime(item.clockOut)}</td>
                  <td>{formatDuration(item.workingMinutes)}</td>
                  <td>
                    <span className={`ui-status ${String(item.status || "").toLowerCase()}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="table-empty">
                      <strong>Belum ada riwayat absensi</strong>
                      <span>Riwayat akan muncul setelah Anda melakukan clock-in.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isAdmin && (
        <section className="att-card">
          <div className="module-section-head">
            <div>
              <h2>Team attendance</h2>
              <p>Monitor kehadiran karyawan berdasarkan tanggal dan employee.</p>
            </div>
            <span className="module-chip">{all.length} records</span>
          </div>

          <div className="att-summary-grid">
            <article className="att-stat">
              <span>Total records</span>
              <strong>{adminSummary.total}</strong>
              <small>Data attendance ditampilkan</small>
            </article>
            <article className="att-stat att-stat-green">
              <span>Completed</span>
              <strong>{adminSummary.completed}</strong>
              <small>Clock in dan clock out lengkap</small>
            </article>
            <article className="att-stat att-stat-amber">
              <span>In progress</span>
              <strong>{adminSummary.inProgress}</strong>
              <small>Sudah clock in, belum clock out</small>
            </article>
            <article className="att-stat att-stat-slate">
              <span>No clock-in</span>
              <strong>{adminSummary.missing}</strong>
              <small>Belum memiliki catatan masuk</small>
            </article>
          </div>

          <div className="att-filter-bar">
            <label>
              <span>Tanggal</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
              />
            </label>
            <label>
              <span>Employee</span>
              <select
                value={employeeFilter}
                onChange={(event) => setEmployeeFilter(event.target.value)}
              >
                <option value="">Semua karyawan</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} ({employee.employeeId || employee.email || "Belum ada akun"})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setDateFilter("");
                setEmployeeFilter("");
              }}
              disabled={!dateFilter && !employeeFilter}
            >
              Reset filter
            </button>
          </div>

          <div className="att-table-wrap">
            <table className="att-table att-team-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Tanggal</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Durasi</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {all.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="att-person">
                        <span className="att-person-avatar">{initials(item.user?.name)}</span>
                        <div>
                          <strong>{item.user?.name || "-"}</strong>
                          <small>{item.user?.employeeId || item.user?.email || "-"}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {formatDate(item.date, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>{formatTime(item.clockIn)}</td>
                    <td>{formatTime(item.clockOut)}</td>
                    <td>{formatDuration(item.workingMinutes)}</td>
                    <td>
                      <span className={`ui-status ${String(item.status || "").toLowerCase()}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {all.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="table-empty">
                        <strong>Tidak ada data attendance</strong>
                        <span>Coba ubah tanggal atau pilih employee lain.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
