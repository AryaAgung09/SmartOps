import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request, { params }) {
  try {
    const actor = await getCurrentUser();
    if (!actor) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const attendanceId = Number(id);
    if (Number.isNaN(attendanceId)) {
      return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });
    }

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!attendance) {
      return NextResponse.json({ success: false, message: "Attendance tidak ditemukan" }, { status: 404 });
    }

    const isAdmin = actor.role === "ADMIN" || actor.role === "HR";
    const isOwner = Number(attendance.userId) === Number(actor.id);
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: attendance });
  } catch (error) {
    console.error("GET ATTENDANCE DETAIL ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil data attendance" }, { status: 500 });
  }
}
