import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    const types = await prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    return NextResponse.json({ success: true, data: types });
  } catch (error) {
    console.error("GET LEAVE TYPES ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil leave type" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const body = await request.json();
    const code = String(body.code ?? "").trim().toUpperCase();
    const name = String(body.name ?? "").trim();
    if (!code || !name) return NextResponse.json({ success: false, message: "Code dan nama wajib diisi" }, { status: 400 });

    const type = await prisma.$transaction(async (tx) => {
      const created = await tx.leaveType.create({
        data: {
          code,
          name,
          description: body.description ? String(body.description).trim() : null,
          defaultDays: body.defaultDays ? Number(body.defaultDays) : null,
          requiresApproval: body.requiresApproval !== false,
          isPaid: body.isPaid !== false,
          isActive: true,
        },
      });
      await tx.auditLog.create({
        data: { action: "LEAVE_TYPE_CREATED", entity: "LeaveType", entityId: created.id, userId: Number(actor.id), details: `code=${code}` },
      });
      return created;
    });

    return NextResponse.json({ success: true, data: type }, { status: 201 });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    if (error.code === "P2002") return NextResponse.json({ success: false, message: "Code sudah digunakan" }, { status: 409 });
    console.error("CREATE LEAVE TYPE ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal membuat leave type" }, { status: 500 });
  }
}
