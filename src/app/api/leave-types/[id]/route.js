import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function PUT(request, { params }) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const { id } = await params;
    const leaveTypeId = Number(id);
    if (Number.isNaN(leaveTypeId)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });

    const body = await request.json();
    const data = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
    if (body.defaultDays !== undefined) data.defaultDays = body.defaultDays === null ? null : Number(body.defaultDays);
    if (body.requiresApproval !== undefined) data.requiresApproval = !!body.requiresApproval;
    if (body.isPaid !== undefined) data.isPaid = !!body.isPaid;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    const type = await prisma.$transaction(async (tx) => {
      const updated = await tx.leaveType.update({ where: { id: leaveTypeId }, data });
      if (body.isActive === false) {
        await tx.auditLog.create({
          data: { action: "LEAVE_TYPE_DISABLED", entity: "LeaveType", entityId: updated.id, userId: Number(actor.id) },
        });
      } else {
        await tx.auditLog.create({
          data: { action: "LEAVE_TYPE_UPDATED", entity: "LeaveType", entityId: updated.id, userId: Number(actor.id) },
        });
      }
      return updated;
    });

    return NextResponse.json({ success: true, data: type });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    console.error("UPDATE LEAVE TYPE ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal memperbarui leave type" }, { status: 500 });
  }
}
