export const CONTRACT_TYPES = [
  { value: "PERMANENT", label: "Karyawan Tetap" },
  { value: "FIXED_TERM", label: "Kontrak (PKWT)" },
  { value: "PROBATION", label: "Probation" },
  { value: "INTERNSHIP", label: "Magang" },
  { value: "FREELANCE", label: "Freelance" },
];

export const CONTRACT_TYPE_VALUES = CONTRACT_TYPES.map((type) => type.value);

export function contractTypeLabel(value) {
  return CONTRACT_TYPES.find((type) => type.value === value)?.label || "-";
}
