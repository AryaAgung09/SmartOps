import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request, { params }) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const leaveId = Number(id);
    if (Number.isNaN(leaveId)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const leave = await tx.leaveRequest.findUnique({ where: { id: leaveId } });
      if (!leave) throw new Error("NOT_FOUND");
      const isAdmin = actor.role === "ADMIN" || actor.role === "HR";
      if (!isAdmin && Number(leave.userId) !== Number(actor.id)) throw new Error("FORBIDDEN");
      if (leave.status === "CANCELLED") throw new Error("ALREADY_PROCESSED");
      if (!isAdmin && leave.status !== "PENDING") throw new Error("CANNOT_CANCEL");

      const year = leave.startDate.getFullYear();
      const balance = await tx.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: leave.userId, leaveTypeId: leave.leaveTypeId, year } },
      });
      if (!balance) throw new Error("NO_BALANCE");

      if (leave.status === "PENDING") {
        if ((balance.pendingDays - leave.totalDays) >= 0) {
          await tx.leaveBalance.update({ where: { id: balance.id }, data: { pendingDays: balance.pendingDays - leave.totalDays } });
        }
      } else if (leave.status === "APPROVED") {
        if ((balance.usedDays - leave.totalDays) >= 0) {
          await tx.leaveBalance.update({ where: { id: balance.id }, data: { usedDays: balance.usedDays - leave.totalDays } });
        }
      }

      const updated = await tx.leaveRequest.update({
        where: { id: leaveId },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });

      await tx.auditLog.create({
        data: { action: "LEAVE_REQUEST_CANCELLED", entity: "LeaveRequest", entityId: leaveId, userId: Number(actor.id), details: `days=${leave.totalDays}` },
      });

      return updated;
    });

    return NextResponse.json({ success: true, message: "Cuti dibatalkan", data: result });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    if (error.message === "NOT_FOUND") return NextResponse.json({ success: false, message: "Pengajuan cuti tidak ditemukan" }, { status: 404 });
    if (error.message === "ALREADY_PROCESSED") return NextResponse.json({ success: false, message: "Pengajuan sudah dibatalkan" }, { status: 409 });
    if (error.message === "CANNOT_CANCEL") return NextResponse.json({ success: false, message: "Hanya cuti berstatus PENDING yang bisa dibatalkan oleh employee" }, { status: 403 });
    if (error.message === "NO_BALANCE") return NextResponse.json({ success: false, message: "Saldo cuti tidak ditemukan" }, { status: 400 });
    console.error("CANCEL LEAVE ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal membatalkan cuti" }, { status: 500 });
  }
}
