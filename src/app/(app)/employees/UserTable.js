"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UserTable({ users }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState(null);

  async function handleDelete(id, name) {
    const confirmed = window.confirm(
      `Apakah kamu yakin ingin menghapus user "${name}"?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(id);

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Gagal menghapus user"
        );
      }

      alert("User berhasil dihapus.");

      router.refresh();
    } catch (error) {
      alert(error.message);
    } finally {
      setDeletingId(null);
    }
  }

  if (users.length === 0) {
    return (
      <div className="empty-state">
        <h3>User tidak ditemukan</h3>
        <p>
          Tidak ada user yang sesuai dengan pencarian.
        </p>
      </div>
    );
  }

  return (
    <div className="user-table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nama</th>
            <th>Email</th>
            <th>Role</th>
            <th>Department</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {users.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.name}</strong>
              </td>

              <td>{item.email || "Belum ada akun"}</td>

              <td>
                <span
                  className={`user-role role-${item.role.toLowerCase()}`}
                >
                  {item.role}
                </span>
              </td>

              <td>
                {item.department?.name ?? "-"}
              </td>

              <td>
                <div className="action-buttons">
                  <button
                    type="button"
                    className="action-edit"
                    onClick={() =>
                      router.push(
                        `/users/${item.id}/edit`
                      )
                    }
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="action-delete"
                    onClick={() =>
                      handleDelete(
                        item.id,
                        item.name
                      )
                    }
                    disabled={
                      deletingId === item.id
                    }
                  >
                    {deletingId === item.id
                      ? "Menghapus..."
                      : "Hapus"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}