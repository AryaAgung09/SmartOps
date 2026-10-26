import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { isCorrectionReviewer } from "@/lib/attendanceCorrection";

export async function POST(request, { params }) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const { id } = await params;
    const correctionId = Number(id);
    if (Number.isNaN(correctionId)) {
      return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reviewNote = body.reviewNote ? String(body.reviewNote).trim() : null;
    if (!reviewNote) {
      return NextResponse.json({ success: false, message: "Alasan penolakan wajib diisi" }, { status: 400 });
    }

    const correction = await prisma.attendanceCorrection.findUnique({ where: { id: correctionId }, include: { attendance: { include: { user: { select: { id: true, managerId: true } } } }, requestedBy: { select: { id: true } } } });
    if (!correction) {
      return NextResponse.json({ success: false, message: "Pengajuan koreksi tidak ditemukan" }, { status: 404 });
    }
    if (correction.status !== "PENDING") {
      return NextResponse.json({ success: false, message: "Pengajuan koreksi sudah diproses" }, { status: 409 });
    }
    if (!isCorrectionReviewer(actor, correction.attendance.user)) {
      return NextResponse.json({ success: false, message: "Kamu tidak memiliki akses untuk menolak koreksi ini" }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.attendanceCorrection.updateMany({
        where: { id: correctionId, status: "PENDING" },
        data: { status: "REJECTED", reviewedById: Number(actor.id), reviewedAt: new Date(), reviewNote },
      });
      if (claimed.count !== 1) throw new Error("ALREADY_PROCESSED");
      await tx.auditLog.create({
        data: { action: "ATTENDANCE_CORRECTION_REJECTED", entity: "AttendanceCorrection", entityId: correctionId, userId: Number(actor.id), details: `attendanceId=${correction.attendanceId}` },
      });
      await tx.notification.create({
        data: {
          userId: correction.requestedBy.id,
          title: "Koreksi absensi ditolak",
          message: `Pengajuan koreksi absensi Anda ditolak: ${reviewNote}`,
        },
      });
      return { id: correctionId, status: "REJECTED", reviewNote };
    });

    return NextResponse.json({ success: true, message: "Koreksi ditolak", data: updated });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    if (error.message === "ALREADY_PROCESSED") return NextResponse.json({ success: false, message: "Pengajuan koreksi sudah diproses" }, { status: 409 });
    console.error("REJECT CORRECTION ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal menolak koreksi" }, { status: 500 });
  }
}
