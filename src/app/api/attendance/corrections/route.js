import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  ATTENDANCE_CORRECTION_TYPES,
  ATTENDANCE_CORRECTION_REVIEWER_ROLES,
  parseOptionalDate,
} from "@/lib/attendanceCorrection";

export async function POST(request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const attendanceId = Number(body.attendanceId);
    const correctionType = String(body.correctionType ?? "").trim().toUpperCase();
    const reason = String(body.reason ?? "").trim();
    const requestedClockIn = body.requestedClockIn || null;
    const requestedClockOut = body.requestedClockOut || null;
    const requestedStatus = body.requestedStatus ? String(body.requestedStatus).toUpperCase() : null;

    if (Number.isNaN(attendanceId)) {
      return NextResponse.json({ success: false, message: "Attendance ID tidak valid" }, { status: 400 });
    }
    if (!ATTENDANCE_CORRECTION_TYPES.includes(correctionType)) {
      return NextResponse.json({ success: false, message: "Jenis koreksi wajib dipilih" }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ success: false, message: "Alasan wajib diisi" }, { status: 400 });
    }
    const parsedClockIn = parseOptionalDate(requestedClockIn);
    const parsedClockOut = parseOptionalDate(requestedClockOut);
    if (parsedClockIn === undefined || parsedClockOut === undefined) {
      return NextResponse.json({ success: false, message: "Jam koreksi tidak valid" }, { status: 400 });
    }
    if (["CLOCK_IN_MISSING", "CLOCK_IN_INCORRECT", "CLOCK_IN_OUT_INCORRECT"].includes(correctionType) && !parsedClockIn) {
      return NextResponse.json({ success: false, message: "Jam masuk seharusnya wajib diisi untuk jenis koreksi ini" }, { status: 400 });
    }
    if (["CLOCK_OUT_MISSING", "CLOCK_OUT_INCORRECT", "CLOCK_IN_OUT_INCORRECT"].includes(correctionType) && !parsedClockOut) {
      return NextResponse.json({ success: false, message: "Jam keluar seharusnya wajib diisi untuk jenis koreksi ini" }, { status: 400 });
    }
    if (parsedClockIn && parsedClockOut && parsedClockOut <= parsedClockIn) {
      return NextResponse.json({ success: false, message: "Jam keluar harus setelah jam masuk" }, { status: 400 });
    }
    if (requestedStatus && !["PRESENT", "LATE", "ABSENT", "HALF_DAY", "ON_LEAVE", "WORK_FROM_HOME", "HOLIDAY", "WEEKEND", "NOT_CLOCKED_IN", "EARLY_CHECKOUT", "OVERTIME"].includes(requestedStatus)) {
      return NextResponse.json({ success: false, message: "Status tidak valid" }, { status: 400 });
    }

    const attendance = await prisma.attendance.findUnique({ where: { id: attendanceId } });
    if (!attendance) {
      return NextResponse.json({ success: false, message: "Attendance tidak ditemukan" }, { status: 404 });
    }
    if (Number(attendance.userId) !== Number(actor.id)) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const pending = await prisma.attendanceCorrection.findFirst({
      where: { attendanceId, requestedById: Number(actor.id), status: "PENDING" },
    });
    if (pending) {
      return NextResponse.json({ success: false, message: "Masih ada pengajuan koreksi yang menunggu persetujuan" }, { status: 409 });
    }

    const correction = await prisma.$transaction(async (tx) => {
      const c = await tx.attendanceCorrection.create({
        data: {
          attendanceId,
          requestedById: Number(actor.id),
           correctionType,
           requestedClockIn: parsedClockIn,
           requestedClockOut: parsedClockOut,
          requestedStatus,
          reason,
        },
      });
      await tx.auditLog.create({
        data: { action: "ATTENDANCE_CORRECTION_REQUESTED", entity: "AttendanceCorrection", entityId: c.id, userId: Number(actor.id), details: `attendanceId=${attendanceId}` },
      });
      const recipients = await tx.user.findMany({
        where: {
          id: { not: Number(actor.id) },
          role: { in: ["ADMIN", "HR"] },
        },
        select: { id: true },
      });
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            userId: recipient.id,
            title: "Attendance correction baru",
            message: `${actor.name} mengajukan koreksi absensi yang perlu ditinjau.`,
          })),
        });
      }
      return c;
    });

    return NextResponse.json({ success: true, message: "Pengajuan koreksi berhasil dikirim", data: correction }, { status: 201 });
  } catch (error) {
    console.error("REQUEST CORRECTION ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengajukan koreksi" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const isReviewer = ATTENDANCE_CORRECTION_REVIEWER_ROLES.includes(actor.role);
    const corrections = await prisma.attendanceCorrection.findMany({
      where: isReviewer
        ? {}
        : { requestedById: Number(actor.id) },
      orderBy: { createdAt: "desc" },
      include: {
        attendance: true,
         requestedBy: { select: { id: true, name: true, email: true, employeeId: true, managerId: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ success: true, data: corrections });
  } catch (error) {
    console.error("GET CORRECTIONS ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil data koreksi" }, { status: 500 });
  }
}
