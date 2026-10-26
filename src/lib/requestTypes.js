export const REQUEST_TYPES = [
  {
    value: "IT_SUPPORT",
    label: "IT Support",
    description:
      "Kendala perangkat, aplikasi, akun, akses, atau kebutuhan bantuan teknis.",
    workflow: ["IT Support"],
  },
  {
    value: "EQUIPMENT",
    label: "Equipment",
    description:
      "Permintaan peralatan kerja, penggantian aset, perbaikan, atau peminjaman.",
    workflow: ["General Affair"],
  },
  {
    value: "FACILITY",
    label: "Facility",
    description:
      "Kebutuhan fasilitas kantor, perbaikan ruangan, kebersihan, dan sarana umum.",
    workflow: ["HR"],
  },
  {
    value: "ADMINISTRATIVE",
    label: "Administrative / HR",
    description:
      "Surat keterangan, dokumen administrasi, data karyawan, dan layanan HR.",
    workflow: ["HR"],
  },
  {
    value: "PROCUREMENT",
    label: "Procurement",
    description:
      "Pengadaan barang atau jasa yang membutuhkan persetujuan biaya.",
    workflow: ["Finance"],
  },
];

export const REQUEST_TYPE_VALUES = REQUEST_TYPES.map((item) => item.value);

export function getRequestType(value) {
  return (
    REQUEST_TYPES.find((item) => item.value === value) || null
  );
}

export function requestTypeLabel(value) {
  return getRequestType(value)?.label || value || "-";
}

export function requestTypeDescription(value) {
  return getRequestType(value)?.description || "";
}

export function requestTypeWorkflow(value) {
  return getRequestType(value)?.workflow || [];
}

export function isRequestType(value) {
  return REQUEST_TYPE_VALUES.includes(value);
}
