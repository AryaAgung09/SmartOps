import { prisma } from "@/lib/prisma";
import { addDays, EXPIRY_WINDOW_DAYS, startOfToday } from "@/lib/documents";

function jakartaParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year").value),
    month: Number(parts.find((part) => part.type === "month").value),
    day: Number(parts.find((part) => part.type === "day").value),
  };
}

function jakartaDate(year, month, day) {
  return new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+07:00`);
}

function getDateRange(range) {
  const now = new Date();
  const parts = jakartaParts(now);
  const start = range === "month" ? jakartaDate(parts.year, parts.month, 1) : jakartaDate(parts.year, parts.month, parts.day);
  const end = range === "month"
    ? (parts.month === 12 ? jakartaDate(parts.year + 1, 1, 1) : jakartaDate(parts.year, parts.month + 1, 1))
    : new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, label: range === "month" ? "This Month" : "Today" };
}

export async function getHrDashboardData(range = "today") {
  const selectedRange = range === "month" ? "month" : "today";
  const { start, end, label } = getDateRange(selectedRange);
  const employeeWhere = { role: { not: "ADMIN" } };

  const [
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    attendanceGroups,
    clockedInUsers,
    pendingLeave,
    approvedLeave,
    currentlyOnLeave,
    payrollPeriodCount,
    latestPayrollPeriod,
    totalDocuments,
    archivedDocuments,
    expiringDocuments,
    expiredDocuments,
    recentActivity,
  ] = await Promise.all([
    prisma.user.count({ where: employeeWhere }),
    prisma.user.count({ where: { ...employeeWhere, employmentStatus: "ACTIVE" } }),
    prisma.user.count({ where: { ...employeeWhere, employmentStatus: { in: ["INACTIVE", "TERMINATED"] } } }),
    prisma.attendance.groupBy({ by: ["status"], where: { date: { gte: start, lt: end } }, _count: { _all: true } }),
    prisma.attendance.findMany({ where: { date: { gte: start, lt: end }, clockIn: { not: null } }, distinct: ["userId"], select: { userId: true } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.leaveRequest.count({ where: { status: "APPROVED", startDate: { lt: end }, endDate: { gte: start } } }),
    prisma.leaveRequest.count({ where: { status: "APPROVED", startDate: { lte: start }, endDate: { gte: start } } }),
    prisma.payrollPeriod.count(),
    prisma.payrollPeriod.findFirst({ orderBy: { periodStart: "desc" }, select: { id: true, name: true, status: true, periodStart: true, periodEnd: true } }),
    prisma.employeeDocument.count(),
    prisma.employeeDocument.count({ where: { archived: true } }),
    prisma.employeeDocument.count({
      where: {
        archived: false,
        expiryDate: { gte: startOfToday(), lte: addDays(startOfToday(), EXPIRY_WINDOW_DAYS) },
      },
    }),
    prisma.employeeDocument.count({
      where: { archived: false, expiryDate: { lt: startOfToday() } },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, action: true, entity: true, createdAt: true } }),
  ]);

  const attendance = Object.fromEntries(attendanceGroups.map((group) => [group.status, group._count._all]));
  return {
    range: selectedRange,
    rangeLabel: label,
    employees: {
      total: totalEmployees,
      active: activeEmployees,
      inactiveOrTerminated: inactiveEmployees,
    },
    attendance: {
      present: attendance.PRESENT || 0,
      late: attendance.LATE || 0,
      absent: attendance.ABSENT || 0,
      notClockedIn: Math.max(activeEmployees - clockedInUsers.length, 0),
    },
    leave: {
      pending: pendingLeave,
      approved: approvedLeave,
      currentlyOnLeave,
    },
    payroll: {
      periods: payrollPeriodCount,
      latestPeriod: latestPayrollPeriod,
      gross: latestPayrollPeriod ? (await prisma.payroll.aggregate({ where: { payrollPeriodId: latestPayrollPeriod.id }, _sum: { grossSalary: true } }))._sum.grossSalary : null,
      net: latestPayrollPeriod ? (await prisma.payroll.aggregate({ where: { payrollPeriodId: latestPayrollPeriod.id }, _sum: { netSalary: true } }))._sum.netSalary : null,
    },
    documents: {
      total: totalDocuments,
      archived: archivedDocuments,
      expiring: expiringDocuments,
      expired: expiredDocuments,
      active: Math.max(totalDocuments - archivedDocuments - expiringDocuments - expiredDocuments, 0),
    },
    recentActivity,
  };
}
