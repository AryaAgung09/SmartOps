import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { syncPayrollPeriodStatus } from "@/lib/payroll";

export async function POST(request, { params }) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const { id } = await params;
    const payrollId = Number(id);
    if (Number.isNaN(payrollId)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });

    const payroll = await prisma.payroll.findUnique({ where: { id: payrollId }, include: { payrollPeriod: true } });
    if (!payroll) return NextResponse.json({ success: false, message: "Payroll tidak ditemukan" }, { status: 404 });
    if (payroll.status === "FINALIZED" || payroll.status === "PAID") return NextResponse.json({ success: false, message: "Payroll sudah difinalisasi" }, { status: 409 });

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.payroll.update({ where: { id: payrollId }, data: { status: "FINALIZED" } });
      await syncPayrollPeriodStatus(tx, payroll.payrollPeriodId);
      await tx.auditLog.create({
        data: { action: "PAYROLL_FINALIZED", entity: "Payroll", entityId: payrollId, userId: Number(actor.id) },
      });
      return p;
    });

    return NextResponse.json({ success: true, message: "Payroll difinalisasi", data: updated });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    console.error("FINALIZE PAYROLL ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal memfinalisasi payroll" }, { status: 500 });
  }
}
