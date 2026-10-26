"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function buildPermissions(sections) {
  return Object.fromEntries(
    sections.flatMap((section) =>
      section.features.map((feature) => [feature.key, feature.roles])
    )
  );
}

function updateFeature(sections, featureKey, role, enabled) {
  return sections.map((section) => ({
    ...section,
    features: section.features.map((feature) => {
      if (feature.key !== featureKey || feature.locked[role]) return feature;
      return {
        ...feature,
        roles: {
          ...feature.roles,
          [role]: enabled,
        },
      };
    }),
  }));
}

function resetToDefaults(sections, roles) {
  return sections.map((section) => ({
    ...section,
    features: section.features.map((feature) => ({
      ...feature,
      roles: Object.fromEntries(
        roles.map(({ key }) => [
          key,
          feature.locked[key]
            ? feature.roles[key]
            : feature.defaultRoles.includes(key),
        ])
      ),
    })),
  }));
}

function roleCount(sections, role) {
  return sections
    .flatMap((section) => section.features)
    .filter((feature) => feature.roles[role]).length;
}

export default function AccessControlForm({ initialMatrix }) {
  const router = useRouter();
  const roles = initialMatrix.roles;
  const [sections, setSections] = useState(initialMatrix.sections);
  const [savedSections, setSavedSections] = useState(initialMatrix.sections);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const dirty = useMemo(
    () => JSON.stringify(sections) !== JSON.stringify(savedSections),
    [sections, savedSections]
  );

  function toggle(featureKey, role, checked) {
    setNotice("");
    setError("");
    setSections((current) => updateFeature(current, featureKey, role, checked));
  }

  function restoreDefaults() {
    setNotice("");
    setError("");
    setSections((current) => resetToDefaults(current, roles));
  }

  async function save() {
    setSaving(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/access-control", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          permissions: buildPermissions(sections),
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal menyimpan akses fitur");
      }

      setSections(result.data.sections);
      setSavedSections(result.data.sections);
      setNotice(result.message || "Akses fitur berhasil disimpan");
      router.refresh();
    } catch (saveError) {
      setError(saveError.message || "Gagal menyimpan akses fitur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="access-shell">
      <section className="access-summary">
        <div>
          <strong>{roles.length} role</strong>
          <span>
            {sections.flatMap((section) => section.features).length} fitur
            terdaftar
          </span>
        </div>
        <div className="access-summary-note">
          <span className="access-lock-dot" />
          Fitur wajib dan menu Administrasi dikunci untuk mencegah kehilangan
          akses.
        </div>
      </section>

      <section className="access-card">
        <div className="access-card-head">
          <div>
            <h2>Role permission matrix</h2>
            <p>Centang fitur yang boleh diakses oleh masing-masing role.</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={restoreDefaults}
            disabled={saving}
          >
            Restore defaults
          </button>
        </div>

        <div className="access-table-wrap">
          <table className="access-table">
            <thead>
              <tr>
                <th>Feature</th>
                {roles.map((role) => (
                  <th key={role.key} scope="col">
                    <span>{role.label}</span>
                    <small>{roleCount(sections, role.key)} aktif</small>
                  </th>
                ))}
              </tr>
            </thead>
            {sections.map((section) => (
              <tbody key={section.label}>
                <tr className="access-section-row">
                  <th colSpan={roles.length + 1}>{section.label}</th>
                </tr>
                {section.features.map((feature) => (
                  <tr key={feature.key}>
                    <th scope="row">
                      <span className="access-feature-name">
                        {feature.label}
                      </span>
                      <small>{feature.href}</small>
                    </th>
                    {roles.map((role) => {
                      const locked = feature.locked[role.key];
                      const checked = feature.roles[role.key];
                      const lockedLabel = locked
                        ? checked
                          ? "Selalu aktif untuk role ini"
                          : "Tidak tersedia untuk role ini"
                        : `Akses ${feature.label} untuk ${role.label}`;

                      return (
                        <td
                          key={role.key}
                          className={checked ? "is-enabled" : ""}
                        >
                          <label
                            className={`access-check ${locked ? "is-locked" : ""}`}
                            title={lockedLabel}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={locked || saving}
                              aria-label={lockedLabel}
                              onChange={(event) =>
                                toggle(
                                  feature.key,
                                  role.key,
                                  event.target.checked
                                )
                              }
                            />
                            <span aria-hidden="true" />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>

        <div className="access-footer">
          <div aria-live="polite">
            {error ? (
              <span className="access-message access-message-error">
                {error}
              </span>
            ) : notice ? (
              <span className="access-message access-message-success">
                {notice}
              </span>
            ) : dirty ? (
              <span className="access-message">Perubahan belum disimpan.</span>
            ) : (
              <span className="access-message">Semua perubahan tersimpan.</span>
            )}
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={save}
            disabled={!dirty || saving}
          >
            {saving ? "Menyimpan..." : "Save changes"}
          </button>
        </div>
      </section>
    </div>
  );
}
