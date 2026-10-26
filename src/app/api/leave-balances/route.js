import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";

export async function GET(request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();
    const isAdmin = actor.role === "ADMIN" || actor.role === "HR";

    if (isAdmin) {
      const balances = await prisma.leaveBalance.findMany({
        where: { year },
        include: { user: { select: { id: true, name: true, email: true, employeeId: true } }, leaveType: true },
        orderBy: [{ userId: "asc" }],
      });
      return NextResponse.json({ success: true, data: balances });
    }

    const balances = await prisma.leaveBalance.findMany({
      where: { userId: Number(actor.id), year },
      include: { leaveType: true },
    });
    return NextResponse.json({ success: true, data: balances });
  } catch (error) {
    console.error("GET LEAVE BALANCES ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil saldo cuti" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const body = await request.json();
    const userId = Number(body.userId);
    const leaveTypeId = Number(body.leaveTypeId);
    const year = Number(body.year || new Date().getFullYear());
    const allocatedDays = Number(body.allocatedDays || 0);
    const adjustmentDays = Number(body.adjustmentDays || 0);

    if (Number.isNaN(userId) || Number.isNaN(leaveTypeId) || Number.isNaN(year)) {
      return NextResponse.json({ success: false, message: "Data tidak valid" }, { status: 400 });
    }

    const balance = await prisma.$transaction(async (tx) => {
      const b = await tx.leaveBalance.upsert({
        where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } },
        create: { userId, leaveTypeId, year, allocatedDays, adjustmentDays, usedDays: 0, pendingDays: 0 },
        update: { allocatedDays, adjustmentDays },
      });
      await tx.auditLog.create({
        data: { action: "LEAVE_BALANCE_ADJUSTED", entity: "LeaveBalance", entityId: b.id, userId: Number(actor.id), details: `userId=${userId},leaveTypeId=${leaveTypeId},year=${year}` },
      });
      return b;
    });

    return NextResponse.json({ success: true, data: balance });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    console.error("SET LEAVE BALANCE ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengatur saldo cuti" }, { status: 500 });
  }
}
