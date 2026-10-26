"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function ModalIcon({ kind }) {
  if (kind === "success") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M12 8v5" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r=".8" fill="currentColor" stroke="none" />
      <path d="M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
    </svg>
  );
}

export default function ImportEmployeesPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);

  function selectFile(event) {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!file) {
      setMessage("Pilih file Excel terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/employees/import", {
        method: "POST",
        body: data,
      });
      const body = await response.json();

      if (!response.ok || !body.success) {
        setResult({
          kind: "error",
          title: "Import gagal",
          message: body.message || "File Excel tidak dapat diproses.",
          imported: 0,
          failed: 0,
          errors: [],
        });
        return;
      }

      setResult({
        kind: body.data.imported > 0 ? "success" : "warning",
        title: body.data.imported > 0 ? "Import Excel selesai" : "Tidak ada data yang diimpor",
        message: body.message,
        imported: body.data.imported,
        failed: body.data.failed,
        errors: body.data.errors || [],
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (error) {
      setResult({
        kind: "error",
        title: "Import gagal",
        message: error.message || "Terjadi kesalahan saat mengimpor file.",
        imported: 0,
        failed: 0,
        errors: [],
      });
    } finally {
      setLoading(false);
    }
  }

  function closeResult() {
    setResult(null);
    requestAnimationFrame(() => fileInputRef.current?.focus());
  }

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">People Operations</span>
            <h1>Import Employee Excel</h1>
            <p>Tambahkan banyak karyawan sekaligus dari template Excel SmartOps.</p>
          </div>
          <div className="emp-head-actions">
            <Link href="/employees/create" className="doc-secondary-btn">
              Tambah Manual
            </Link>
            <Link href="/employees" className="doc-secondary-btn">
              Kembali
            </Link>
          </div>
        </header>

        <section className="doc-form-card">
          <div className="emp-import-body">
            <div className="emp-import-intro">
              <div>
                <h2>Mulai import dalam 3 langkah</h2>
                <p>
                  Gaji pokok tidak perlu diisi. SmartOps menghitung otomatis berdasarkan role
                  dan tipe kontrak.
                </p>
              </div>
              <span className="module-chip">Format .xlsx</span>
            </div>

            <div className="emp-import-grid">
              <article className="emp-import-card">
                <span className="emp-import-step">01</span>
                <h3>Download template</h3>
                <p>
                  Gunakan template resmi agar nama kolom, format tanggal, dan pilihan data sesuai
                  dengan sistem.
                </p>
                <a
                  href="/api/employees/import/template"
                  className="doc-secondary-btn"
                  download
                >
                  Download Template Excel
                </a>
              </article>

              <article className="emp-import-card">
                <span className="emp-import-step">02</span>
                <h3>Isi data karyawan</h3>
                <p>
                  Hapus baris contoh, lalu isi data. Maksimal 500 karyawan per file dengan ukuran
                  maksimal 5 MB.
                </p>
                <ul className="emp-import-list">
                  <li>Nama dan tipe kontrak wajib diisi. Role opsional dan default-nya Staf.</li>
                  <li>Email dan password opsional. Admin dapat mengisi keduanya untuk membuat akun login, atau mengosongkannya untuk karyawan tanpa akun website. HR selalu menambahkan karyawan tanpa akun.</li>
                  <li>Department dan manager memakai nama atau email yang sudah terdaftar.</li>
                  <li>Tanggal memakai format YYYY-MM-DD atau DD/MM/YYYY.</li>
                </ul>
              </article>

              <article className="emp-import-card emp-import-card-upload">
                <span className="emp-import-step">03</span>
                <h3>Upload dan import</h3>
                <p>Pilih file yang sudah diisi, lalu jalankan import.</p>

                {message && <div className="doc-form-error" role="alert">{message}</div>}

                <form className="emp-import-form" onSubmit={handleSubmit}>
                  <label className="emp-file-picker">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={selectFile}
                      disabled={loading}
                    />
                    <span className="emp-file-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                        <path d="M14 3v5h5" strokeLinejoin="round" />
                        <path d="M6 3h8l5 5v13H6V3Z" strokeLinejoin="round" />
                        <path d="M9 13h6M9 17h4" strokeLinecap="round" />
                      </svg>
                    </span>
                    <strong>{file ? file.name : "Pilih file Excel"}</strong>
                    <small>{file ? "Klik untuk mengganti file" : "Hanya file .xlsx"}</small>
                  </label>

                  <button type="submit" className="doc-primary-btn" disabled={loading}>
                    {loading ? "Mengimpor..." : "Import Karyawan"}
                  </button>
                </form>
              </article>
            </div>
          </div>
        </section>
      </div>

      {result && (
        <div className="emp-modal-backdrop" role="presentation">
          <div
            className={`emp-modal emp-result-modal ${result.kind}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-result-title"
          >
            <button type="button" className="emp-modal-close" onClick={closeResult} aria-label="Tutup">
              &times;
            </button>
            <span className="emp-modal-icon">
              <ModalIcon kind={result.kind} />
            </span>
            <h2 id="import-result-title">{result.title}</h2>
            <p>{result.message}</p>

            {(result.imported > 0 || result.failed > 0) && (
              <div className="emp-import-result-stats">
                <div>
                  <strong>{result.imported}</strong>
                  <span>berhasil</span>
                </div>
                <div>
                  <strong>{result.failed}</strong>
                  <span>gagal</span>
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="emp-import-errors">
                <strong>Detail baris gagal</strong>
                <ul>
                  {result.errors.map((error) => (
                    <li key={`${error.row}-${error.message}`}>
                      <b>Baris {error.row}</b>
                      <span>{error.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="emp-modal-actions">
              <button type="button" className="doc-secondary-btn" onClick={closeResult}>
                {result.imported > 0 ? "Import Lagi" : "Tutup"}
              </button>
              {result.imported > 0 && (
                <button type="button" className="doc-primary-btn" onClick={() => router.push("/employees")}>
                  Lihat Direktori
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
