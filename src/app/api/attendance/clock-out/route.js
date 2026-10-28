import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getDateOnlyInTz, getStartOfDayInTz, getScheduleForUser, getCalendarStatus, getAttendanceMetrics } from "@/lib/attendance";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const dayStart = getStartOfDayInTz(now);
    const attendanceDate = getDateOnlyInTz(now);

    const attendance = await prisma.attendance.findUnique({
      where: { userId_date: { userId: Number(user.id), date: attendanceDate } },
    });

    if (!attendance || !attendance.clockIn) {
      return NextResponse.json({ success: false, message: "Belum melakukan clock-in hari ini" }, { status: 400 });
    }
    if (attendance.clockOut) {
      return NextResponse.json({ success: false, message: "Sudah melakukan clock-out hari ini" }, { status: 409 });
    }

    const schedule = await getScheduleForUser(prisma, user.id);
    const calendar = await getCalendarStatus(prisma, user.id, dayStart, schedule);
    const metrics = getAttendanceMetrics(attendance.clockIn, now, dayStart, schedule);

    const updated = await prisma.$transaction(async (tx) => {
      const att = await tx.attendance.update({
        where: { id: attendance.id },
        data: {
          clockOut: now,
          workingMinutes: metrics.workingMinutes,
          scheduledStart: attendance.scheduledStart || metrics.scheduledStart,
          scheduledEnd: attendance.scheduledEnd || metrics.scheduledEnd,
          breakMinutes: metrics.breakMinutes,
          lateMinutes: metrics.lateMinutes,
          earlyCheckoutMinutes: metrics.earlyCheckoutMinutes,
          overtimeMinutes: metrics.overtimeMinutes,
          status: calendar.status || metrics.status,
        },
      });
      await tx.auditLog.create({
        data: { action: "ATTENDANCE_CLOCK_OUT", entity: "Attendance", entityId: att.id, userId: Number(user.id), details: `minutes=${metrics.workingMinutes || 0}` },
      });
      return att;
    });

    return NextResponse.json({ success: true, message: "Clock-out berhasil", data: updated });
  } catch (error) {
    console.error("CLOCK_OUT ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal melakukan clock-out" }, { status: 500 });
  }
}
