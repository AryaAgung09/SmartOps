import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";
import {
  AUTO_ITEM_NAMES,
  calculatePayroll,
  getDefaultBasicSalary,
  getPayrollDeductions,
  getPayrollOvertime,
  UMK_BATAM_2026,
} from "@/lib/payroll";

export async function GET(request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const payrollPeriodId = searchParams.get("payrollPeriodId");
    const isAdmin = actor.role === "ADMIN" || actor.role === "HR";

    let where = {};
    if (!isAdmin) where.userId = Number(actor.id);
    if (payrollPeriodId) {
      const pid = Number(payrollPeriodId);
      if (!Number.isNaN(pid)) where.payrollPeriodId = pid;
    }

    const payrolls = await prisma.payroll.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, employeeId: true } },
        payrollPeriod: true,
        items: true,
        expense: { select: { id: true, status: true } },
      },
    });
    return NextResponse.json({ success: true, data: payrolls });
  } catch (error) {
    console.error("GET PAYROLL ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil data payroll" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const body = await request.json();
    const payrollPeriodId = Number(body.payrollPeriodId);
    if (Number.isNaN(payrollPeriodId)) return NextResponse.json({ success: false, message: "Data tidak valid" }, { status: 400 });

    const period = await prisma.payrollPeriod.findUnique({ where: { id: payrollPeriodId } });
    if (!period) return NextResponse.json({ success: false, message: "Periode tidak ditemukan" }, { status: 404 });
    if (period.status === "FINALIZED" || period.status === "PAID") return NextResponse.json({ success: false, message: "Periode sudah difinalisasi" }, { status: 403 });

    const generateAll = body.generateAll === true || !body.userId;
    let targets;

    if (generateAll) {
      targets = await prisma.user.findMany({
        where: { employmentStatus: "ACTIVE" },
        select: { id: true, name: true, employeeId: true },
        orderBy: { name: "asc" },
      });
    } else {
      const userId = Number(body.userId);
      if (Number.isNaN(userId)) return NextResponse.json({ success: false, message: "Employee tidak valid" }, { status: 400 });
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, employeeId: true },
      });
      if (!user) return NextResponse.json({ success: false, message: "Employee tidak ditemukan" }, { status: 404 });
      targets = [user];
    }

    if (!targets.length) {
      return NextResponse.json({
        success: true,
        message: "Tidak ada karyawan aktif untuk dibuatkan payroll",
        data: { created: [], updated: [], skipped: [], failed: [], total: 0, umkBasicSalary: UMK_BATAM_2026 },
      });
    }

    const created = [];
    const updated = [];
    const skipped = [];
    const failed = [];

    for (const target of targets) {
      const existing = await prisma.payroll.findUnique({
        where: { payrollPeriodId_userId: { payrollPeriodId, userId: target.id } },
        select: { id: true, status: true },
      });

      if (existing && existing.status !== "DRAFT") {
        skipped.push({
          userId: target.id,
          name: target.name,
          payrollId: existing.id,
          reason: `Payroll sudah ${existing.status.toLowerCase()}`,
        });
        continue;
      }

      try {
        const payroll = await prisma.$transaction(async (tx) => {
          let salary = await tx.salaryStructure.findFirst({
            where: { userId: target.id, status: "ACTIVE" },
            orderBy: { effectiveFrom: "desc" },
          });
          let usedDefaultSalary = false;

          if (!salary) {
            salary = await tx.salaryStructure.create({
              data: {
                userId: target.id,
                basicSalary: getDefaultBasicSalary(),
                currency: "IDR",
                effectiveFrom: period.periodStart,
                status: "ACTIVE",
                notes: "Basic salary default UMK Batam 2026",
              },
            });
            usedDefaultSalary = true;
            await tx.auditLog.create({
              data: {
                action: "SALARY_UMK_DEFAULT_CREATED",
                entity: "SalaryStructure",
                entityId: salary.id,
                userId: Number(actor.id),
                details: `userId=${target.id},basicSalary=${UMK_BATAM_2026}`,
              },
            });
          }

          const existingItems = existing
            ? await tx.payrollItem.findMany({ where: { payrollId: existing.id } })
            : [];
          const manualItems = existingItems.filter((item) => !AUTO_ITEM_NAMES.includes(item.name));
          const manualAllowances = manualItems
            .filter((item) => item.type === "ALLOWANCE")
            .map((item) => ({ amount: Number(item.amount || 0) }));
          const manualDeductions = manualItems
            .filter((item) => item.type === "DEDUCTION")
            .map((item) => ({ amount: Number(item.amount || 0) }));

          const deductionSummary = await getPayrollDeductions(tx, {
            userId: target.id,
            basicSalary: Number(salary.basicSalary),
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
          });
          const overtimeSummary = await getPayrollOvertime(tx, {
            userId: target.id,
            basicSalary: Number(salary.basicSalary),
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
          });
          const allowances = [
            ...manualAllowances,
            ...(overtimeSummary.allowance ? [overtimeSummary.allowance] : []),
          ];
          const autoAllowances = overtimeSummary.allowance ? [overtimeSummary.allowance] : [];
          const calc = calculatePayroll(Number(salary.basicSalary), allowances, [
            ...manualDeductions,
            ...deductionSummary.deductions,
          ]);

          let payrollRecord;
          if (existing) {
            await tx.payrollItem.deleteMany({
              where: { payrollId: existing.id, name: { in: AUTO_ITEM_NAMES } },
            });
            payrollRecord = await tx.payroll.update({
              where: { id: existing.id },
              data: {
                basicSalary: salary.basicSalary,
                totalAllowance: calc.totalAllowance,
                totalDeduction: calc.totalDeduction,
                grossSalary: calc.grossSalary,
                netSalary: calc.netSalary,
              },
            });
          } else {
            payrollRecord = await tx.payroll.create({
              data: {
                payrollPeriodId,
                userId: target.id,
                basicSalary: salary.basicSalary,
                totalAllowance: calc.totalAllowance,
                totalDeduction: calc.totalDeduction,
                grossSalary: calc.grossSalary,
                netSalary: calc.netSalary,
                status: "DRAFT",
              },
            });
          }

          const autoItems = [...deductionSummary.deductions, ...autoAllowances];
          if (autoItems.length) {
            await tx.payrollItem.createMany({
              data: autoItems.map((item) => ({
                payrollId: payrollRecord.id,
                type: item.type,
                name: item.name,
                amount: item.amount,
                notes: item.notes,
              })),
            });
          }

          await tx.auditLog.create({
            data: {
              action: existing ? "PAYROLL_RECALCULATED" : "PAYROLL_GENERATED",
              entity: "Payroll",
              entityId: payrollRecord.id,
              userId: Number(actor.id),
              details: `userId=${target.id},periodId=${payrollPeriodId},basicSalary=${calc.basicSalary},deduction=${calc.totalDeduction},absentDays=${deductionSummary.absentDays},halfDays=${deductionSummary.halfDays},unpaidLeaveDays=${deductionSummary.unpaidLeaveDays},holidayDays=${deductionSummary.holidayDays},overtimeMinutes=${overtimeSummary.overtimeMinutes},overtimePay=${overtimeSummary.amount}`,
            },
          });

          return {
            ...payrollRecord,
            usedDefaultSalary,
            recalculated: Boolean(existing),
            deductionSummary,
            overtimeSummary,
          };
        });

        const entry = {
          id: payroll.id,
          userId: target.id,
          name: target.name,
          usedDefaultSalary: payroll.usedDefaultSalary,
          totalDeduction: Number(payroll.totalDeduction),
          absentDays: payroll.deductionSummary.absentDays,
          halfDays: payroll.deductionSummary.halfDays,
          unpaidLeaveDays: payroll.deductionSummary.unpaidLeaveDays,
          holidayDays: payroll.deductionSummary.holidayDays,
          overtimeHours: payroll.overtimeSummary.overtimeHours,
          overtimePay: payroll.overtimeSummary.amount,
        };
        if (payroll.recalculated) updated.push(entry);
        else created.push(entry);
      } catch (error) {
        if (error.code === "P2002") {
          skipped.push({ userId: target.id, name: target.name, reason: "Payroll sudah ada" });
          continue;
        }
        failed.push({ userId: target.id, name: target.name, message: error.message || "Gagal membuat payroll" });
      }
    }

    if (!created.length && !updated.length && failed.length) {
      return NextResponse.json(
        {
          success: false,
          message: `Gagal membuat payroll untuk ${failed.length} karyawan`,
          data: { created, updated, skipped, failed, total: targets.length, umkBasicSalary: UMK_BATAM_2026 },
        },
        { status: 500 }
      );
    }

    const messageParts = [];
    if (created.length) messageParts.push(`${created.length} payroll dibuat`);
    if (updated.length) messageParts.push(`${updated.length} payroll dihitung ulang`);
    if (skipped.length) messageParts.push(`${skipped.length} dilewati`);
    if (failed.length) messageParts.push(`${failed.length} gagal`);
    if (!messageParts.length) messageParts.push("Tidak ada payroll yang diproses");
    const defaultSalaryCount = [...created, ...updated].filter((item) => item.usedDefaultSalary).length;
    const umkNote = defaultSalaryCount
      ? ` Basic salary ${defaultSalaryCount} karyawan diisi sesuai UMK Batam 2026.`
      : "";

    return NextResponse.json(
      {
        success: true,
        message: `${messageParts.join(", ")}.${umkNote}`,
        data: { created, updated, skipped, failed, total: targets.length, umkBasicSalary: UMK_BATAM_2026 },
      },
      { status: created.length ? 201 : 200 }
    );
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    console.error("CREATE PAYROLL ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal membuat payroll" }, { status: 500 });
  }
}
