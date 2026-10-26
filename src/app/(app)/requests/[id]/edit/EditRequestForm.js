"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { REQUEST_TYPES } from "@/lib/requestTypes";
import { DOCUMENT_CATEGORIES } from "@/lib/documents";

export default function EditRequestForm({
  request,
  departments,
  hasApproval,
}) {
  const router = useRouter();

  const [title, setTitle] = useState(
    request.title
  );

  const [type, setType] = useState(
    request.type
  );

  const [documentCategory, setDocumentCategory] =
    useState(request.documentCategory || "");

  const [departmentId, setDepartmentId] =
    useState(
      request.departmentId
        ? String(request.departmentId)
        : ""
    );

  const [description, setDescription] =
    useState(request.description || "");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (type === "ADMINISTRATIVE" && !documentCategory) {
      setError("Kategori dokumen wajib dipilih.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/requests/${request.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            type,
            departmentId:
              departmentId || null,
            description,
            documentCategory:
              type === "ADMINISTRATIVE"
                ? documentCategory
                : null,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            "Gagal memperbarui request"
        );
      }

      router.push(
        `/requests/${request.id}`
      );

      router.refresh();
    } catch (err) {
      setError(
        err.message ||
          "Terjadi kesalahan"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-card">
      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">
            Judul Request
          </label>

          <input
            id="title"
            type="text"
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="type">
            Tipe Request
          </label>

          <select
            id="type"
            value={type}
            onChange={(event) =>
              setType(event.target.value)
            }
            disabled={hasApproval || loading}
            required
          >
            {REQUEST_TYPES.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>

          {hasApproval && (
            <small>
              Tipe request tidak dapat diubah
              karena proses approval sudah
              dimulai.
            </small>
          )}
        </div>

        {type === "ADMINISTRATIVE" && (
          <div className="form-group">
            <label htmlFor="documentCategory">
              Kategori Dokumen
            </label>

            <select
              id="documentCategory"
              value={documentCategory}
              onChange={(event) =>
                setDocumentCategory(
                  event.target.value
                )
              }
              disabled={hasApproval || loading}
              required
            >
              <option value="">
                Pilih Kategori Dokumen
              </option>

              {DOCUMENT_CATEGORIES.map(
                (item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                )
              )}
            </select>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="departmentId">
            Department
          </label>

          <select
            id="departmentId"
            value={departmentId}
            onChange={(event) =>
              setDepartmentId(
                event.target.value
              )
            }
          >
            <option value="">
              Pilih Department
            </option>

            {departments.map(
              (department) => (
                <option
                  key={department.id}
                  value={department.id}
                >
                  {department.name}
                </option>
              )
            )}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="description">
            Deskripsi
          </label>

          <textarea
            id="description"
            rows="6"
            value={description}
            onChange={(event) =>
              setDescription(
                event.target.value
              )
            }
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push(
                `/requests/${request.id}`
              )
            }
            disabled={loading}
          >
            Batal
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading
              ? "Menyimpan..."
              : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}