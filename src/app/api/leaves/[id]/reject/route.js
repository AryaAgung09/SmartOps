import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function POST(request, { params }) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const { id } = await params;
    const leaveId = Number(id);
    if (Number.isNaN(leaveId)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const rejectionReason = body.rejectionReason ? String(body.rejectionReason).trim() : null;

    const result = await prisma.$transaction(async (tx) => {
      const leave = await tx.leaveRequest.findUnique({ where: { id: leaveId }, include: { user: { select: { id: true, managerId: true } } } });
      if (!leave) throw new Error("NOT_FOUND");
      if (leave.status !== "PENDING") throw new Error("ALREADY_PROCESSED");
      if (Number(leave.userId) === Number(actor.id)) throw new Error("SELF_APPROVE");

      const year = leave.startDate.getFullYear();
      const balance = await tx.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: leave.userId, leaveTypeId: leave.leaveTypeId, year } },
      });
      if (!balance) throw new Error("NO_BALANCE");
      if ((balance.pendingDays - leave.totalDays) < 0) throw new Error("INVALID_BALANCE");

      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pendingDays: balance.pendingDays - leave.totalDays },
      });

      const updated = await tx.leaveRequest.update({
        where: { id: leaveId },
        data: { status: "REJECTED", rejectedById: Number(actor.id), rejectedAt: new Date(), rejectionReason },
      });

      await tx.auditLog.create({
        data: { action: "LEAVE_REQUEST_REJECTED", entity: "LeaveRequest", entityId: leaveId, userId: Number(actor.id), details: `days=${leave.totalDays}` },
      });

      return updated;
    });

    try {
      await prisma.notification.create({
        data: { userId: result.userId, title: "Cuti Ditolak", message: "Pengajuan cuti Anda telah ditolak." },
      });
    } catch (e) {}

    return NextResponse.json({ success: true, message: "Cuti ditolak", data: result });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    if (error.message === "NOT_FOUND") return NextResponse.json({ success: false, message: "Pengajuan cuti tidak ditemukan" }, { status: 404 });
    if (error.message === "ALREADY_PROCESSED") return NextResponse.json({ success: false, message: "Pengajuan sudah diproses" }, { status: 409 });
    if (error.message === "NO_BALANCE") return NextResponse.json({ success: false, message: "Saldo cuti tidak ditemukan" }, { status: 400 });
    if (error.message === "INVALID_BALANCE") return NextResponse.json({ success: false, message: "Saldo tidak konsisten" }, { status: 400 });
    console.error("REJECT LEAVE ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal menolak cuti" }, { status: 500 });
  }
}
