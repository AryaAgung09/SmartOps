import { redirect } from "next/navigation";
import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { getHrDashboardData } from "@/lib/hrDashboard";

export const instant = false;

function amount(value) {
  if (value === null || value === undefined) return "—";
  return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function percent(part, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((Number(part || 0) / total) * 100));
}

function Icon({ children, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function KpiCard({ tone, icon, label, value, detail }) {
  return (
    <article className={`hr-kpi hr-kpi-${tone}`}>
      <span className="hr-kpi-icon">{icon}</span>
      <div className="hr-kpi-body">
        <span className="hr-kpi-label">{label}</span>
        <strong className="hr-kpi-value">{value}</strong>
        <span className="hr-kpi-detail">{detail}</span>
      </div>
    </article>
  );
}

function AttendanceStat({ label, value, total, tone }) {
  const width = percent(value, total);
  return (
    <div className="hr-att-stat">
      <div className="hr-att-stat-top">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="hr-att-track">
        <span className={tone} style={{ width: `${width}%` }} />
      </div>
      <small>{total ? `${width}% dari karyawan aktif` : "Belum ada data karyawan"}</small>
    </div>
  );
}

function MiniStat({ label, value, hint, tone }) {
  return (
    <div className={`hr-mini-stat${tone ? ` hr-mini-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function CardHeader({ title, subtitle, href, label, chip }) {
  return (
    <div className="hr-card-head">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="hr-card-head-actions">
        {chip && <span className="hr-chip">{chip}</span>}
        {href && (
          <Link href={href} className="hr-card-link">
            {label}
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function HrDashboardPage({ searchParams }) {
  try {
    await requireFeature("hr-dashboard");
  } catch (error) {
    if (error.message === "UNAUTHORIZED") redirect("/login");
    redirect("/dashboard");
  }

  const params = await searchParams;
  const range = params?.range === "month" ? "month" : "today";
  const data = await getHrDashboardData(range);

  const activeRate = percent(data.employees.active, data.employees.total);
  const documentActiveRate = percent(data.documents.active, data.documents.total);
  const attendanceBase = Math.max(data.employees.active, 1);
  const attendanceTotal =
    data.attendance.present + data.attendance.late + data.attendance.absent;

  return (
    <main className="hr-page">
      <div className="hr-dashboard">
        <header className="hr-hero">
          <div className="hr-hero-main">
            <span className="hr-eyebrow">People Operations</span>
            <h1>HR Dashboard</h1>
            <p>
              Ringkasan organisasi dari Employee, Attendance, Leave, Payroll,
              dan Documents dalam satu tampilan.
            </p>
            <div className="hr-hero-tags">
              <span className="hr-live-tag">
                <span />
                Data terbaru
              </span>
              <span className="hr-range-tag">Periode · {data.rangeLabel}</span>
            </div>
          </div>

          <form className="hr-range-form" method="get">
            <label htmlFor="range">Rentang laporan</label>
            <div className="hr-range-control">
              <select id="range" name="range" defaultValue={range}>
                <option value="today">Today</option>
                <option value="month">This Month</option>
              </select>
              <button type="submit">Terapkan</button>
            </div>
          </form>
        </header>

        <section className="hr-kpi-grid" aria-label="Employee overview">
          <KpiCard
            tone="blue"
            label="Total Employees"
            value={data.employees.total}
            detail={`${data.employees.active} aktif · ${data.employees.inactiveOrTerminated} nonaktif`}
            icon={
              <Icon>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </Icon>
            }
          />

          <KpiCard
            tone="green"
            label="Active Workforce"
            value={data.employees.active}
            detail={`${activeRate}% dari total karyawan`}
            icon={
              <Icon>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
                <path d="m9 14 2 2 4-4" />
              </Icon>
            }
          />

          <KpiCard
            tone="amber"
            label="Currently On Leave"
            value={data.leave.currentlyOnLeave}
            detail="Karyawan sedang cuti"
            icon={
              <Icon>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
                <path d="M8 15h2M14 15h2" />
              </Icon>
            }
          />

          <KpiCard
            tone="rose"
            label="Pending Leave"
            value={data.leave.pending}
            detail="Menunggu persetujuan"
            icon={
              <Icon>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </Icon>
            }
          />
        </section>

        <section className="hr-card hr-attendance-card">
          <CardHeader
            title="Attendance Overview"
            subtitle={`Kehadiran karyawan untuk periode ${data.rangeLabel.toLowerCase()}.`}
            href="/attendance"
            label="Lihat attendance"
            chip={`${attendanceTotal} record`}
          />

          <div className="hr-att-grid">
            <AttendanceStat
              label="Present"
              value={data.attendance.present}
              total={attendanceBase}
              tone="green"
            />
            <AttendanceStat
              label="Late"
              value={data.attendance.late}
              total={attendanceBase}
              tone="amber"
            />
            <AttendanceStat
              label="Absent"
              value={data.attendance.absent}
              total={attendanceBase}
              tone="rose"
            />
            <AttendanceStat
              label="Not Clocked In"
              value={data.attendance.notClockedIn}
              total={attendanceBase}
              tone="slate"
            />
          </div>
        </section>

        <div className="hr-split-grid">
          <section className="hr-card">
            <CardHeader
              title="Leave Overview"
              subtitle="Status pengajuan cuti organisasi."
              href="/leaves"
              label="Lihat leave"
            />

            <div className="hr-mini-grid">
              <MiniStat
                label="Pending"
                value={data.leave.pending}
                hint="Perlu ditinjau"
                tone="amber"
              />
              <MiniStat
                label="Approved"
                value={data.leave.approved}
                hint={`Disetujui · ${data.rangeLabel}`}
                tone="green"
              />
              <MiniStat
                label="On Leave"
                value={data.leave.currentlyOnLeave}
                hint="Sedang cuti"
                tone="blue"
              />
            </div>
          </section>

          <section className="hr-card">
            <CardHeader
              title="Documents"
              subtitle="Kepatuhan dokumen dan masa berlaku."
              href="/documents"
              label="Buka documents"
            />

            <div className="hr-doc-top">
              <div className="hr-doc-total">
                <strong>{data.documents.total}</strong>
                <span>Total dokumen</span>
              </div>
              <div className="hr-doc-progress">
                <span>
                  <i style={{ width: `${documentActiveRate}%` }} />
                </span>
                <small>{documentActiveRate}% aktif</small>
              </div>
            </div>

            <div className="hr-mini-grid hr-mini-grid-2">
              <MiniStat
                label="Expiring"
                value={data.documents.expiring}
                hint="Dalam 30 hari"
                tone="amber"
              />
              <MiniStat
                label="Expired"
                value={data.documents.expired}
                hint="Perlu diperbarui"
                tone="rose"
              />
              <MiniStat
                label="Archived"
                value={data.documents.archived}
                hint="Diarsipkan"
                tone="slate"
              />
            </div>
          </section>
        </div>

        <section className="hr-card">
          <CardHeader
            title="Payroll Snapshot"
            subtitle="Ringkasan periode payroll terbaru."
            href="/payroll"
            label="Buka payroll"
            chip={`${data.payroll.periods} periode`}
          />

          <div className="hr-payroll-grid">
            <MiniStat label="Payroll Periods" value={data.payroll.periods} hint="Total periode" />
            <MiniStat
              label="Latest Period"
              value={data.payroll.latestPeriod?.name || "—"}
              hint={
                data.payroll.latestPeriod?.status
                  ? `Status · ${data.payroll.latestPeriod.status}`
                  : "Belum ada periode"
              }
              tone="blue"
            />
            <MiniStat label="Gross Salary" value={amount(data.payroll.gross)} hint="Total gaji kotor" />
            <MiniStat label="Net Salary" value={amount(data.payroll.net)} hint="Total take home pay" tone="green" />
          </div>
        </section>

        <section className="hr-card hr-table-card">
          <CardHeader
            title="Recent Activity"
            subtitle="Aktivitas audit terbaru di sistem."
            href="/notifications"
            label="Lihat notifikasi"
          />

          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="hr-activity">
                        <span className="hr-activity-dot" />
                        <strong>{item.action}</strong>
                      </span>
                    </td>
                    <td>
                      <span className="hr-entity">{item.entity}</span>
                    </td>
                    <td className="hr-time">{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
                {!data.recentActivity.length && (
                  <tr>
                    <td colSpan={3}>
                      <div className="hr-empty">Belum ada aktivitas.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
