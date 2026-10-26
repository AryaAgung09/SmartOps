"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { roleLabel } from "@/lib/roles";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

function getPhotoUrl(profile) {
  const value = profile?.profilePhoto;
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `/api/me/profile/photo?v=${encodeURIComponent(value)}`;
}

export default function MyProfilePage() {
  const { data: session, status: sessionStatus } = useSession();
  const canChangePhoto = ["ADMIN", "HR"].includes(session?.user?.role);
  const sessionLoading = sessionStatus === "loading";
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ phone: "", address: "" });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("success");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/me/profile");
        const result = await response.json();
        if (result.success) {
          setProfile(result.data);
          setForm({
            phone: result.data.phone || "",
            address: result.data.address || "",
          });
          setPhotoPreview(getPhotoUrl(result.data));
        } else {
          setMessage(result.message || "Gagal memuat profile");
          setMessageKind("error");
        }
      } catch {
        setMessage("Gagal memuat profile");
        setMessageKind("error");
      }
    }
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function handlePhotoChange(event) {
    if (!canChangePhoto) {
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setMessage("Format foto harus JPG, PNG, atau WebP.");
      setMessageKind("error");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setMessage("Ukuran foto maksimal 2 MB.");
      setMessageKind("error");
      event.target.value = "";
      return;
    }

    setMessage("");
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      let nextPhoto = profile.profilePhoto || null;

      if (photoFile && !canChangePhoto) {
        throw new Error("Hanya HR dan Admin yang dapat mengganti foto profile");
      }

      if (photoFile) {
        const photoData = new FormData();
        photoData.append("file", photoFile);
        const uploadResponse = await fetch("/api/me/profile/photo", {
          method: "POST",
          body: photoData,
        });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadResult.success) {
          throw new Error(uploadResult.message || "Gagal mengunggah foto profile");
        }
        nextPhoto = uploadResult.data.profilePhoto;
      }

      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui profile");
      }

      const updatedProfile = { ...result.data, profilePhoto: nextPhoto };
      setProfile(updatedProfile);
      setForm({
        phone: updatedProfile.phone || "",
        address: updatedProfile.address || "",
      });
      setPhotoPreview(getPhotoUrl(updatedProfile));
      setPhotoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("Profile berhasil diperbarui");
      setMessageKind("success");
    } catch (error) {
      setMessage(error.message);
      setMessageKind("error");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <main className="profile-layout">
        <div className="dashboard-loading">
          <div className="dashboard-spinner" />
          <p>{message || "Memuat profile..."}</p>
        </div>
      </main>
    );
  }

  const initials = profile.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const photoStyle = photoPreview
    ? { backgroundImage: `url("${photoPreview}")` }
    : undefined;

  return (
    <main className="profile-layout">
      <div className="profile-hero">
        <div
          className={`profile-avatar ${photoPreview ? "has-image" : ""}`}
          style={photoStyle}
          role="img"
          aria-label={photoPreview ? "Profile photo" : "Profile initials"}
        >
          {!photoPreview && (initials || "U")}
        </div>
        <div>
          <h1>{profile.name}</h1>
          <p>
            {roleLabel(profile.role)} &middot; {profile.employeeId || "Employee profile"}
          </p>
        </div>
      </div>

      {message && (
        <p className={messageKind === "error" ? "form-error" : "form-success"}>
          {message}
        </p>
      )}

      <div className="profile-grid">
        <section className="profile-card">
          <h2>Personal &amp; Work Information</h2>
          <dl className="profile-details">
            <div><dt>Email</dt><dd>{profile.email}</dd></div>
            <div><dt>Employee ID</dt><dd>{profile.employeeId || "-"}</dd></div>
            <div><dt>Department</dt><dd>{profile.department?.name || "-"}</dd></div>
            <div><dt>Role</dt><dd>{roleLabel(profile.role)}</dd></div>
            <div><dt>Date of Birth</dt><dd>{profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString("id-ID") : "-"}</dd></div>
            <div><dt>Gender</dt><dd>{profile.gender || "-"}</dd></div>
            <div><dt>Status</dt><dd><span className={`ui-status ${String(profile.employmentStatus || "").toLowerCase()}`}>{profile.employmentStatus || "-"}</span></dd></div>
            <div><dt>Join Date</dt><dd>{profile.joinDate ? new Date(profile.joinDate).toLocaleDateString("id-ID") : "-"}</dd></div>
            <div><dt>Manager</dt><dd>{profile.manager?.name || "-"}</dd></div>
          </dl>
        </section>

        <section className="profile-card profile-contact-card">
          <div className="profile-card-head">
            <div>
              <span className="profile-card-eyebrow">PERSONAL CONTACT</span>
              <h2>Update Contact</h2>
              <p>
                {sessionLoading
                  ? "Memuat akses perubahan foto profile..."
                  : canChangePhoto
                    ? "Perbarui foto profil dan detail kontak agar tim HR mudah menghubungi Anda."
                    : "Perbarui detail kontak agar tim HR mudah menghubungi Anda. Perubahan foto dilakukan oleh HR atau Admin."}
              </p>
            </div>
            <span className="profile-card-badge">Contact profile</span>
          </div>

          <form className="profile-contact-form" onSubmit={save}>
            <div className="profile-photo-editor">
              <div
                className={`profile-photo-preview ${photoPreview ? "has-image" : ""}`}
                style={photoStyle}
                role="img"
                aria-label={photoPreview ? "Preview foto profile" : "Belum ada foto profile"}
              >
                {!photoPreview && <span>{initials || "U"}</span>}
              </div>
              <div className="profile-photo-copy">
                <strong>Profile picture</strong>
                {sessionLoading ? (
                  <p>Memuat akses foto profile...</p>
                ) : canChangePhoto ? (
                  <>
                    <p>Unggah foto langsung dari perangkat Anda. Foto akan ditampilkan pada profil.</p>
                    <div className="profile-photo-actions">
                      <input
                        ref={fileInputRef}
                        id="profile-photo-file"
                        className="profile-photo-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoChange}
                      />
                      <label className="profile-upload-button" htmlFor="profile-photo-file">
                        Choose photo
                      </label>
                      <span className="profile-upload-meta">
                        {photoFile ? photoFile.name : "JPG, PNG, atau WebP. Maks. 2 MB."}
                      </span>
                    </div>
                  </>
                ) : (
                  <p>Hanya HR dan Admin yang dapat mengganti foto profile. Hubungi HR jika foto perlu diperbarui.</p>
                )}
              </div>
            </div>

            <div className="profile-form-grid">
              <label className="profile-field profile-field-wide" htmlFor="profile-phone">
                <span>Phone number</span>
                <input
                  id="profile-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+62 812 3456 7890"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
                <small>Nomor aktif yang dapat dihubungi tim HR.</small>
              </label>
              <label className="profile-field profile-field-wide" htmlFor="profile-address">
                <span>Address</span>
                <textarea
                  id="profile-address"
                  rows={4}
                  autoComplete="street-address"
                  placeholder="Alamat domisili lengkap"
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                />
                <small>Alamat ini digunakan untuk keperluan administrasi kepegawaian.</small>
              </label>
            </div>

            <div className="profile-form-actions">
              <span className="profile-form-note">Pastikan data kontak sudah benar sebelum disimpan.</span>
              <button type="submit" className="profile-save-button" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
