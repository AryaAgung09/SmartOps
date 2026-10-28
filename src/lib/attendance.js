const APP_TZ = "Asia/Jakarta";

function getDateParts(date) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  return {
    year: Number(parts.find((part) => part.type === "year").value),
    month: Number(parts.find((part) => part.type === "month").value),
    day: Number(parts.find((part) => part.type === "day").value),
  };
}

function getStartOfDayInTz(date) {
  const { year, month, day } = getDateParts(date);
  return new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+07:00`);
}

function getDateOnlyInTz(date) {
  const { year, month, day } = getDateParts(date);
  return new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00.000Z`);
}

function getDateStringInTz(date) {
  const { year, month, day } = getDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getJakartaWeekday(date) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, weekday: "short" }).format(date);
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[weekday];
}

function parseTime(value, fallback) {
  const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return fallback;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getLocalTimeParts(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return {
    hour: Number(parts.find((part) => part.type === "hour").value),
    minute: Number(parts.find((part) => part.type === "minute").value),
  };
}

function getLocalMinutes(date) {
  const { hour, minute } = getLocalTimeParts(date);
  return hour * 60 + minute;
}

function isLate(clockInDate) {
  const dayStart = getStartOfDayInTz(clockInDate);
  const defaultSchedule = normalizeSchedule(null);
  return getAttendanceMetrics(clockInDate, null, dayStart, defaultSchedule).lateMinutes > 0;
}

function timeToMinutes(value) {
  const [hour, minute] = parseTime(value, "08:00").split(":").map(Number);
  return hour * 60 + minute;
}

function createLocalDate(dayStart, time, overnight = false) {
  const { year, month, day } = getDateParts(dayStart);
  const date = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${parseTime(time, "08:00")}:00+07:00`);
  if (overnight) date.setTime(date.getTime() + 24 * 60 * 60 * 1000);
  return date;
}

function normalizeSchedule(schedule) {
  return {
    name: schedule?.name || "Default Schedule",
    startTime: parseTime(schedule?.startTime, "08:00"),
    endTime: parseTime(schedule?.endTime, "17:00"),
    breakMinutes: Math.max(Number(schedule?.breakMinutes ?? 60), 0),
    gracePeriodMinutes: Math.max(Number(schedule?.gracePeriodMinutes ?? 15), 0),
    workingDays: String(schedule?.workingDays || "1,2,3,4,5")
      .split(",")
      .map(Number)
      .filter((day) => day >= 1 && day <= 7),
  };
}

async function getScheduleForUser(prisma, userId) {
  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { workSchedule: true, shift: true },
  });
  if (user?.shift) return normalizeSchedule(user.shift);
  if (user?.workSchedule) return normalizeSchedule(user.workSchedule);
  const fallback = await prisma.workSchedule.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
  return normalizeSchedule(fallback);
}

function getScheduleWindow(dayStart, schedule) {
  const normalized = normalizeSchedule(schedule);
  const overnight = timeToMinutes(normalized.endTime) <= timeToMinutes(normalized.startTime);
  const scheduledStart = createLocalDate(dayStart, normalized.startTime);
  const scheduledEnd = createLocalDate(dayStart, normalized.endTime, overnight);
  const scheduledWorkingMinutes = Math.max(Math.floor((scheduledEnd.getTime() - scheduledStart.getTime()) / 60000) - normalized.breakMinutes, 0);
  return { ...normalized, scheduledStart, scheduledEnd, scheduledWorkingMinutes, overnight };
}

function isWorkingDay(dayStart, schedule) {
  return normalizeSchedule(schedule).workingDays.includes(getJakartaWeekday(dayStart));
}

function getWorkingMinutes(clockIn, clockOut, breakMinutes = 0) {
  if (!clockIn || !clockOut) return null;
  const start = clockIn instanceof Date ? clockIn : new Date(clockIn);
  const end = clockOut instanceof Date ? clockOut : new Date(clockOut);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  return Math.max(Math.floor(diffMs / 60000) - Math.max(Number(breakMinutes || 0), 0), 0);
}

function getAttendanceMetrics(clockIn, clockOut, dayStart, schedule) {
  const window = getScheduleWindow(dayStart, schedule);
  const lateThreshold = new Date(window.scheduledStart.getTime() + window.gracePeriodMinutes * 60000);
  const lateMinutes = clockIn && new Date(clockIn) > lateThreshold
    ? Math.floor((new Date(clockIn).getTime() - lateThreshold.getTime()) / 60000)
    : 0;
  const earlyCheckoutMinutes = clockOut && new Date(clockOut) < window.scheduledEnd
    ? Math.floor((window.scheduledEnd.getTime() - new Date(clockOut).getTime()) / 60000)
    : 0;
  const workingMinutes = getWorkingMinutes(clockIn, clockOut, window.breakMinutes);
  const overtimeMinutes = clockOut && new Date(clockOut) > window.scheduledEnd
    ? Math.max(Math.floor((new Date(clockOut).getTime() - window.scheduledEnd.getTime()) / 60000), 0)
    : 0;
  let status = lateMinutes > 0 ? "LATE" : "PRESENT";
  if (earlyCheckoutMinutes > 0) status = "EARLY_CHECKOUT";
  else if (overtimeMinutes > 0) status = "OVERTIME";
  return {
    scheduledStart: window.scheduledStart,
    scheduledEnd: window.scheduledEnd,
    breakMinutes: window.breakMinutes,
    workingMinutes,
    lateMinutes,
    earlyCheckoutMinutes,
    overtimeMinutes,
    status,
  };
}

async function getCalendarStatus(prisma, userId, dayStart, schedule) {
  const dateOnly = getDateOnlyInTz(dayStart);
  const [holiday, leave] = await Promise.all([
    prisma.holiday.findFirst({ where: { date: dateOnly, isActive: true }, select: { id: true, name: true } }),
    prisma.leaveRequest.findFirst({
      where: { userId: Number(userId), status: "APPROVED", startDate: { lte: dateOnly }, endDate: { gte: dateOnly } },
      select: { id: true, startDate: true, endDate: true },
    }),
  ]);
  if (leave) return { status: "ON_LEAVE", holiday: null, leave };
  if (holiday) return { status: "HOLIDAY", holiday, leave: null };
  if (!isWorkingDay(dayStart, schedule)) return { status: "WEEKEND", holiday: null, leave: null };
  return { status: null, holiday: null, leave: null };
}

module.exports = {
  APP_TZ,
  getStartOfDayInTz,
  getDateOnlyInTz,
  getDateStringInTz,
  getJakartaWeekday,
  isLate,
  getScheduleForUser,
  getScheduleWindow,
  getWorkingMinutes,
  getAttendanceMetrics,
  getCalendarStatus,
  isWorkingDay,
};
