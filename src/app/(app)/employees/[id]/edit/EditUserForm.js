"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ROLE_OPTIONS } from "@/lib/roles";

export default function EditUserForm({ userId }) {
  const router = useRouter();
  const { data: session } = useSession();

  const currentRole = session?.user?.role;

  const [user, setUser] = useState(null);
  const [departments, setDepartments] = useState([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAFF");
  const [departmentId, setDepartmentId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
          throw new Error(
            departmentResult.message || "Gagal mengambil department"
          );
        }

        const currentUser = userResult.data;

        setUser(currentUser);
        setDepartments(departmentResult.data || []);

        setName(currentUser.name);
        setEmail(currentUser.email);
        setRole(currentUser.role);
        setDepartmentId(
          currentUser.departmentId
            ? String(currentUser.departmentId)
            : ""
        );
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [userId]);

  async function handleSubmit(event) {
    event.preventDefault();

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
          email,
          role,
          departmentId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Gagal memperbarui user");
      }

      setUser(result.data);
      setMessage("User berhasil diperbarui.");

      setTimeout(() => {
        router.push("/users");
        router.refresh();
      }, 800);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main>
        <h1>Edit User</h1>
        <p>Memuat data...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main>
        <h1>Edit User</h1>
        <p>{message || "User tidak ditemukan."}</p>
      </main>
    );
  }

  if (currentRole === "HR" && user.role === "ADMIN") {
    return (
      <main>
        <h1>Edit User</h1>
        <p>HR tidak memiliki akses untuk mengubah user ADMIN.</p>

        <button
          type="button"
          onClick={() => router.push("/users")}
        >
          Kembali
        </button>
      </main>
    );
  }

  return (
    <main>
      <h1>Edit User</h1>

      {message && <p>{message}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Nama</label>
          <br />
          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <br />

        <div>
          <label htmlFor="email">Email</label>
          <br />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <br />

        <div>
          <label htmlFor="role">Role</label>
          <br />
          <select
            id="role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {ROLE_OPTIONS.filter(
              (item) =>
                item.value !== "ADMIN" ||
                currentRole === "ADMIN"
            ).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <br />

        <div>
          <label htmlFor="departmentId">Department</label>
          <br />
          <select
            id="departmentId"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            <option value="">-- Pilih Department --</option>

            {departments.map((department) => (
              <option
                key={department.id}
                value={department.id}
              >
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <br />

        <button type="submit" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/users")}
          disabled={saving}
          style={{ marginLeft: "10px" }}
        >
          Batal
        </button>
      </form>
    </main>
  );
}