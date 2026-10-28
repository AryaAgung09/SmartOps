import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function POST(request) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const periodStart = body.periodStart;
    const periodEnd = body.periodEnd;
    const payDate = body.payDate || null;
    if (!name || !periodStart || !periodEnd) return NextResponse.json({ success: false, message: "Data tidak lengkap" }, { status: 400 });

    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const paymentDate = payDate ? new Date(payDate) : null;
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      (paymentDate && Number.isNaN(paymentDate.getTime()))
    ) {
      return NextResponse.json({ success: false, message: "Tanggal periode tidak valid" }, { status: 400 });
    }
    if (end < start) {
      return NextResponse.json({ success: false, message: "Tanggal selesai harus sama atau setelah tanggal mulai" }, { status: 400 });
    }

    const period = await prisma.$transaction(async (tx) => {
      const p = await tx.payrollPeriod.create({
        data: { name, periodStart: start, periodEnd: end, payDate: paymentDate, status: "DRAFT" },
      });
      await tx.auditLog.create({
        data: { action: "PAYROLL_PERIOD_CREATED", entity: "PayrollPeriod", entityId: p.id, userId: Number(actor.id), details: `name=${name}` },
      });
      return p;
    });
    return NextResponse.json({ success: true, data: period }, { status: 201 });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    if (error.code === "P2002") return NextResponse.json({ success: false, message: "Periode payroll sudah ada" }, { status: 409 });
    console.error("CREATE PAYROLL PERIOD ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal membuat periode payroll" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireRole(["ADMIN", "HR"]);
    const periods = await prisma.payrollPeriod.findMany({
      orderBy: { periodStart: "desc" },
      include: { _count: { select: { payrolls: true } } },
    });
    return NextResponse.json({ success: true, data: periods });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    console.error("GET PAYROLL PERIODS ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil periode payroll" }, { status: 500 });
  }
}
