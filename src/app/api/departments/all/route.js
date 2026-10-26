import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  try {
    await requireRole(["ADMIN", "HR"]);
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, status: true },
    });
    return NextResponse.json({ success: true, data: departments });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    console.error("GET DEPARTMENTS ALL ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil data department" }, { status: 500 });
  }
}
