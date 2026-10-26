const APP_TZ = "Asia/Jakarta";

function getStartOfDayInTz(date) {
  const d = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(d);
  const year = parts.find((p) => p.type === "year").value;
  const month = parts.find((p) => p.type === "month").value;
  const day = parts.find((p) => p.type === "day").value;
  return new Date(`${year}-${month}-${day}T00:00:00+07:00`);
}

function calculateLeaveDays(startDate, endDate) {
  const start = getStartOfDayInTz(startDate);
  const end = getStartOfDayInTz(endDate);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 0;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
  return diffDays;
}

function getAvailableDays(balance) {
  if (!balance) return 0;
  const allocated = balance.allocatedDays || 0;
  const adjustment = balance.adjustmentDays || 0;
  const used = balance.usedDays || 0;
  const pending = balance.pendingDays || 0;
  return allocated + adjustment - used - pending;
}

module.exports = {
  APP_TZ,
  getStartOfDayInTz,
  calculateLeaveDays,
  getAvailableDays,
};
