import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { recordPayrollExpense } from "@/lib/financeService";
import { syncPayrollPeriodStatus } from "@/lib/payroll";

export async function POST(request, { params }) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const { id } = await params;
    const payrollId = Number(id);
    if (Number.isNaN(payrollId)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });

    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        payrollPeriod: true,
        user: { select: { name: true, email: true, employeeId: true, departmentId: true } },
      },
    });
    if (!payroll) return NextResponse.json({ success: false, message: "Payroll tidak ditemukan" }, { status: 404 });
    if (payroll.payrollPeriod.status === "CANCELLED") {
      return NextResponse.json({ success: false, message: "Periode payroll telah dibatalkan" }, { status: 409 });
    }
    if (payroll.status !== "FINALIZED") return NextResponse.json({ success: false, message: "Payroll harus difinalisasi terlebih dahulu" }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.payroll.updateMany({
        where: { id: payrollId, status: "FINALIZED" },
        data: { status: "PAID" },
      });
      if (!claim.count) throw new Error("PAYROLL_NOT_FINALIZED");

      const updated = await tx.payroll.findUnique({ where: { id: payrollId } });
      const expense = await recordPayrollExpense(tx, payroll, Number(actor.id));
      await syncPayrollPeriodStatus(tx, payroll.payrollPeriodId);
      await tx.auditLog.create({
        data: {
          action: "PAYROLL_PAID",
          entity: "Payroll",
          entityId: payrollId,
          userId: Number(actor.id),
          details: `expenseId=${expense?.id || ""},amount=${payroll.netSalary}`,
        },
      });
      return { payroll: updated, expenseId: expense?.id || null };
    });

    return NextResponse.json({
      success: true,
      message: result.expenseId
        ? "Payroll ditandai lunas dan pengeluaran tercatat di Finance"
        : "Payroll ditandai lunas tanpa pencatatan Finance karena net salary Rp0",
      data: result.payroll,
      financeExpenseId: result.expenseId,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    if (error.message === "PAYROLL_NOT_FINALIZED") return NextResponse.json({ success: false, message: "Payroll sudah diproses" }, { status: 409 });
    console.error("PAY PAYROLL ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal menandai payroll lunas" }, { status: 500 });
  }
}
