import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";

export async function GET(request, { params }) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const userId = Number(id);
    if (Number.isNaN(userId)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });

    const isAdmin = actor.role === "ADMIN" || actor.role === "HR";
    if (!isAdmin && Number(actor.id) !== userId) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

    const salaries = await prisma.salaryStructure.findMany({
      where: { userId },
      orderBy: { effectiveFrom: "desc" },
    });
    return NextResponse.json({ success: true, data: salaries });
  } catch (error) {
    console.error("GET SALARY ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil salary" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const { id } = await params;
    const userId = Number(id);
    if (Number.isNaN(userId)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });

    const body = await request.json();
    const basicSalary = body.basicSalary;
    const currency = body.currency || "IDR";
    const effectiveFrom = body.effectiveFrom;
    if (basicSalary === undefined || !effectiveFrom) return NextResponse.json({ success: false, message: "Data tidak lengkap" }, { status: 400 });

    const salary = await prisma.$transaction(async (tx) => {
      await tx.salaryStructure.updateMany({ where: { userId, status: "ACTIVE", effectiveTo: null }, data: { status: "INACTIVE", effectiveTo: new Date(effectiveFrom) } });
      const created = await tx.salaryStructure.create({
        data: { userId, basicSalary, currency, effectiveFrom: new Date(effectiveFrom), status: "ACTIVE" },
      });
      await tx.auditLog.create({
        data: { action: "SALARY_CREATED", entity: "SalaryStructure", entityId: created.id, userId: Number(actor.id), details: `userId=${userId}` },
      });
      return created;
    });

    return NextResponse.json({ success: true, data: salary }, { status: 201 });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    console.error("CREATE SALARY ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal menambahkan salary" }, { status: 500 });
  }
}
