import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getAttendanceMetrics, getCalendarStatus, getScheduleForUser, getStartOfDayInTz } from "@/lib/attendance";
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

    const correction = await prisma.attendanceCorrection.findUnique({
      where: { id: correctionId },
       include: { attendance: { include: { user: { select: { id: true, managerId: true } } } }, requestedBy: { select: { id: true } } },
    });

    if (!correction) {
      return NextResponse.json({ success: false, message: "Pengajuan koreksi tidak ditemukan" }, { status: 404 });
    }
    if (correction.status !== "PENDING") {
      return NextResponse.json({ success: false, message: "Pengajuan koreksi sudah diproses" }, { status: 409 });
    }
    if (!isCorrectionReviewer(actor, correction.attendance.user)) {
      return NextResponse.json({ success: false, message: "Kamu tidak memiliki akses untuk menyetujui koreksi ini" }, { status: 403 });
    }

    const requestedClockIn = correction.requestedClockIn !== null ? correction.requestedClockIn : correction.attendance.clockIn;
    const requestedClockOut = correction.requestedClockOut !== null ? correction.requestedClockOut : correction.attendance.clockOut;
    const schedule = await getScheduleForUser(prisma, correction.requestedBy.id);
    const dayStart = getStartOfDayInTz(correction.attendance.date);
    const calendar = await getCalendarStatus(prisma, correction.requestedBy.id, dayStart, schedule);
    const metrics = requestedClockIn && requestedClockOut
      ? getAttendanceMetrics(requestedClockIn, requestedClockOut, dayStart, schedule)
      : null;

    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.attendanceCorrection.updateMany({
        where: { id: correctionId, status: "PENDING" },
        data: { status: "APPROVED", reviewedById: Number(actor.id), reviewedAt: new Date(), reviewNote },
      });
      if (claimed.count !== 1) throw new Error("ALREADY_PROCESSED");
      const updatedAtt = await tx.attendance.update({
        where: { id: correction.attendanceId },
        data: {
          clockIn: requestedClockIn,
          clockOut: requestedClockOut,
          status: calendar.status || correction.requestedStatus || metrics?.status || correction.attendance.status,
          workingMinutes: metrics?.workingMinutes ?? correction.attendance.workingMinutes,
          scheduledStart: metrics?.scheduledStart ?? correction.attendance.scheduledStart,
          scheduledEnd: metrics?.scheduledEnd ?? correction.attendance.scheduledEnd,
          breakMinutes: metrics?.breakMinutes ?? correction.attendance.breakMinutes,
          lateMinutes: metrics?.lateMinutes ?? correction.attendance.lateMinutes,
          earlyCheckoutMinutes: metrics?.earlyCheckoutMinutes ?? correction.attendance.earlyCheckoutMinutes,
          overtimeMinutes: metrics?.overtimeMinutes ?? correction.attendance.overtimeMinutes,
        },
      });

      await tx.auditLog.create({
        data: { action: "ATTENDANCE_CORRECTION_APPROVED", entity: "AttendanceCorrection", entityId: correctionId, userId: Number(actor.id), details: `attendanceId=${correction.attendanceId}` },
      });
      await tx.notification.create({
        data: {
          userId: correction.requestedBy.id,
          title: "Koreksi absensi disetujui",
          message: "Pengajuan koreksi absensi Anda telah disetujui dan attendance telah diperbarui.",
        },
      });

      return { updatedAtt, updatedCorrection: { id: correctionId, status: "APPROVED" } };
    });

    return NextResponse.json({ success: true, message: "Koreksi disetujui", data: result });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    if (error.message === "ALREADY_PROCESSED") return NextResponse.json({ success: false, message: "Pengajuan koreksi sudah diproses" }, { status: 409 });
    console.error("APPROVE CORRECTION ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal menyetujui koreksi" }, { status: 500 });
  }
}
