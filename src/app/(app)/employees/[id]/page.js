import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/auth";
import { categoryLabel } from "@/lib/documents";
import { contractTypeLabel } from "@/lib/employeeContract";
import { roleLabel } from "@/lib/roles";
import { redirect } from "next/navigation";
import Link from "next/link";

export const instant = false;

function employeePhotoUrl(employee) {
  if (!employee.profilePhoto) return "";
  if (/^https?:\/\//i.test(employee.profilePhoto)) return employee.profilePhoto;
  return `/api/employees/${employee.id}/photo?v=${encodeURIComponent(employee.profilePhoto)}`;
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

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatSalary(value) {
  if (value === null || value === undefined) return "-";
  return currencyFormatter.format(Number(value));
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("id-ID") : "-";
}

export default async function EmployeeDetailPage({ params }) {
  const { id } = await params;
  const userId = Number(id);

  let user;
  try {
    user = await requireFeature("employees");
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      redirect("/login");
    }
    redirect("/dashboard");
  }

  const employee = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      manager: { select: { id: true, name: true, email: true } },
      employeeHistories: { orderBy: { createdAt: "desc" }, take: 100 },
      salaryStructures: { orderBy: { effectiveFrom: "desc" } },
    },
  });

  if (!employee) {
    redirect("/employees");
  }

  const documents = await prisma.employeeDocument.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const photoUrl = employeePhotoUrl(employee);
  const activeSalary = employee.salaryStructures.find((salary) => salary.status === "ACTIVE");
  const photoStyle = photoUrl ? { backgroundImage: `url("${photoUrl}")` } : undefined;

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Detail Employee</h1>
          <p>Informasi karyawan dan riwayat perubahan</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link href={`/employees/${employee.id}/edit`} className="btn">Edit</Link>
          <Link href="/employees" className="btn">Kembali</Link>
        </div>
      </div>

      <section>
        <div className="employee-detail-heading">
          <div
            className={`employee-detail-photo ${photoUrl ? "has-image" : ""}`}
            style={photoStyle}
            role="img"
            aria-label={photoUrl ? `Foto ${employee.name}` : `Inisial ${employee.name}`}
          >
            {!photoUrl && (initials(employee.name) || "U")}
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Data Pribadi & Kepegawaian</h2>
            <p style={{ margin: "6px 0 0" }}>
              {employee.name} &middot; {roleLabel(employee.role)} &middot; {employee.department?.name || "Belum ada department"}
            </p>
          </div>
        </div>
        <table>
          <tbody>
            <tr><td>Employee ID</td><td>{employee.employeeId || "-"}</td></tr>
            <tr><td>Nama</td><td>{employee.name}</td></tr>
            <tr><td>Email</td><td>{employee.email || "Belum ada akun"}</td></tr>
            <tr><td>Role</td><td>{roleLabel(employee.role)}</td></tr>
            <tr><td>Employment Status</td><td>{employee.employmentStatus || "-"}</td></tr>
            <tr><td>Gender</td><td>{employee.gender || "-"}</td></tr>
            <tr><td>Phone</td><td>{employee.phone || "-"}</td></tr>
            <tr><td>Alamat</td><td>{employee.address || "-"}</td></tr>
            <tr><td>Tanggal Lahir</td><td>{formatDate(employee.dateOfBirth)}</td></tr>
            <tr><td>Tanggal Join</td><td>{formatDate(employee.joinDate)}</td></tr>
            <tr><td>Tipe Kontrak</td><td>{contractTypeLabel(employee.contractType)}</td></tr>
            <tr><td>Mulai Kontrak</td><td>{formatDate(employee.contractStartDate)}</td></tr>
            <tr><td>Berakhir Kontrak</td><td>{formatDate(employee.contractEndDate)}</td></tr>
            <tr><td>Department</td><td>{employee.department?.name || "-"}</td></tr>
            <tr><td>Manager</td><td>{employee.manager?.name || "-"}</td></tr>
            <tr><td>Gaji Pokok</td><td>{activeSalary ? formatSalary(activeSalary.basicSalary) : "-"}</td></tr>
            <tr><td>Gaji Berlaku Sejak</td><td>{activeSalary ? formatDate(activeSalary.effectiveFrom) : "-"}</td></tr>
            <tr><td>Status Gaji</td><td>{activeSalary?.status || "-"}</td></tr>
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: "24px" }}>
        <h2>Riwayat Gaji</h2>
        {employee.salaryStructures.length ? (
          <table>
            <thead>
              <tr>
                <th>Gaji Pokok</th>
                <th>Currency</th>
                <th>Berlaku Sejak</th>
                <th>Berlaku Sampai</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employee.salaryStructures.map((salary) => (
                <tr key={salary.id}>
                  <td>{formatSalary(salary.basicSalary)}</td>
                  <td>{salary.currency}</td>
                  <td>{formatDate(salary.effectiveFrom)}</td>
                  <td>{formatDate(salary.effectiveTo)}</td>
                  <td><span className={`ui-status ${String(salary.status || "").toLowerCase()}`}>{salary.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <h3>Belum ada data gaji</h3>
            <p>Data gaji karyawan ini belum ditambahkan.</p>
          </div>
        )}
      </section>

      <section style={{ marginTop: "24px" }}>
        <h2>Employee History</h2>
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Field</th>
              <th>Old</th>
              <th>New</th>
              <th>Changed By</th>
            </tr>
          </thead>
          <tbody>
            {employee.employeeHistories.map((h) => (
              <tr key={h.id}>
                <td>{new Date(h.createdAt).toLocaleString("id-ID")}</td>
                <td>{h.field}</td>
                <td>{h.oldValue || "-"}</td>
                <td>{h.newValue || "-"}</td>
                <td>{h.changedById || "-"}</td>
              </tr>
            ))}
            {employee.employeeHistories.length === 0 && (
              <tr><td colSpan={5}>Tidak ada riwayat</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: "24px" }}>
        <div className="page-header" style={{ marginBottom: "12px" }}>
          <div>
            <h2 style={{ margin: 0 }}>Dokumen Karyawan</h2>
            <p style={{ margin: "4px 0 0" }}>Kontrak, sertifikat, dan dokumen kepegawaian lainnya.</p>
          </div>
          <Link href={`/documents?ownerId=${employee.id}`} className="btn secondary">
            Lihat Semua
          </Link>
        </div>

        {documents.length ? (
          <table>
            <thead>
              <tr>
                <th>Judul</th>
                <th>Kategori</th>
                <th>Terbit</th>
                <th>Kedaluwarsa</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>
                    <Link href={`/documents/${document.id}`}>{document.title}</Link>
                  </td>
                  <td>{categoryLabel(document.category)}</td>
                  <td>{document.issueDate ? new Date(document.issueDate).toLocaleDateString("id-ID") : "-"}</td>
                  <td>{document.expiryDate ? new Date(document.expiryDate).toLocaleDateString("id-ID") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <h3>Belum ada dokumen</h3>
            <p>Dokumen yang diunggah untuk karyawan ini akan muncul di sini.</p>
          </div>
        )}
      </section>
    </main>
  );
}
