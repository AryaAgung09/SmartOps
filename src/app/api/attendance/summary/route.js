import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAttendanceSummary } from "@/lib/attendanceSummary";

export async function GET(request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    if (employeeId && Number.isNaN(Number(employeeId))) return NextResponse.json({ success: false, message: "Employee ID tidak valid" }, { status: 400 });
    const result = await getAttendanceSummary(prisma, actor, {
      date: searchParams.get("date"),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      employeeId,
      scope: searchParams.get("scope"),
    });
    if (!result) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("GET ATTENDANCE SUMMARY ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil attendance summary" }, { status: 500 });
  }
}
