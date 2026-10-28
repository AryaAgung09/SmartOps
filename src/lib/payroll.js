const { getDateOnlyInTz, getDateStringInTz, getScheduleForUser, getStartOfDayInTz, isWorkingDay } = require("./attendance");

const UMK_BATAM_2026 = 5357982;
const AUTO_DEDUCTION_NAMES = ["Potongan Absen", "Potongan Setengah Hari", "Potongan Cuti Tanpa Gaji"];
const AUTO_ALLOWANCE_NAMES = ["Upah Lembur"];
const AUTO_ITEM_NAMES = [...AUTO_DEDUCTION_NAMES, ...AUTO_ALLOWANCE_NAMES];
const OVERTIME_MULTIPLIER = 1.5;
const OVERTIME_DIVISOR_HOURS = 173;

function getDefaultBasicSalary() {
  return UMK_BATAM_2026;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getPayrollPeriodStatus(statuses = []) {
  const active = statuses.filter((status) => status !== "CANCELLED");
  if (!active.length) return "DRAFT";
  if (active.every((status) => status === "PAID")) return "PAID";
  if (active.every((status) => status === "FINALIZED" || status === "PAID")) return "FINALIZED";
  if (active.some((status) => status === "CALCULATED" || status === "FINALIZED" || status === "PAID")) {
    return "PROCESSING";
  }
  return "DRAFT";
}

async function syncPayrollPeriodStatus(prisma, payrollPeriodId) {
  const payrolls = await prisma.payroll.findMany({
    where: { payrollPeriodId },
    select: { status: true },
  });
  const status = getPayrollPeriodStatus(payrolls.map((payroll) => payroll.status));
  return prisma.payrollPeriod.update({
    where: { id: payrollPeriodId },
    data: { status },
  });
}

function calculatePayroll(basicSalary, allowances = [], deductions = []) {
  const basic = Number(basicSalary || 0);
  const totalAllowance = allowances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const totalDeduction = deductions.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const grossSalary = basic + totalAllowance;
  const netSalary = grossSalary - totalDeduction;
  return {
    basicSalary: basic,
    totalAllowance,
    totalDeduction,
    grossSalary,
    netSalary,
  };
}

function calculateOvertimePay(basicSalary, overtimeMinutes) {
  const basic = Number(basicSalary || 0);
  const minutes = Math.max(Number(overtimeMinutes || 0), 0);
  if (!basic || !minutes) return 0;
  return Math.round((basic / OVERTIME_DIVISOR_HOURS) * (minutes / 60) * OVERTIME_MULTIPLIER);
}

async function getPayrollOvertime(prisma, { userId, basicSalary, periodStart, periodEnd }) {
  const start = getDateOnlyInTz(periodStart);
  const end = addDays(getDateOnlyInTz(periodEnd), 1);
  if (end.getTime() <= start.getTime()) {
    return { overtimeMinutes: 0, overtimeHours: 0, hourlyRate: 0, multiplier: OVERTIME_MULTIPLIER, amount: 0, allowance: null };
  }

  const summary = await getAttendancePayrollSummary(prisma, {
    userId,
    startDate: start,
    endDate: end,
  });
  const overtimeMinutes = Math.max(Number(summary.overtimeMinutes || 0), 0);
  const amount = calculateOvertimePay(basicSalary, overtimeMinutes);
  const overtimeHours = Math.round((overtimeMinutes / 60) * 100) / 100;

  return {
    overtimeMinutes,
    overtimeHours,
    hourlyRate: Math.round(Number(basicSalary || 0) / OVERTIME_DIVISOR_HOURS),
    multiplier: OVERTIME_MULTIPLIER,
    amount,
    allowance: amount > 0
      ? {
          type: "ALLOWANCE",
          name: AUTO_ALLOWANCE_NAMES[0],
          amount,
          notes: `${String(overtimeHours).replace(".", ",")} jam x ${String(OVERTIME_MULTIPLIER).replace(".", ",")}`,
        }
      : null,
  };
}

async function getAttendancePayrollSummary(prisma, { userId, startDate, endDate }) {
  const where = { date: { gte: startDate, lt: endDate } };
  if (userId) where.userId = Number(userId);
  const [totals, lateDays, absentDays] = await Promise.all([
    prisma.attendance.aggregate({ where, _sum: { workingMinutes: true, lateMinutes: true, overtimeMinutes: true, earlyCheckoutMinutes: true } }),
    prisma.attendance.count({ where: { ...where, status: "LATE" } }),
    prisma.attendance.count({ where: { ...where, status: "ABSENT" } }),
  ]);
  return {
    workingMinutes: totals._sum.workingMinutes || 0,
    lateMinutes: totals._sum.lateMinutes || 0,
    overtimeMinutes: totals._sum.overtimeMinutes || 0,
    earlyCheckoutMinutes: totals._sum.earlyCheckoutMinutes || 0,
    lateDays,
    absentDays,
  };
}

async function getPayrollDeductions(prisma, { userId, basicSalary, periodStart, periodEnd }) {
  const start = getDateOnlyInTz(periodStart);
  const endInclusive = getDateOnlyInTz(periodEnd);
  const end = addDays(endInclusive, 1);
  const empty = {
    workingDays: 0,
    dailyRate: 0,
    absentDays: 0,
    halfDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    holidayDays: 0,
    deductionTotal: 0,
    deductions: [],
  };

  if (end.getTime() <= start.getTime()) return empty;

  const [schedule, holidays, leaves, attendances] = await Promise.all([
    getScheduleForUser(prisma, userId),
    prisma.holiday.findMany({
      where: { date: { gte: addDays(start, -1), lt: addDays(end, 1) }, isActive: true },
      select: { date: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId: Number(userId),
        status: "APPROVED",
        startDate: { lt: addDays(end, 1) },
        endDate: { gte: addDays(start, -1) },
      },
      select: {
        startDate: true,
        endDate: true,
        leaveType: { select: { isPaid: true } },
      },
    }),
    prisma.attendance.findMany({
      where: { userId: Number(userId), date: { gte: addDays(start, -1), lt: addDays(end, 1) } },
      select: { date: true, status: true },
    }),
  ]);

  const holidayKeys = new Set(holidays.map((holiday) => getDateStringInTz(holiday.date)));
  const attendanceByKey = new Map(attendances.map((attendance) => [getDateStringInTz(attendance.date), attendance]));
  const leaveRanges = leaves.map((leave) => ({
    start: getDateStringInTz(leave.startDate),
    end: getDateStringInTz(leave.endDate),
    isPaid: leave.leaveType?.isPaid !== false,
  }));
  const today = getStartOfDayInTz(new Date());

  let workingDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let holidayDays = 0;

  for (let date = start; date.getTime() < end.getTime(); date = addDays(date, 1)) {
    const dateKey = getDateStringInTz(date);
    if (holidayKeys.has(dateKey)) {
      if (isWorkingDay(date, schedule)) holidayDays += 1;
      continue;
    }
    if (!isWorkingDay(date, schedule)) continue;

    workingDays += 1;

    const leave = leaveRanges.find((range) => range.start <= dateKey && range.end >= dateKey);
    if (leave) {
      if (leave.isPaid) paidLeaveDays += 1;
      else unpaidLeaveDays += 1;
      continue;
    }

    const attendance = attendanceByKey.get(dateKey);
    if (attendance?.status === "ON_LEAVE") {
      paidLeaveDays += 1;
      continue;
    }
    if (attendance?.status === "HOLIDAY" || attendance?.status === "WEEKEND") continue;
    if (date.getTime() >= today.getTime()) continue;

    if (attendance?.status === "HALF_DAY") {
      halfDays += 1;
      continue;
    }
    if (!attendance || attendance.status === "ABSENT" || attendance.status === "NOT_CLOCKED_IN") {
      absentDays += 1;
    }
  }

  const dailyRate = workingDays > 0 ? Number(basicSalary || 0) / workingDays : 0;
  const deductions = [];

  function addDeduction(name, days) {
    const amount = Math.round(dailyRate * days);
    if (amount <= 0) return;
    deductions.push({ type: "DEDUCTION", name, amount, notes: `${String(days).replace(".", ",")} hari` });
  }

  addDeduction("Potongan Absen", absentDays);
  addDeduction("Potongan Setengah Hari", halfDays * 0.5);
  addDeduction("Potongan Cuti Tanpa Gaji", unpaidLeaveDays);

  return {
    workingDays,
    dailyRate: Math.round(dailyRate),
    absentDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    holidayDays,
    deductionTotal: deductions.reduce((sum, item) => sum + item.amount, 0),
    deductions,
  };
}

module.exports = {
  UMK_BATAM_2026,
  AUTO_DEDUCTION_NAMES,
  AUTO_ALLOWANCE_NAMES,
  AUTO_ITEM_NAMES,
  OVERTIME_MULTIPLIER,
  OVERTIME_DIVISOR_HOURS,
  getDefaultBasicSalary,
  calculatePayroll,
  calculateOvertimePay,
  getAttendancePayrollSummary,
  getPayrollOvertime,
  getPayrollDeductions,
  getPayrollPeriodStatus,
  syncPayrollPeriodStatus,
};
