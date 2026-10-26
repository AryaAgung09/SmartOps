"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function UserTable({ users }) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!deleteTarget) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape" && !deleting) {
        setDeleteTarget(null);
        setDeleteError("");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteTarget, deleting]);

  function openDeleteModal(item) {
    setNotice("");
    setDeleteError("");
    setDeleteTarget({ id: item.id, name: item.name });
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError("");
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/users/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Gagal menghapus user");
      }

      const deletedName = deleteTarget.name;
      setDeleteTarget(null);
      setNotice(`User "${deletedName}" berhasil dihapus.`);
      router.refresh();
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setDeleting(false);
    }
  }

  if (users.length === 0) {
    return (
      <div className="empty-state">
        <h3>User tidak ditemukan</h3>
        <p>Tidak ada user yang sesuai dengan pencarian.</p>
      </div>
    );
  }

  return (
    <>
      {notice && (
        <div className="form-success user-table-notice" role="status">
          {notice}
        </div>
      )}

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

                <td>
                  {item.email ? (
                    item.email
                  ) : (
                    <span className="user-account-missing">Belum ada akun</span>
                  )}
                </td>

                <td>
                  <span className={`user-role role-${item.role.toLowerCase()}`}>
                    {item.role}
                  </span>
                </td>

                <td>{item.department?.name ?? "-"}</td>

                <td>
                  <div className="action-buttons">
                    <button
                      type="button"
                      className="action-edit"
                      onClick={() => router.push(`/users/${item.id}/edit`)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="action-delete"
                      onClick={() => openDeleteModal(item)}
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <div
          className="emp-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDeleteModal();
          }}
        >
          <div
            className="emp-modal user-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
          >
            <span className="emp-modal-icon user-delete-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 11v5M14 11v5" strokeLinecap="round" />
              </svg>
            </span>

            <h2 id="delete-user-title">Hapus user ini?</h2>
            <p>
              User <strong>{deleteTarget.name}</strong> akan dihapus permanen dari SmartOps. Jika
              masih memiliki data karyawan, payroll, atau dokumen terkait, penghapusan akan ditolak.
            </p>

            {deleteError && (
              <div className="doc-form-error" role="alert">
                {deleteError}
              </div>
            )}

            <div className="emp-modal-actions">
              <button
                type="button"
                className="doc-secondary-btn"
                onClick={closeDeleteModal}
                disabled={deleting}
                autoFocus
              >
                Batal
              </button>
              <button
                type="button"
                className="doc-primary-btn user-delete-confirm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Menghapus..." : "Ya, Hapus User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
