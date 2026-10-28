import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { getDateOnlyInTz } from "@/lib/attendance";

export async function GET(request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const employeeIdParam = searchParams.get("employeeId");
    const status = searchParams.get("status");
    const shiftIdParam = searchParams.get("shiftId");
    const departmentIdParam = searchParams.get("departmentId");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const scope = searchParams.get("scope");

    const isAdmin = actor.role === "ADMIN" || actor.role === "HR";

    let where = {};

    if (isAdmin && scope !== "me") {
      if (employeeIdParam) {
        const employeeId = Number(employeeIdParam);
        if (Number.isNaN(employeeId)) return NextResponse.json({ success: false, message: "Employee ID tidak valid" }, { status: 400 });
        where.userId = employeeId;
      }
      if (date) {
        const d = getDateOnlyInTz(new Date(date));
        where.date = d;
      }
      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = getDateOnlyInTz(new Date(startDate));
        if (endDate) where.date.lte = getDateOnlyInTz(new Date(endDate));
      }
      if (status && ["PRESENT", "LATE", "ABSENT", "HALF_DAY", "ON_LEAVE", "WORK_FROM_HOME", "HOLIDAY", "WEEKEND", "NOT_CLOCKED_IN", "EARLY_CHECKOUT", "OVERTIME"].includes(status)) {
        where.status = status;
      }
      if (shiftIdParam) {
        const shiftId = Number(shiftIdParam);
        if (Number.isNaN(shiftId)) return NextResponse.json({ success: false, message: "Shift ID tidak valid" }, { status: 400 });
        where.user = { ...(where.user || {}), shiftId };
      }
      if (departmentIdParam) {
        const departmentId = Number(departmentIdParam);
        if (Number.isNaN(departmentId)) return NextResponse.json({ success: false, message: "Department ID tidak valid" }, { status: 400 });
        where.user = { ...(where.user || {}), departmentId };
      }
    } else {
      where.userId = Number(actor.id);
      if (status && ["PRESENT", "LATE", "ABSENT", "HALF_DAY", "ON_LEAVE", "WORK_FROM_HOME", "HOLIDAY", "WEEKEND", "NOT_CLOCKED_IN", "EARLY_CHECKOUT", "OVERTIME"].includes(status)) {
        where.status = status;
      }
      if (date) {
        const d = getDateOnlyInTz(new Date(date));
        where.date = d;
      }
      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = getDateOnlyInTz(new Date(startDate));
        if (endDate) where.date.lte = getDateOnlyInTz(new Date(endDate));
      }
    }

    let page = 1;
    let limit = 20;
    if (pageParam !== null) {
      const p = Number(pageParam);
      if (!Number.isNaN(p) && p >= 1 && Number.isInteger(p)) page = p;
    }
    if (limitParam !== null) {
      const l = Number(limitParam);
      if (!Number.isNaN(l) && l >= 1 && Number.isInteger(l) && l <= 100) limit = l;
    }
    const skip = (page - 1) * limit;

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        orderBy: [{ date: "desc" }, { clockIn: "desc" }],
        skip,
        take: limit,
         include: { user: { select: { id: true, name: true, email: true, employeeId: true, shift: { select: { id: true, name: true, startTime: true, endTime: true, gracePeriodMinutes: true } }, workSchedule: { select: { id: true, name: true, startTime: true, endTime: true, gracePeriodMinutes: true } } } } },
      }),
      prisma.attendance.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: attendances,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET ATTENDANCE ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil data attendance" }, { status: 500 });
  }
}
