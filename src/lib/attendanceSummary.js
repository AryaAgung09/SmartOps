import {
  getDateOnlyInTz,
  getDateStringInTz,
  getScheduleWindow,
  isWorkingDay,
} from "@/lib/attendance";

function addDay(date) {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

function parseDate(value, fallback) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : getDateOnlyInTz(parsed);
}

function getDates(start, end) {
  const dates = [];
  for (let date = start; date < end && dates.length < 31; date = addDay(date)) dates.push(date);
  return dates;
}

export async function getAttendanceSummary(prisma, actor, options = {}) {
  const today = getDateOnlyInTz(new Date());
  const start = parseDate(options.startDate || options.date, today);
  const requestedEnd = parseDate(options.endDate, start);
  const end = options.date ? addDay(start) : options.endDate ? addDay(requestedEnd) : addDay(start);
  const isAdmin = actor.role === "ADMIN" || actor.role === "HR";
  const userWhere = { employmentStatus: { not: "TERMINATED" } };

  if (isAdmin && options.scope !== "me") {
    if (options.employeeId) userWhere.id = Number(options.employeeId);
  } else {
    userWhere.id = Number(actor.id);
  }

  const [users, fallbackSchedule, holidays, leaves] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, employeeId: true, department: { select: { name: true } }, workSchedule: true, shift: true },
      orderBy: { name: "asc" },
    }),
    prisma.workSchedule.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.holiday.findMany({ where: { date: { gte: start, lt: end }, isActive: true }, select: { date: true, name: true } }),
    prisma.leaveRequest.findMany({ where: { ...(!isAdmin ? { userId: Number(actor.id) } : {}), status: "APPROVED", startDate: { lt: end }, endDate: { gte: start } }, select: { userId: true, startDate: true, endDate: true } }),
  ]);

  const userIds = users.map((user) => user.id);
  const attendances = userIds.length
    ? await prisma.attendance.findMany({ where: { userId: { in: userIds }, date: { gte: start, lt: end } }, select: { id: true, userId: true, date: true, clockIn: true, clockOut: true, status: true, workingMinutes: true, lateMinutes: true, earlyCheckoutMinutes: true, overtimeMinutes: true } })
    : [];
  const attendanceByKey = new Map(attendances.map((attendance) => [`${attendance.userId}:${getDateStringInTz(attendance.date)}`, attendance]));
  const holidayByDate = new Map(holidays.map((holiday) => [getDateStringInTz(holiday.date), holiday]));
  const summary = [];
  const counts = {};

  for (const date of getDates(start, end)) {
    const dateKey = getDateStringInTz(date);
    for (const user of users) {
      const schedule = user.shift || user.workSchedule || fallbackSchedule;
      const attendance = attendanceByKey.get(`${user.id}:${dateKey}`);
      const window = getScheduleWindow(date, schedule);
      const leave = leaves.find((item) => item.userId === user.id && item.startDate <= date && item.endDate >= date);
      const holiday = holidayByDate.get(dateKey);
      const calendarStatus = leave ? "ON_LEAVE" : holiday ? "HOLIDAY" : !isWorkingDay(date, schedule) ? "WEEKEND" : null;
      const status = calendarStatus || attendance?.status || (attendance?.clockIn ? "PRESENT" : "ABSENT");
      const row = {
        date: dateKey,
        user: { id: user.id, name: user.name, employeeId: user.employeeId, department: user.department?.name || null },
        status,
        clockIn: attendance?.clockIn || null,
        clockOut: attendance?.clockOut || null,
        workingMinutes: attendance?.workingMinutes || 0,
        lateMinutes: attendance?.lateMinutes || 0,
        earlyCheckoutMinutes: attendance?.earlyCheckoutMinutes || 0,
        overtimeMinutes: attendance?.overtimeMinutes || 0,
        schedule: { name: schedule?.name || "Default Schedule", startTime: window.startTime, endTime: window.endTime },
        holiday: holiday?.name || null,
      };
      summary.push(row);
      counts[status] = (counts[status] || 0) + 1;
    }
  }

  return { startDate: getDateStringInTz(start), endDate: getDateStringInTz(new Date(end.getTime() - 24 * 60 * 60 * 1000)), totals: counts, total: summary.length, data: summary };
}
