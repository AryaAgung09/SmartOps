import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function POST(request) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const body = await request.json();
    const userId = Number(body.userId);
    const workScheduleId = body.workScheduleId ? Number(body.workScheduleId) : null;
    const shiftId = body.shiftId ? Number(body.shiftId) : null;
    if (Number.isNaN(userId) || (workScheduleId !== null && Number.isNaN(workScheduleId)) || (shiftId !== null && Number.isNaN(shiftId))) {
      return NextResponse.json({ success: false, message: "Data assignment tidak valid" }, { status: 400 });
    }
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: userId }, data: { workScheduleId, shiftId } });
      await tx.auditLog.create({ data: { action: "WORKFORCE_ASSIGNMENT_UPDATED", entity: "User", entityId: userId, userId: Number(actor.id), details: `workScheduleId=${workScheduleId},shiftId=${shiftId}` } });
      return updated;
    });
    return NextResponse.json({ success: true, data: { id: user.id, workScheduleId: user.workScheduleId, shiftId: user.shiftId } });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    if (error.code === "P2025") return NextResponse.json({ success: false, message: "Employee tidak ditemukan" }, { status: 404 });
    console.error("UPDATE WORKFORCE ASSIGNMENT ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengubah assignment" }, { status: 500 });
  }
}
