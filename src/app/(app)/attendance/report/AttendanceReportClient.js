"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function AttendanceReportClient() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN" || role === "HR";
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [employees, setEmployees] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [shift, setShift] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [shiftOptions, setShiftOptions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState({ startDate: "", endDate: "", employeeId: "", departmentId: "", status: "", shiftId: "" });

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    try {
      const response = await fetch(`/api/attendance?${params}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load attendance records.");
      }
      setRows(result.data || []);
      setPagination(result.pagination || { page, totalPages: 1 });
    } catch {
      setLoadError("Unable to load attendance records. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => { load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const [scheduleRes, shiftRes, holidayRes] = await Promise.all([fetch("/api/workforce/schedules"), fetch("/api/workforce/shifts"), fetch("/api/workforce/holidays")]);
      const [scheduleData, shiftData, holidayData] = await Promise.all([scheduleRes.json(), shiftRes.json(), holidayRes.json()]);
      setSchedule(scheduleData.data?.[0] || null); setShift(shiftData.data?.[0] || null); setShiftOptions(shiftData.data || []); setHolidays(holidayData.data || []);
      if (isAdmin) { const employeeRes = await fetch("/api/employees?limit=100"); const employeeData = await employeeRes.json(); setEmployees(employeeData.data || []); }
      if (isAdmin) { const departmentRes = await fetch("/api/departments/all"); const departmentData = await departmentRes.json(); setDepartments(departmentData.data || []); }
    }, 0);
    return () => clearTimeout(timer);
  }, [isAdmin]);

  return <main className="attendance-report-page">
    <div className="page-header"><div><span className="module-eyebrow"></span><h1>Attendance Report</h1><p>Monitor attendance records across your permitted scope.</p></div><div className="report-result-count"><strong>{pagination.total ?? rows.length}</strong><span>records</span></div></div>
    <section className="attendance-report-card attendance-filter-card"><div className="report-section-heading"><div><h2>Report Filters</h2><p>Refine the attendance data by date, status, or organization scope.</p></div></div><div className="attendance-report-filters"><label>Start date<input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></label><label>End date<input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></label><label>Status<select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{["PRESENT", "LATE", "ABSENT", "ON_LEAVE", "HOLIDAY", "WEEKEND", "EARLY_CHECKOUT", "OVERTIME"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>{isAdmin && <><label>Employee<select value={filters.employeeId} onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}><option value="">All employees</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><label>Department<select value={filters.departmentId || ""} onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label>Shift<select value={filters.shiftId} onChange={(e) => setFilters({ ...filters, shiftId: e.target.value })}><option value="">All shifts</option>{shiftOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}</div></section>
    <section className="attendance-report-card" aria-busy={loading}>
      <div className="report-section-heading">
        <div><h2>Attendance Records</h2><p>Paginated attendance records for your current access scope.</p></div>
        <span className="report-live-badge">● Live data</span>
      </div>
      {loadError && <p className="attendance-report-error" role="alert">{loadError}</p>}
      <div className="attendance-table-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Date</th><th>Status</th><th>Shift/Schedule</th><th>In</th><th>Out</th><th>Minutes</th><th>OT</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}><div className="attendance-report-empty" role="status">Loading attendance records...</div></td></tr>
            ) : loadError ? (
              <tr><td colSpan={8}><div className="attendance-report-empty">Attendance records are temporarily unavailable.</div></td></tr>
            ) : rows.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.user?.name}</strong><small>{row.user?.employeeId || "-"}</small></td>
                <td>{new Date(row.date).toLocaleDateString("id-ID")}</td>
                <td><span className={`ui-status ${String(row.status || "").toLowerCase()}`}>{row.status}</span></td>
                <td>{row.user?.shift?.name || row.user?.workSchedule?.name || "Default"}</td>
                <td>{row.clockIn ? new Date(row.clockIn).toLocaleTimeString("id-ID") : "-"}</td>
                <td>{row.clockOut ? new Date(row.clockOut).toLocaleTimeString("id-ID") : "-"}</td>
                <td>{row.workingMinutes || 0}</td>
                <td>{row.overtimeMinutes || 0}</td>
              </tr>
            ))}
            {!loading && !loadError && !rows.length && (
              <tr><td colSpan={8}><div className="attendance-report-empty"><strong>No attendance records found</strong><span>Try adjusting the date or status filters.</span></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="attendance-report-pagination">
        <button type="button" disabled={loading || pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Previous</button>
        <span>Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages || 1}</strong></span>
        <button type="button" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>Next</button>
      </div>
    </section>
    <section className="attendance-report-card"><div className="report-section-heading"><div><h2>My Schedule & Holiday Calendar</h2><p>Read-only information for the active user.</p></div></div><div className="attendance-schedule-summary"><div><span>Schedule</span><strong>{schedule ? schedule.name : "Default schedule"}</strong><small>{schedule ? `${schedule.startTime} - ${schedule.endTime}` : "08:00 - 17:00"}</small></div><div><span>Shift</span><strong>{shift ? shift.name : "No dedicated shift"}</strong><small>{shift ? `${shift.startTime} - ${shift.endTime}` : "Standard working hours"}</small></div></div><div className="attendance-table-wrap"><table><thead><tr><th>Date</th><th>Holiday</th></tr></thead><tbody>{holidays.slice(0, 12).map((holiday) => <tr key={holiday.id}><td>{new Date(holiday.date).toLocaleDateString("id-ID")}</td><td>{holiday.name}</td></tr>)}{!holidays.length && <tr><td colSpan={2}><div className="attendance-report-empty"><strong>No active holidays</strong><span>There are no holidays in the current calendar.</span></div></td></tr>}</tbody></table></div></section>
  </main>;
}
