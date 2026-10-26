"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ROLE_OPTIONS } from "@/lib/roles";

export default function EditUserForm({ userId }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const currentRole = session?.user?.role;
  const canManageAccount = currentRole === "ADMIN";

  const [user, setUser] = useState(null);
  const [departments, setDepartments] = useState([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAFF");
  const [departmentId, setDepartmentId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("error");
  const nameInputRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [userResponse, departmentResponse] = await Promise.all([
          fetch(`/api/users/${userId}`),
          fetch("/api/departments"),
        ]);

        const userResult = await userResponse.json();
        const departmentResult = await departmentResponse.json();

        if (!userResponse.ok) {
          throw new Error(userResult.message || "Gagal mengambil user");
        }

        if (!departmentResponse.ok) {
          throw new Error(departmentResult.message || "Gagal mengambil department");
        }

        const currentUser = userResult.data;

        setUser(currentUser);
        setDepartments(departmentResult.data || []);

        setName(currentUser.name || "");
        setEmail(currentUser.email || "");
        setRole(currentUser.role || "STAFF");
        setDepartmentId(currentUser.departmentId ? String(currentUser.departmentId) : "");
      } catch (error) {
        setMessage(error.message);
        setMessageKind("error");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [userId]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email && user?.email) {
      setMessage("Email tidak boleh dikosongkan untuk akun yang sudah aktif.");
      setMessageKind("error");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          departmentId,
          ...(canManageAccount ? { email, role } : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Gagal memperbarui user");
      }

      setUser(result.data);
      setMessage("User berhasil diperbarui.");
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
            <h1>Memuat user</h1>
            <p>Menyiapkan data akun dan hak akses.</p>
          </section>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="doc-page fin-page">
        <div className="doc-dashboard">
          <section className="doc-form-card user-edit-loading">
            <h1>User tidak ditemukan</h1>
            <p>{message || "Data user tidak tersedia."}</p>
            <button type="button" className="doc-secondary-btn" onClick={() => router.push("/users")}>
              Kembali ke User Management
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (currentRole === "HR" && user.role === "ADMIN") {
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
            <p>HR tidak memiliki izin untuk mengubah akun ADMIN.</p>
            <button type="button" className="doc-secondary-btn" onClick={() => router.push("/users")}>
              Kembali ke User Management
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">User Management</span>
            <h1>Edit User</h1>
            <p>Perbarui identitas, role, dan penempatan department pengguna SmartOps.</p>
          </div>
          <div className="emp-head-actions">
            <button type="button" className="doc-secondary-btn" onClick={() => router.push("/users")}>
              Kembali
            </button>
          </div>
        </header>

        <section className="doc-form-card">
          <form className="doc-form" onSubmit={handleSubmit}>
            <div className="doc-form-head">
              <div>
                <h2>Informasi Akun</h2>
                <p>Perubahan role akan langsung memengaruhi hak akses user.</p>
              </div>
              <span className={`user-account-badge ${user.email ? "active" : "pending"}`}>
                {user.email ? "Akun aktif" : "Belum ada akun"}
              </span>
            </div>

            {message && (
              <div className={messageKind === "success" ? "form-success" : "doc-form-error"} role="status">
                {message}
              </div>
            )}

            {!user.email && (
              <div className="emp-account-note">
                <strong>User ini belum memiliki akun login</strong>
                <p>
                  Email dan password dapat diaktifkan oleh Admin melalui halaman Edit Employee.
                  Data nama dan department tetap dapat diperbarui di sini.
                </p>
              </div>
            )}

            {!canManageAccount && user.email && (
              <div className="emp-account-note emp-account-note-compact">
                <strong>Akses akun dikelola Admin</strong>
                <p>HR hanya dapat memperbarui nama dan department. Email dan role hanya dapat diubah oleh Admin.</p>
              </div>
            )}

            <div className="emp-form-section">
              <div className="emp-form-section-head">
                <h3>Identitas &amp; Akses</h3>
                <p>
                  {canManageAccount
                    ? "Nama, email login, role, dan department pengguna."
                    : "Nama dan department karyawan. Akses akun dikelola Admin."}
                </p>
              </div>
              <div className="doc-form-grid">
                <label className="doc-field doc-field-wide">
                  <span>Nama Lengkap *</span>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    required
                    disabled={saving}
                  />
                </label>

                <label className="doc-field">
                  <span>Email {user.email ? "*" : ""}</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={user.email ? "nama@smartops.com" : "Belum ada akun"}
                    required={canManageAccount && Boolean(user.email)}
                    disabled={saving || !canManageAccount}
                  />
                  {canManageAccount && !user.email && (
                    <small>Aktifkan akun melalui Edit Employee agar password dapat dibuat.</small>
                  )}
                </label>

                <label className="doc-field">
                  <span>Role *</span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    required={canManageAccount}
                    disabled={saving || !canManageAccount}
                  >
                    {ROLE_OPTIONS.filter(
                      (item) => item.value !== "ADMIN" || currentRole === "ADMIN"
                    ).map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
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
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
