import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCorrectionReviewer } from "@/lib/attendanceCorrection";

export async function GET(request, { params }) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    const correctionId = Number((await params).id);
    if (Number.isNaN(correctionId)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });

    const correction = await prisma.attendanceCorrection.findUnique({
      where: { id: correctionId },
      include: {
        attendance: { include: { user: { select: { id: true, name: true, email: true, employeeId: true, managerId: true } } } },
        requestedBy: { select: { id: true, name: true, email: true, employeeId: true, managerId: true } },
        reviewedBy: { select: { id: true, name: true, role: true } },
      },
    });
    if (!correction) return NextResponse.json({ success: false, message: "Pengajuan koreksi tidak ditemukan" }, { status: 404 });

    const isOwner = Number(correction.requestedById) === Number(actor.id);
    if (!isOwner && !isCorrectionReviewer(actor, correction.attendance.user)) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: correction });
  } catch (error) {
    console.error("GET CORRECTION ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil detail koreksi" }, { status: 500 });
  }
}
