export const ATTENDANCE_CORRECTION_TYPES = [
  "CLOCK_IN_MISSING",
  "CLOCK_OUT_MISSING",
  "CLOCK_IN_INCORRECT",
  "CLOCK_OUT_INCORRECT",
  "CLOCK_IN_OUT_INCORRECT",
  "OTHER",
];

export const ATTENDANCE_CORRECTION_REVIEWER_ROLES = ["ADMIN", "HR"];

export function isCorrectionReviewer(actor, employee) {
  if (!actor || !employee) return false;
  if (Number(actor.id) === Number(employee.id)) return false;
  return ATTENDANCE_CORRECTION_REVIEWER_ROLES.includes(actor.role);
}

export function parseOptionalDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
