import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getStartOfDayInTz, getScheduleForUser, getCalendarStatus, getAttendanceMetrics } from "@/lib/attendance";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const dayStart = getStartOfDayInTz(now);
    const schedule = await getScheduleForUser(prisma, user.id);
    const calendar = await getCalendarStatus(prisma, user.id, dayStart, schedule);
    const metrics = getAttendanceMetrics(now, null, dayStart, schedule);

    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId: Number(user.id), date: dayStart } },
    });

    if (existing && existing.clockIn) {
      return NextResponse.json({ success: false, message: "Sudah melakukan clock-in hari ini" }, { status: 409 });
    }

    const status = calendar.status || metrics.status;

    const attendance = await prisma.$transaction(async (tx) => {
      if (existing) {
        const updated = await tx.attendance.update({
          where: { id: existing.id },
          data: {
            clockIn: now,
            status,
            scheduledStart: metrics.scheduledStart,
            scheduledEnd: metrics.scheduledEnd,
            breakMinutes: metrics.breakMinutes,
            lateMinutes: metrics.lateMinutes,
            notes: existing.notes,
          },
        });
        await tx.auditLog.create({
          data: { action: "ATTENDANCE_CLOCK_IN", entity: "Attendance", entityId: updated.id, userId: Number(user.id), details: `status=${status}` },
        });
        return updated;
      }

      const created = await tx.attendance.create({
        data: {
          userId: Number(user.id),
          date: dayStart,
          clockIn: now,
          status,
          scheduledStart: metrics.scheduledStart,
          scheduledEnd: metrics.scheduledEnd,
          breakMinutes: metrics.breakMinutes,
          lateMinutes: metrics.lateMinutes,
        },
      });
      await tx.auditLog.create({
        data: { action: "ATTENDANCE_CLOCK_IN", entity: "Attendance", entityId: created.id, userId: Number(user.id), details: `status=${status}` },
      });
      return created;
    });

    return NextResponse.json({ success: true, message: "Clock-in berhasil", data: attendance });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ success: false, message: "Sudah melakukan clock-in hari ini" }, { status: 409 });
    }
    console.error("CLOCK_IN ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal melakukan clock-in" }, { status: 500 });
  }
}
