"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ROLE_OPTIONS, roleLabel } from "@/lib/roles";

export default function CreateUserPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const currentRole = session?.user?.role;

  const [departments, setDepartments] = useState([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STAFF");
  const [departmentId, setDepartmentId] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("error");

  useEffect(() => {
    async function loadDepartments() {
      try {
        const response = await fetch("/api/departments");
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Gagal mengambil department");
        }

        setDepartments(result.data || []);
      } catch (error) {
        setMessage(error.message);
        setMessageKind("error");
      } finally {
        setLoading(false);
      }
    }

    loadDepartments();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          departmentId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Gagal membuat user");
      }

      setMessage("User berhasil dibuat.");
      setMessageKind("success");

      setTimeout(() => {
        router.push("/users");
        router.refresh();
      }, 800);
    } catch (error) {
      setMessage(error.message);
      setMessageKind("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading || status === "loading") {
    return (
      <main className="doc-page fin-page">
        <div className="doc-dashboard">
          <section className="doc-form-card user-edit-loading">
            <span className="user-edit-loader" aria-hidden="true" />
            <h1>Menambah user</h1>
            <p>Menyiapkan data department dan formulir akun.</p>
          </section>
        </div>
      </main>
    );
  }

  if (currentRole !== "ADMIN") {
    return (
      <main className="doc-page fin-page">
        <div className="doc-dashboard">
          <section className="doc-form-card user-edit-loading">
            <span className="user-edit-denied-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
              </svg>
            </span>
            <h1>Akses dibatasi</h1>
            <p>
              Hanya Admin yang dapat membuat akun user baru. HR dapat menambahkan
              data karyawan dari menu Employee.
            </p>
            <button type="button" className="doc-secondary-btn" onClick={() => router.push("/users")}>
              Kembali ke User Management
            </button>
          </section>
        </div>
      </main>
    );
  }

  const selectedDepartment = departments.find(
    (department) => String(department.id) === departmentId
  );
  const displayName = name.trim() || "User baru";
  const initial = displayName.charAt(0).toUpperCase() || "U";

  return (
    <main className="doc-page fin-page user-create-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">User Management</span>
            <h1>Tambah User</h1>
            <p>
              Buat akun login SmartOps baru, lalu tentukan role dan department
              untuk mengatur akses pengguna.
            </p>
            <div className="doc-hero-tags">
              <span className="doc-live-tag">
                <span />
                Akun login baru
              </span>
              <span className="doc-range-tag">Khusus Admin</span>
            </div>
          </div>
          <div className="emp-head-actions">
            <button type="button" className="doc-secondary-btn" onClick={() => router.push("/users")}>
              Kembali
            </button>
          </div>
        </header>

        <div className="user-create-layout">
          <section className="doc-form-card">
            <form className="doc-form" onSubmit={handleSubmit}>
              <div className="doc-form-head">
                <div>
                  <h2>Informasi Akun</h2>
                  <p>Role akan menentukan menu dan izin yang dapat diakses user.</p>
                </div>
                <span className="user-account-badge pending">Akun baru</span>
              </div>

              {message && (
                <div
                  className={messageKind === "success" ? "form-success" : "doc-form-error"}
                  role="status"
                  aria-live="polite"
                >
                  {message}
                </div>
              )}

              <div className="emp-form-section">
                <div className="emp-form-section-head">
                  <h3>Identitas &amp; Akses</h3>
                  <p>Lengkapi kredensial login dan penempatan pengguna.</p>
                </div>

                <div className="doc-form-grid">
                  <label className="doc-field">
                    <span>Nama Lengkap *</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Contoh: Budi Santoso"
                      autoComplete="name"
                      required
                      disabled={saving}
                    />
                  </label>

                  <label className="doc-field">
                    <span>Email *</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="nama@smartops.com"
                      autoComplete="email"
                      required
                      disabled={saving}
                    />
                    <small>Gunakan email aktif yang belum terdaftar.</small>
                  </label>

                  <label className="doc-field">
                    <span>Password *</span>
                    <div className="user-create-password">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Minimal 6 karakter"
                        autoComplete="new-password"
                        required
                        minLength={6}
                        disabled={saving}
                      />
                      <button
                        type="button"
                        className="user-create-password-toggle"
                        onClick={() => setShowPassword((current) => !current)}
                        disabled={saving}
                        aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      >
                        {showPassword ? "Sembunyikan" : "Tampilkan"}
                      </button>
                    </div>
                    <small>Password tidak dapat dilihat kembali setelah akun dibuat.</small>
                  </label>

                  <label className="doc-field">
                    <span>Role *</span>
                    <select
                      value={role}
                      onChange={(event) => setRole(event.target.value)}
                      disabled={saving}
                      required
                    >
                      {ROLE_OPTIONS.filter(
                        (item) => item.value !== "ADMIN" || currentRole === "ADMIN"
                      ).map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <small>Role menentukan fitur yang bisa diakses.</small>
                  </label>

                  <label className="doc-field doc-field-wide">
                    <span>Department</span>
                    <select
                      value={departmentId}
                      onChange={(event) => setDepartmentId(event.target.value)}
                      disabled={saving}
                    >
                      <option value="">Tanpa department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                    <small>Opsional. Department dapat diubah kembali oleh Admin.</small>
                  </label>
                </div>
              </div>

              <div className="doc-form-actions">
                <button
                  type="button"
                  className="doc-secondary-btn"
                  onClick={() => router.push("/users")}
                  disabled={saving}
                >
                  Batal
                </button>
                <button type="submit" className="doc-primary-btn" disabled={saving}>
                  {saving ? "Menyimpan..." : "Buat User"}
                </button>
              </div>
            </form>
          </section>

          <aside className="user-create-aside">
            <section className="user-create-preview-card">
              <div className="user-create-preview">
                <span className="user-create-preview-avatar">{initial}</span>
                <div className="user-create-preview-copy">
                  <strong>{displayName}</strong>
                  <small>{roleLabel(role)}</small>
                </div>
              </div>

              <dl className="user-create-summary">
                <div>
                  <dt>Email</dt>
                  <dd>{email.trim() || "Belum diisi"}</dd>
                </div>
                <div>
                  <dt>Department</dt>
                  <dd>{selectedDepartment?.name || "Tanpa department"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className="user-create-status">Belum disimpan</span>
                  </dd>
                </div>
              </dl>
            </section>

            <div className="emp-account-note">
              <strong>Periksa sebelum menyimpan</strong>
              <ul className="user-create-checklist">
                <li>Pastikan email belum digunakan oleh akun lain.</li>
                <li>Password minimal 6 karakter dan bersifat rahasia.</li>
                <li>Role menentukan menu yang muncul di sidebar user.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
