import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/auth";
import { ROLES, roleLabel } from "@/lib/roles";
import { redirect } from "next/navigation";
import Link from "next/link";

export const instant = false;

const EMPLOYMENT_LABELS = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ON_LEAVE: "On Leave",
  TERMINATED: "Terminated",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

function employeePhotoUrl(employee) {
  if (!employee.profilePhoto) return "";
  if (/^https?:\/\//i.test(employee.profilePhoto)) return employee.profilePhoto;
  return `/api/employees/${employee.id}/photo?v=${encodeURIComponent(employee.profilePhoto)}`;
}

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatSalary(value) {
  if (value === null || value === undefined) return "-";
  return currencyFormatter.format(Number(value));
}

export default async function EmployeesPage({ searchParams }) {
  await connection();

  try {
    await requireFeature("employees");
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      redirect("/login");
    }

    redirect("/dashboard");
  }

  const params = await searchParams;
  const q = (params?.q || "").toString().trim();
  const departmentId = params?.departmentId ? Number(params.departmentId) : null;
  const role = params?.role ? String(params.role).toUpperCase() : "";
  const employmentStatus = params?.employmentStatus || "";
  const page = Math.max(Number(params?.page) || 1, 1);
  const limit = 20;

  const where = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { employeeId: { contains: q } },
    ];
  }
  if (departmentId && !Number.isNaN(departmentId)) where.departmentId = departmentId;
  if (role && ROLES.includes(role)) where.role = role;
  if (employmentStatus && ["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"].includes(employmentStatus)) {
    where.employmentStatus = employmentStatus;
  }

  const skip = (page - 1) * limit;

  const [
    employees,
    total,
    departments,
    totalEmployees,
    activeEmployees,
    onLeaveEmployees,
    inactiveEmployees,
  ] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        department: true,
        manager: { select: { id: true, name: true } },
        salaryStructures: {
          where: { status: "ACTIVE" },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
      },
    }),
    prisma.user.count({ where }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.user.count(),
    prisma.user.count({ where: { employmentStatus: "ACTIVE" } }),
    prisma.user.count({ where: { employmentStatus: "ON_LEAVE" } }),
    prisma.user.count({
      where: { employmentStatus: { in: ["INACTIVE", "TERMINATED"] } },
    }),
  ]);

  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const hasFilters = Boolean(q || departmentId || role || employmentStatus);

  const buildUrl = (overrides = {}) => {
    const p = new URLSearchParams();
    const nq = overrides.q !== undefined ? overrides.q : q;
    const nd = overrides.departmentId !== undefined ? overrides.departmentId : (departmentId || "");
    const nr = overrides.role !== undefined ? overrides.role : role;
    const ns = overrides.employmentStatus !== undefined ? overrides.employmentStatus : employmentStatus;
    const npg = overrides.page !== undefined ? overrides.page : page;
    if (nq) p.set("q", nq);
    if (nd) p.set("departmentId", String(nd));
    if (nr) p.set("role", nr);
    if (ns) p.set("employmentStatus", ns);
    if (npg && Number(npg) > 1) p.set("page", String(npg));
    const s = p.toString();
    return s ? `/employees?${s}` : "/employees";
  };

  return (
    <main className="employees-page">
      <header className="module-page-header">
        <div>
          <span className="module-eyebrow">PEOPLE OPERATIONS</span>
          <h1>Employee Management</h1>
          <p>Kelola direktori karyawan, struktur organisasi, dan status kepegawaian.</p>
        </div>
        <div className="module-page-actions">
          <span className="emp-total-chip">{totalEmployees} employees</span>
          <Link href="/employees/import" className="button-secondary">
            Import Excel
          </Link>
          <Link href="/employees/create" className="button-primary">
            Tambah Employee
          </Link>
        </div>
      </header>

      <section className="emp-stat-grid" aria-label="Employee summary">
        <article className="emp-stat">
          <span>Total workforce</span>
          <strong>{totalEmployees}</strong>
          <small>Seluruh karyawan terdaftar</small>
        </article>
        <article className="emp-stat emp-stat-green">
          <span>Active</span>
          <strong>{activeEmployees}</strong>
          <small>Karyawan dengan status aktif</small>
        </article>
        <article className="emp-stat emp-stat-amber">
          <span>On leave</span>
          <strong>{onLeaveEmployees}</strong>
          <small>Karyawan sedang cuti</small>
        </article>
        <article className="emp-stat emp-stat-slate">
          <span>Inactive / terminated</span>
          <strong>{inactiveEmployees}</strong>
          <small>Karyawan tidak aktif</small>
        </article>
      </section>

      <section className="emp-card">
        <div className="module-section-head">
          <div>
            <h2>Employee directory</h2>
            <p>
              {total} karyawan {hasFilters ? "cocok dengan filter saat ini" : "terdaftar di organisasi"}.
            </p>
          </div>
          <span className="module-chip">{hasFilters ? "Filtered view" : "All employees"}</span>
        </div>

        <form method="get" action="/employees" className="emp-filter-bar">
          <label className="emp-filter-search">
            <span>Cari employee</span>
            <input
              name="q"
              placeholder="Nama, email, atau employee ID"
              defaultValue={q}
            />
          </label>
          <label>
            <span>Department</span>
            <select name="departmentId" defaultValue={departmentId || ""}>
              <option value="">Semua department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Role</span>
            <select name="role" defaultValue={role}>
              <option value="">Semua role</option>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {roleLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select name="employmentStatus" defaultValue={employmentStatus}>
              <option value="">Semua status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </label>
          <div className="emp-filter-actions">
            <button type="submit" className="button-primary">
              Terapkan
            </button>
            <Link href="/employees" className="button-secondary">
              Reset
            </Link>
          </div>
        </form>

        <div className="emp-table-wrap">
          <table className="emp-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Phone</th>
                <th>Department</th>
                <th>Role</th>
                <th>Salary</th>
                <th>Manager</th>
                <th>Status</th>
                <th>Join Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const status = String(employee.employmentStatus || "").toLowerCase();
                const photoUrl = employeePhotoUrl(employee);
                const activeSalary = employee.salaryStructures?.[0]?.basicSalary;
                return (
                  <tr key={employee.id}>
                    <td>
                      <div className="emp-person">
                        <span
                          className={`emp-avatar emp-avatar-${status || "default"} ${photoUrl ? "has-photo" : ""}`}
                          style={photoUrl ? { backgroundImage: `url("${photoUrl}")` } : undefined}
                          aria-hidden={photoUrl ? "true" : undefined}
                        >
                          {!photoUrl && initials(employee.name)}
                        </span>
                        <div>
                          <strong>{employee.name}</strong>
                          <small>
                            {employee.employeeId || "No employee ID"} &middot;{" "}
                            {employee.email || "Belum ada akun"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{employee.phone || "-"}</td>
                    <td>{employee.department?.name || "-"}</td>
                    <td>{roleLabel(employee.role)}</td>
                    <td>{formatSalary(activeSalary)}</td>
                    <td>{employee.manager?.name || "-"}</td>
                    <td>
                      <span className={`ui-status ${status}`}>
                        {EMPLOYMENT_LABELS[employee.employmentStatus] || employee.employmentStatus || "-"}
                      </span>
                    </td>
                    <td>{formatDate(employee.joinDate)}</td>
                    <td>
                      <div className="emp-row-actions">
                        <Link href={`/employees/${employee.id}`} className="emp-action">
                          Detail
                        </Link>
                        <Link
                          href={`/employees/${employee.id}/edit`}
                          className="emp-action emp-action-primary"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="table-empty">
                      <strong>Tidak ada karyawan ditemukan</strong>
                      <span>Coba ubah kata kunci atau filter yang digunakan.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="emp-pagination">
            {page > 1 ? (
              <Link href={buildUrl({ page: page - 1 })} className="button-secondary">
                Sebelumnya
              </Link>
            ) : (
              <span className="button-secondary is-disabled">Sebelumnya</span>
            )}
            <span>
              Halaman {page} dari {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={buildUrl({ page: page + 1 })} className="button-secondary">
                Selanjutnya
              </Link>
            ) : (
              <span className="button-secondary is-disabled">Selanjutnya</span>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
