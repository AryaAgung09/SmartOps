"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { requestTypeLabel } from "@/lib/requestTypes";

const managementRoles = ["ADMIN", "HR"];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-";
}

function StatusBadge({ value }) {
  const status = String(value || "-").toLowerCase().replaceAll(" ", "-");
  return <span className={`dashboard-status ${status}`}>{value || "-"}</span>;
}

function DataState({ error, children }) {
  return error ? <div className="dashboard-empty">Data tidak dapat dimuat.</div> : children;
}

function Kpi({ label, value, detail }) {
  return <div className="dashboard-kpi"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function Bar({ label, value, max, tone }) {
  const percentage = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return <div className="dashboard-bar"><div><span>{label}</span><strong>{value}</strong></div><div className="dashboard-bar-track"><span className={tone} style={{ width: `${percentage}%` }} /></div></div>;
}

function QuickAction({ href, label }) {
  return <Link href={href} className="dashboard-quick-action"><span>+</span>{label}<b>→</b></Link>;
}

export default function DashboardClient({ user, deniedFeature = "" }) {
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const management = managementRoles.includes(user.role);

  useEffect(() => {
    let cancelled = false;
    const requests = {
      notifications: "/api/notifications",
      requests: "/api/requests?limit=10",
      documents: "/api/documents?limit=5",
    };

    if (management) {
      requests.hr = "/api/hr-dashboard?range=today";
      requests.payroll = "/api/payroll/periods";
      requests.attendance = "/api/attendance?limit=50";
      requests.leaves = "/api/leaves?limit=10";
    } else {
      requests.attendance = "/api/attendance?scope=me&limit=10";
      requests.leaves = "/api/leaves?limit=10";
      requests.balances = "/api/leave-balances";
      requests.payroll = "/api/payroll";
    }

    async function load() {
      const entries = Object.entries(requests);
      const results = await Promise.allSettled(entries.map(async ([key, url]) => {
        const response = await fetch(url, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || `${key} failed`);
        return [key, result.data];
      }));
      if (cancelled) return;
      const nextData = {};
      const nextErrors = {};
      results.forEach((result, index) => {
        const key = entries[index][0];
        if (result.status === "fulfilled") nextData[result.value[0]] = result.value[1];
        else nextErrors[key] = true;
      });
      setData(nextData);
      setErrors(nextErrors);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [management, user.role]);

  const requests = Array.isArray(data.requests) ? data.requests : [];
  const notifications = Array.isArray(data.notifications) ? data.notifications : [];
  const unreadNotifications = notifications.filter((item) => !item.isRead).length;
  const requestCounts = requests.reduce((result, request) => ({ ...result, [request.status]: (result[request.status] || 0) + 1 }), {});
  const attendanceRows = Array.isArray(data.attendance) ? data.attendance : [];
  const todayAttendance = attendanceRows[0];
  const leaves = Array.isArray(data.leaves) ? data.leaves : [];
  const leaveCounts = leaves.reduce((result, leave) => ({ ...result, [leave.status]: (result[leave.status] || 0) + 1 }), {});
  const balances = Array.isArray(data.balances) ? data.balances : [];
  const availableLeave = balances.reduce((total, balance) => total + Number(balance.allocatedDays || 0) + Number(balance.adjustmentDays || 0) - Number(balance.usedDays || 0) - Number(balance.pendingDays || 0), 0);
  const documentData = data.documents || {};
  const documentRows = Array.isArray(documentData.documents) ? documentData.documents : [];
  const documentSummary = documentData.summary || {};
  const hr = data.hr || {};
  const payrollRows = Array.isArray(data.payroll) ? data.payroll : [];
  const latestPayroll = payrollRows[0];
  const activity = management && Array.isArray(hr.recentActivity) ? hr.recentActivity : notifications.slice(0, 6);

  if (loading) return <main className="dashboard-shell"><div className="dashboard-loading"><div className="dashboard-spinner" /><h1>Loading dashboard...</h1><p>Gathering your SmartOps overview.</p></div></main>;

  const kpis = management ? [
    ["Total Employees", hr.employees?.total ?? "-", `${hr.employees?.active ?? "-"} active`],
    ["Attendance Today", hr.attendance?.present ?? "-", `${hr.attendance?.late ?? 0} late · ${hr.attendance?.notClockedIn ?? 0} not clocked in`],
    ["Pending Leave", hr.leave?.pending ?? "-", `${hr.leave?.currentlyOnLeave ?? 0} currently on leave`],
    ["Pending Requests", requestCounts.PENDING ?? "-", `${requests.length} recent requests loaded`],
    ["Expiring Documents", documentSummary.expiring ?? "-", `${documentSummary.expired ?? 0} already expired`],
    ["Payroll Period", latestPayroll?.status ?? "-", latestPayroll?.name || "No payroll period"],
    ["Unread Notifications", unreadNotifications, "Personal updates"],
  ] : [
    ["Attendance Today", todayAttendance?.status || "Not clocked in", `${formatTime(todayAttendance?.clockIn)} - ${formatTime(todayAttendance?.clockOut)}`],
    ["Leave Balance", balances.length ? availableLeave : "-", "Available days"],
    ["My Requests", requests.length, `${requestCounts.PENDING || 0} pending`],
    ["My Documents", documentSummary.total ?? "-", `${documentSummary.expiring ?? 0} expiring soon`],
    ["Expired Documents", documentSummary.expired ?? "-", "Need renewal"],
    ["Payroll", latestPayroll?.status ?? "-", latestPayroll?.payrollPeriod?.name || "No payroll record"],
    ["Unread Notifications", unreadNotifications, "Personal updates"],
  ];

  return <main className="dashboard-shell">
    {deniedFeature && <div className="access-denied-banner"><strong>Akses dibatasi</strong><span>Role {user.role} tidak memiliki akses ke fitur {deniedFeature}.</span></div>}
    <div className="dashboard-hero"><div><span className="dashboard-eyebrow">SMARTOPS WORKSPACE</span><h1>Good day, {user.name}</h1><p>Your operational overview for today.</p></div><div className="dashboard-hero-meta"><strong>{user.role}</strong><span>{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}</span></div></div>
    <section className="dashboard-kpi-grid">{kpis.map(([label, value, detail]) => <Kpi key={label} label={label} value={value} detail={detail} />)}</section>

    <section className="dashboard-content-grid">
      <div className="dashboard-card"><CardHeader title={management ? "Attendance Overview" : "My Attendance"} subtitle={management ? "Today's workforce status" : "Your latest attendance record"} href="/attendance" label="View attendance" /><DataState error={management ? errors.hr : errors.attendance}>{management ? <div className="dashboard-bars"><Bar label="Present" value={hr.attendance?.present || 0} max={Math.max(hr.employees?.active || 1, 1)} tone="green" /><Bar label="Late" value={hr.attendance?.late || 0} max={Math.max(hr.employees?.active || 1, 1)} tone="amber" /><Bar label="Not clocked in" value={hr.attendance?.notClockedIn || 0} max={Math.max(hr.employees?.active || 1, 1)} tone="slate" /></div> : <div className="dashboard-attendance-highlight"><strong>{todayAttendance?.status || "Not clocked in"}</strong><span>Clock in: {formatTime(todayAttendance?.clockIn)}</span><span>Clock out: {formatTime(todayAttendance?.clockOut)}</span></div>}</DataState></div>
      <div className="dashboard-card"><CardHeader title="Request Status" subtitle="Latest request activity" href="/requests" label="View all" /><DataState error={errors.requests}><div className="dashboard-bars"><Bar label="Pending" value={requestCounts.PENDING || 0} max={Math.max(requests.length, 1)} tone="amber" /><Bar label="Approved" value={requestCounts.APPROVED || 0} max={Math.max(requests.length, 1)} tone="green" /><Bar label="Rejected" value={requestCounts.REJECTED || 0} max={Math.max(requests.length, 1)} tone="red" /></div></DataState></div>
      <div className="dashboard-card"><CardHeader title={management ? "Leave Overview" : "My Leave"} subtitle={management ? "Organization leave status" : "Your latest leave requests"} href="/leaves" label="View leave" /><DataState error={errors.leaves}><div className="dashboard-bars"><Bar label="Pending" value={management ? hr.leave?.pending || 0 : leaveCounts.PENDING || 0} max={Math.max(leaves.length, 1)} tone="amber" /><Bar label="Approved" value={management ? hr.leave?.approved || 0 : leaveCounts.APPROVED || 0} max={Math.max(leaves.length, 1)} tone="green" /><Bar label="Currently on leave" value={hr.leave?.currentlyOnLeave || 0} max={Math.max(hr.employees?.active || 1, 1)} tone="blue" /></div></DataState></div>
      <div className="dashboard-card"><CardHeader title="Documents" subtitle={management ? "Contract and document compliance" : "Your documents"} href="/documents" label="Open document center" /><DataState error={errors.documents}><div className="dashboard-documents"><div><strong>{documentSummary.total ?? "-"}</strong><span>total documents</span></div><div><strong>{documentSummary.expiring ?? "-"}</strong><span>expiring soon</span></div><div><strong>{documentSummary.expired ?? "-"}</strong><span>expired</span></div></div>{documentRows.length > 0 && <ul className="dashboard-document-list">{documentRows.slice(0, 3).map((document) => <li key={document.id}><Link href={`/documents/${document.id}`}><strong>{document.title}</strong><small>{document.category}</small></Link><span className={`dashboard-document-status ${String(document.status).toLowerCase()}`}>{document.status}</span></li>)}</ul>}</DataState></div>
    </section>

    <section className="dashboard-card"><CardHeader title="Payroll Snapshot" subtitle={management ? "Latest payroll cycle" : "Your latest payroll record"} href={management ? "/payroll" : "/my-payroll"} label="Open payroll" /><DataState error={errors.payroll}>{latestPayroll ? <div className="dashboard-payroll-summary"><div><span>Period</span><strong>{management ? latestPayroll.name : latestPayroll.payrollPeriod?.name || "-"}</strong></div><div><span>Status</span><StatusBadge value={latestPayroll.status} /></div><div><span>{management ? "Period end" : "Net salary"}</span><strong>{management ? formatDate(latestPayroll.periodEnd) : latestPayroll.netSalary ? Number(latestPayroll.netSalary).toLocaleString("id-ID") : "-"}</strong></div></div> : <div className="dashboard-empty">Belum ada data payroll.</div>}</DataState></section>

    <section className="dashboard-bottom-grid"><div className="dashboard-card"><CardHeader title="Recent Activity" subtitle={management ? "Latest system activity" : "Your latest updates"} href="/notifications" label="Notifications" /><DataState error={management ? errors.hr : errors.notifications}>{activity.length ? <ul className="dashboard-activity-list">{activity.map((item) => <li key={item.id}><span className="activity-dot" /><div><strong>{item.title || item.action || "Activity"}</strong><small>{item.message || item.entity || "System update"}</small></div><time>{formatDate(item.createdAt)}</time></li>)}</ul> : <div className="dashboard-empty">Belum ada aktivitas terbaru.</div>}</DataState></div><div className="dashboard-card"><CardHeader title="Quick Actions" subtitle="Common tasks for your role" /><div className="dashboard-quick-actions"><QuickAction href="/leaves/create" label="Ajukan Cuti" /><QuickAction href="/requests/create" label="Buat Request" /><QuickAction href="/attendance/corrections" label="Koreksi Absensi" /><QuickAction href="/documents" label="Lihat Dokumen" />{management && <QuickAction href="/documents/new" label="Upload Dokumen" />}<QuickAction href="/my-payroll" label="Lihat Payroll" /></div></div></section>

    <section className="dashboard-card dashboard-table-card"><CardHeader title="Latest Requests" subtitle="Recent requests visible to your role" href="/requests" label="Open request center" /><DataState error={errors.requests}>{requests.length ? <table><thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Created</th></tr></thead><tbody>{requests.slice(0, 5).map((request) => <tr key={request.id}><td><strong>{request.title}</strong></td><td>{requestTypeLabel(request.type)}</td><td><StatusBadge value={request.status} /></td><td>{formatDate(request.createdAt)}</td></tr>)}</tbody></table> : <div className="dashboard-empty">Belum ada request.</div>}</DataState></section>
  </main>;
}

function CardHeader({ title, subtitle, href, label }) {
  return <div className="dashboard-card-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{href && <Link href={href}>{label}</Link>}</div>;
}
