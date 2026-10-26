"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CONTRACT_TYPES } from "@/lib/employeeContract";
import { calculateEmployeeSalary } from "@/lib/employeeSalary";
import { HR_ASSIGNABLE_ROLE_OPTIONS, ROLE_OPTIONS } from "@/lib/roles";

const EMPLOYMENT_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "TERMINATED", label: "Terminated" },
];

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
  role: "STAFF",
  employeeId: "",
  phone: "",
  address: "",
  gender: "",
  employmentStatus: "ACTIVE",
  joinDate: "",
  dateOfBirth: "",
  contractType: "",
  contractStartDate: "",
  contractEndDate: "",
  departmentId: "",
  managerId: "",
};

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export default function CreateEmployeePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const sessionRole = session?.user?.role;
  const canManageAccount = sessionRole === "ADMIN";
  const roleOptions = canManageAccount ? ROLE_OPTIONS : HR_ASSIGNABLE_ROLE_OPTIONS;

  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [createAccount, setCreateAccount] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("error");
  const [createdEmployee, setCreatedEmployee] = useState(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const [dRes, eRes] = await Promise.all([
          fetch("/api/departments/all"),
          fetch("/api/employees"),
        ]);
        const d = await dRes.json();
        const e = await eRes.json();
        if (d.success) setDepartments(d.data || []);
        if (e.success) setManagers(e.data || []);
      } catch {
        setMessage("Sebagian data pilihan gagal dimuat.");
        setMessageKind("error");
      }
    }
    load();
  }, []);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (form.contractStartDate && form.contractEndDate && form.contractEndDate < form.contractStartDate) {
      setMessage("Tanggal berakhir kontrak tidak boleh lebih awal dari tanggal mulai.");
      setMessageKind("error");
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form };
      if (canManageAccount) {
        payload.createAccount = createAccount;
      }
      if (!canManageAccount || !createAccount) {
        delete payload.email;
        delete payload.password;
      }

      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat employee");
      }

      setCreatedEmployee({
        id: result.data.id,
        name: form.name,
        salary: result.data.salary,
        salaryBand: result.data.salaryBand,
        accountCreated: result.data.accountCreated,
      });
      setForm({ ...INITIAL_FORM });
      setCreateAccount(true);
      setMessage("");
    } catch (err) {
      setMessage(err.message);
      setMessageKind("error");
    } finally {
      setLoading(false);
    }
  }

  function closeSuccessModal() {
    setCreatedEmployee(null);
    requestAnimationFrame(() => nameInputRef.current?.focus());
  }

  const salaryPreview = form.contractType
    ? calculateEmployeeSalary({
        role: form.role,
        contractType: form.contractType,
      })
    : null;

  return (
    <main className="doc-page fin-page employee-create-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">People Operations</span>
            <h1>Tambah Employee</h1>
            <p>
              {canManageAccount
                ? "Lengkapi data karyawan. Buat akun login bila diperlukan, atau simpan tanpa akun website."
                : "Tambahkan data karyawan. Akun login hanya dapat dibuat oleh Admin."}
            </p>
          </div>
          <div className="emp-head-actions">
            <Link href="/employees/import" className="doc-secondary-btn">
              Import Excel
            </Link>
            <Link href="/employees" className="doc-secondary-btn">
              Kembali
            </Link>
          </div>
        </header>

        <section className="doc-form-card">
          <form className="doc-form employee-create-form" onSubmit={handleSubmit}>
            <div className="doc-form-head">
              <div>
                <h2>Form Employee Baru</h2>
                <p>Data akan langsung tersimpan ke direktori karyawan SmartOps.</p>
              </div>
              <span className="doc-required-note">* wajib diisi</span>
            </div>

            {message && (
              <div className={messageKind === "success" ? "form-success" : "doc-form-error"}>
                {message}
              </div>
            )}

            <div className="employee-form-layout">
              <div className="employee-form-column">
            <div className="emp-form-section">
              <div className="emp-form-section-head">
                <h3>Identitas Karyawan</h3>
                <p>Nama dan nomor identitas internal karyawan.</p>
              </div>
              <div className="doc-form-grid">
                <label className="doc-field">
                  <span>Nama Lengkap *</span>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    required
                    disabled={loading}
                  />
                </label>

                <label className="doc-field">
                  <span>Employee ID</span>
                  <input
                    type="text"
                    value={form.employeeId}
                    onChange={(event) => update("employeeId", event.target.value)}
                    placeholder="Contoh: EMP-001"
                    disabled={loading}
                  />
                </label>
              </div>
            </div>

            {canManageAccount ? (
              <div className="emp-form-section">
                <div className="emp-form-section-head">
                  <h3>Akun &amp; Akses</h3>
                  <p>Pilih apakah karyawan ini perlu login ke SmartOps.</p>
                </div>

                <label className="emp-account-toggle">
                  <input
                    type="checkbox"
                    checked={createAccount}
                    onChange={(event) => setCreateAccount(event.target.checked)}
                    disabled={loading}
                  />
                  <span>
                    <strong>Buat akun login SmartOps</strong>
                    <small>
                      Nonaktifkan untuk operator, OB, driver, satpam, atau karyawan lain yang
                      tidak memakai website.
                    </small>
                  </span>
                </label>

                {createAccount ? (
                  <div className="doc-form-grid emp-account-fields">
                    <label className="doc-field">
                      <span>Email *</span>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) => update("email", event.target.value)}
                        placeholder="nama@smartops.com"
                        required
                        disabled={loading}
                      />
                    </label>

                    <label className="doc-field">
                      <span>Password *</span>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(event) => update("password", event.target.value)}
                        placeholder="Minimal 8 karakter"
                        minLength={8}
                        required
                        disabled={loading}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="emp-account-note">
                    <strong>Karyawan tanpa akun website</strong>
                    <p>
                      Data karyawan tetap tersimpan tanpa email dan password. Karyawan ini tidak
                      dapat login ke SmartOps. Admin dapat mengaktifkan akun nanti melalui Edit
                      Employee.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="emp-account-note">
                <strong>Akun login belum dibuat</strong>
                <p>
                  HR dapat menyimpan data karyawan tanpa email dan password. Admin dapat
                  mengaktifkan akun nanti melalui menu Edit Employee.
                </p>
              </div>
            )}

            <div className="emp-form-section">
              <div className="emp-form-section-head">
                <h3>Data Pribadi</h3>
                <p>Kontak dan informasi personal yang diperlukan HR.</p>
              </div>
              <div className="doc-form-grid employee-personal-grid">
                <label className="doc-field">
                  <span>Gender</span>
                  <select
                    value={form.gender}
                    onChange={(event) => update("gender", event.target.value)}
                    disabled={loading}
                  >
                    <option value="">Pilih gender</option>
                    <option value="MALE">Laki-laki</option>
                    <option value="FEMALE">Perempuan</option>
                    <option value="OTHER">Lainnya</option>
                  </select>
                </label>

                <label className="doc-field">
                  <span>Tanggal Lahir</span>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(event) => update("dateOfBirth", event.target.value)}
                    disabled={loading}
                  />
                </label>

                <label className="doc-field">
                  <span>Phone</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    placeholder="+62 812 3456 7890"
                    disabled={loading}
                  />
                </label>

                <label className="doc-field doc-field-wide">
                  <span>Alamat</span>
                  <textarea
                    value={form.address}
                    onChange={(event) => update("address", event.target.value)}
                    placeholder="Alamat domisili lengkap"
                    rows={2}
                    disabled={loading}
                  />
                </label>
              </div>
            </div>

              </div>
              <div className="employee-form-column">
            <div className="emp-form-section">
              <div className="emp-form-section-head">
                <h3>Kepegawaian</h3>
                <p>Penempatan organisasi dan status kerja.</p>
              </div>
              <div className="doc-form-grid">
                <label className="doc-field">
                  <span>Department</span>
                  <select
                    value={form.departmentId}
                    onChange={(event) => update("departmentId", event.target.value)}
                    disabled={loading}
                  >
                    <option value="">Pilih department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="doc-field">
                  <span>Role *</span>
                  <select
                    value={form.role}
                    onChange={(event) => update("role", event.target.value)}
                    required
                    disabled={loading}
                  >
                    {roleOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <small>Role menentukan akses login dan perhitungan gaji otomatis.</small>
                </label>

                <label className="doc-field">
                  <span>Manager</span>
                  <select
                    value={form.managerId}
                    onChange={(event) => update("managerId", event.target.value)}
                    disabled={loading}
                  >
                    <option value="">Tanpa manager</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name} ({manager.email || "Belum ada akun"})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="doc-field">
                  <span>Employment Status</span>
                  <select
                    value={form.employmentStatus}
                    onChange={(event) => update("employmentStatus", event.target.value)}
                    disabled={loading}
                  >
                    {EMPLOYMENT_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="doc-field">
                  <span>Tanggal Join</span>
                  <input
                    type="date"
                    value={form.joinDate}
                    onChange={(event) => update("joinDate", event.target.value)}
                    disabled={loading}
                  />
                </label>
              </div>
            </div>

            <div className="emp-form-section">
              <div className="emp-form-section-head">
                <h3>Kontrak Kerja</h3>
                <p>Atur jenis perjanjian kerja dan masa berlakunya.</p>
              </div>
              <div className="doc-form-grid">
                <label className="doc-field doc-field-wide">
                  <span>Tipe Kontrak *</span>
                  <select
                    value={form.contractType}
                    onChange={(event) => update("contractType", event.target.value)}
                    required
                    disabled={loading}
                  >
                    <option value="">Pilih tipe kontrak</option>
                    {CONTRACT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="doc-field">
                  <span>Mulai Kontrak</span>
                  <input
                    type="date"
                    value={form.contractStartDate}
                    onChange={(event) => update("contractStartDate", event.target.value)}
                    disabled={loading}
                  />
                </label>

                <label className="doc-field">
                  <span>Berakhir Kontrak</span>
                  <input
                    type="date"
                    value={form.contractEndDate}
                    onChange={(event) => update("contractEndDate", event.target.value)}
                    min={form.contractStartDate || undefined}
                    disabled={loading}
                  />
                  <small>Kosongkan jika kontrak tidak memiliki tanggal berakhir.</small>
                </label>

                <label className="doc-field doc-field-wide">
                  <span>Gaji Pokok Otomatis</span>
                  <input
                    className="emp-salary-auto"
                    type="text"
                    value={salaryPreview ? currencyFormatter.format(salaryPreview.amount) : ""}
                    placeholder="Pilih tipe kontrak"
                    readOnly
                  />
                  <small>
                    {salaryPreview
                      ? `${salaryPreview.salaryBand} x ${salaryPreview.contractLabel}. Nominal otomatis disimpan sebagai salary aktif.`
                      : "Gaji dihitung otomatis setelah role dan tipe kontrak dipilih."}
                  </small>
                </label>
              </div>
            </div>
              </div>
            </div>

            <div className="doc-form-actions">
              <Link href="/employees" className="doc-secondary-btn">
                Batal
              </Link>
              <button type="submit" className="doc-primary-btn" disabled={loading}>
                {loading ? "Menyimpan..." : "Simpan Employee"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {createdEmployee && (
        <div className="emp-modal-backdrop" role="presentation">
          <div
            className="emp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-created-title"
          >
            <button
              type="button"
              className="emp-modal-close"
              onClick={closeSuccessModal}
              aria-label="Tutup"
            >
              &times;
            </button>
            <span className="emp-modal-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 id="employee-created-title">Karyawan berhasil ditambahkan</h2>
            <p>
              Data <strong>{createdEmployee.name}</strong> sudah tersimpan di direktori karyawan.
            </p>
            {!createdEmployee.accountCreated && (
              <div className="emp-account-note emp-account-note-compact">
                <strong>Akun login belum dibuat</strong>
                <p>Admin dapat mengaktifkan akun karyawan ini dari halaman Edit Employee.</p>
              </div>
            )}
            {createdEmployee.salary ? (
              <div className="emp-modal-summary">
                <span>Gaji pokok otomatis</span>
                <strong>{currencyFormatter.format(createdEmployee.salary)}</strong>
                <small>{createdEmployee.salaryBand}</small>
              </div>
            ) : (
              <div className="emp-modal-summary">
                <span>Gaji pokok otomatis</span>
                <strong>-</strong>
                <small>Role atau tipe kontrak belum dipilih.</small>
              </div>
            )}
            <div className="emp-modal-actions">
              <button type="button" className="doc-secondary-btn" onClick={() => router.push("/employees")}>
                Lihat Direktori
              </button>
              <button type="button" className="doc-primary-btn" onClick={closeSuccessModal}>
                Tambah Karyawan Lagi
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
