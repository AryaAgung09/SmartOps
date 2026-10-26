"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CONTRACT_TYPES } from "@/lib/employeeContract";
import { HR_ASSIGNABLE_ROLE_OPTIONS, ROLE_OPTIONS, roleLabel } from "@/lib/roles";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

function employeePhotoUrl(employeeId, profilePhoto) {
  if (!profilePhoto) return "";
  if (/^https?:\/\//i.test(profilePhoto)) return profilePhoto;
  return `/api/employees/${employeeId}/photo?v=${encodeURIComponent(profilePhoto)}`;
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

export default function EditEmployeeForm({ employeeId }) {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [form, setForm] = useState({
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
  });
  const [originalRole, setOriginalRole] = useState("");
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const [empRes, dRes, eRes] = await Promise.all([
          fetch(`/api/employees/${employeeId}`),
          fetch("/api/departments/all"),
          fetch("/api/employees"),
        ]);
        const emp = await empRes.json();
        const d = await dRes.json();
        const e = await eRes.json();
        if (d.success) setDepartments(d.data || []);
        if (e.success) setManagers(e.data || []);
        if (emp.success && emp.data) {
          setOriginalRole(emp.data.role || "STAFF");
          setForm({
            name: emp.data.name || "",
            email: emp.data.email || "",
            password: "",
            role: emp.data.role || "STAFF",
            employeeId: emp.data.employeeId || "",
            phone: emp.data.phone || "",
            address: emp.data.address || "",
            gender: emp.data.gender || "",
            employmentStatus: emp.data.employmentStatus || "ACTIVE",
            joinDate: emp.data.joinDate || "",
            dateOfBirth: emp.data.dateOfBirth || "",
            contractType: emp.data.contractType || "",
            contractStartDate: emp.data.contractStartDate || "",
            contractEndDate: emp.data.contractEndDate || "",
            departmentId: emp.data.departmentId || "",
            managerId: emp.data.managerId || "",
          });
          setPhotoPreview(employeePhotoUrl(employeeId, emp.data.profilePhoto));
        }
      } catch (err) {
        setMessage("Gagal memuat data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [employeeId]);

  useEffect(() => {
    return () => {
      if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setMessage("Format foto harus JPG, PNG, atau WebP.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setMessage("Ukuran foto maksimal 2 MB.");
      event.target.value = "";
      return;
    }

    setMessage("");
    setRemovePhoto(false);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleRemovePhoto() {
    setPhotoFile(null);
    setRemovePhoto(true);
    setPhotoPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (form.contractStartDate && form.contractEndDate && form.contractEndDate < form.contractStartDate) {
      setMessage("Tanggal berakhir kontrak tidak boleh lebih awal dari tanggal mulai.");
      return;
    }

    setSaving(true);
    try {
      if (photoFile) {
        const photoData = new FormData();
        photoData.append("file", photoFile);
        const photoResponse = await fetch(`/api/employees/${employeeId}/photo`, {
          method: "POST",
          body: photoData,
        });
        const photoResult = await photoResponse.json();
        if (!photoResponse.ok || !photoResult.success) {
          throw new Error(photoResult.message || "Gagal mengunggah foto employee");
        }
      } else if (removePhoto) {
        const photoResponse = await fetch(`/api/employees/${employeeId}/photo`, {
          method: "DELETE",
        });
        const photoResult = await photoResponse.json();
        if (!photoResponse.ok || !photoResult.success) {
          throw new Error(photoResult.message || "Gagal menghapus foto employee");
        }
      }

      const payload = { ...form };
      if (role !== "ADMIN") {
        delete payload.email;
        delete payload.password;
      }
      if (!roleEditable) {
        delete payload.role;
      }

      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui employee");
      }
      setPhotoFile(null);
      setRemovePhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("Employee berhasil diperbarui");
      setTimeout(() => router.push(`/employees/${employeeId}`), 800);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Memuat...</p>;

  const roleOptions = role === "ADMIN" ? ROLE_OPTIONS : HR_ASSIGNABLE_ROLE_OPTIONS;
  const roleEditable = role === "ADMIN" || !["ADMIN", "HR"].includes(originalRole);
  const photoStyle = photoPreview
    ? { backgroundImage: `url("${photoPreview}")` }
    : undefined;

  return (
    <form onSubmit={handleSubmit}>
      {message && <p>{message}</p>}
      <div className="profile-photo-editor">
        <div
          className={`profile-photo-preview ${photoPreview ? "has-image" : ""}`}
          style={photoStyle}
          role="img"
          aria-label={photoPreview ? "Preview foto employee" : "Belum ada foto employee"}
        >
          {!photoPreview && (initials(form.name) || "U")}
        </div>
        <div className="profile-photo-copy">
          <strong>Foto employee</strong>
          <p>Unggah foto karyawan. Hanya HR dan Admin yang dapat mengganti foto employee.</p>
          <div className="profile-photo-actions">
            <input
              ref={fileInputRef}
              id="employee-photo-file"
              className="profile-photo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
            />
            <label className="profile-upload-button" htmlFor="employee-photo-file">
              Choose photo
            </label>
            {photoPreview && (
              <button type="button" className="button-secondary" onClick={handleRemovePhoto} disabled={saving}>
                Hapus foto
              </button>
            )}
            <span className="profile-upload-meta">
              {photoFile ? photoFile.name : "JPG, PNG, atau WebP. Maks. 2 MB."}
            </span>
          </div>
        </div>
      </div><br />
      <div><label>Nama</label><br /><input value={form.name} onChange={(e) => update("name", e.target.value)} required /></div><br />
      <div><label>Employee ID</label><br /><input value={form.employeeId} onChange={(e) => update("employeeId", e.target.value)} /></div><br />
      <div><label>Role</label><br />
        {roleEditable ? (
          <select value={form.role} onChange={(e) => update("role", e.target.value)}>
            {roleOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        ) : (
          <input value={roleLabel(originalRole)} readOnly disabled />
        )}
        {!roleEditable && <p>Role user tersebut hanya dapat diubah oleh Admin.</p>}
      </div><br />
      {role === "ADMIN" ? (
        <>
          <div><label>Email akun</label><br /><input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="Kosongkan jika belum ada akun" /></div><br />
          <div><label>Password baru</label><br /><input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="Kosongkan jika tidak diubah" minLength={8} /></div><br />
          <p>
            {form.email
              ? "Akun login aktif. Isi password baru hanya jika ingin mereset password."
              : "Belum ada akun login. Isi email dan password untuk mengaktifkan akun."}
          </p>
        </>
      ) : (
        <p>Akun login dikelola oleh Admin. HR dapat memperbarui data dan role karyawan tanpa mengubah akses login.</p>
      )}
      <div><label>Employment Status</label><br />
        <select value={form.employmentStatus} onChange={(e) => update("employmentStatus", e.target.value)}>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="ON_LEAVE">ON_LEAVE</option>
          <option value="TERMINATED">TERMINATED</option>
        </select>
      </div><br />
      <div><label>Gender</label><br />
        <select value={form.gender} onChange={(e) => update("gender", e.target.value)}>
          <option value="">-</option>
          <option value="MALE">MALE</option>
          <option value="FEMALE">FEMALE</option>
          <option value="OTHER">OTHER</option>
        </select>
      </div><br />
      <div><label>Phone</label><br /><input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div><br />
      <div><label>Alamat</label><br /><input value={form.address} onChange={(e) => update("address", e.target.value)} /></div><br />
      <div><label>Tanggal Lahir</label><br /><input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} /></div><br />
      <div><label>Tanggal Join</label><br /><input type="date" value={form.joinDate} onChange={(e) => update("joinDate", e.target.value)} /></div><br />
      <div><label>Tipe Kontrak</label><br />
        <select value={form.contractType} onChange={(e) => update("contractType", e.target.value)}>
          <option value="">-</option>
          {CONTRACT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
      </div><br />
      <div><label>Mulai Kontrak</label><br /><input type="date" value={form.contractStartDate} onChange={(e) => update("contractStartDate", e.target.value)} /></div><br />
      <div><label>Berakhir Kontrak</label><br /><input type="date" value={form.contractEndDate} min={form.contractStartDate || undefined} onChange={(e) => update("contractEndDate", e.target.value)} /></div><br />
      <div><label>Department</label><br />
        <select value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)}>
          <option value="">-</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div><br />
      <div><label>Manager</label><br />
        <select value={form.managerId} onChange={(e) => update("managerId", e.target.value)}>
          <option value="">-</option>
          {managers.filter((m) => String(m.id) !== String(employeeId)).map((m) => <option key={m.id} value={m.id}>{m.name} ({m.email || "Belum ada akun"})</option>)}
        </select>
      </div><br />
      <button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
      <button type="button" onClick={() => router.push(`/employees/${employeeId}`)} style={{ marginLeft: 10 }}>Batal</button>
    </form>
  );
}
