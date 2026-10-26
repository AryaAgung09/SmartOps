import { ROLE_LABELS } from "./roles";

const BASE_SALARY = 6000000;

export const CONTRACT_SALARY_FACTORS = {
  PERMANENT: { factor: 1.15, label: "Karyawan Tetap" },
  FIXED_TERM: { factor: 1, label: "Kontrak (PKWT)" },
  PROBATION: { factor: 0.85, label: "Probation" },
  INTERNSHIP: { factor: 0.55, label: "Magang" },
  FREELANCE: { factor: 0.9, label: "Freelance" },
};

export function getRoleSalaryBand(role) {
  const normalizedRole = String(role || "").trim().toUpperCase();
  return {
    baseSalary: BASE_SALARY,
    label: ROLE_LABELS[normalizedRole] || ROLE_LABELS.STAFF,
  };
}

export function calculateEmployeeSalary({ role, contractType }) {
  const contract = CONTRACT_SALARY_FACTORS[String(contractType || "").toUpperCase()];
  if (!contract) return null;

  const band = getRoleSalaryBand(role);
  const rawAmount = band.baseSalary * contract.factor;
  const amount = Math.round(rawAmount / 50000) * 50000;

  return {
    amount,
    baseSalary: band.baseSalary,
    salaryBand: band.label,
    contractFactor: contract.factor,
    contractLabel: contract.label,
  };
}
