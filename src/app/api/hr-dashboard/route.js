import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getHrDashboardData } from "@/lib/hrDashboard";

export async function GET(request) {
  try {
    await requireRole(["ADMIN", "HR"]);
    const { searchParams } = new URL(request.url);
    const data = await getHrDashboardData(searchParams.get("range") || "today");
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    console.error("GET HR DASHBOARD ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil HR dashboard" }, { status: 500 });
  }
}
