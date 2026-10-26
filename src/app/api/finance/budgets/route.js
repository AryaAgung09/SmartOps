import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getBudgetList } from "@/lib/financeQueries";
import { BUDGET_STATUSES, cleanText, parseDateInput } from "@/lib/finance";
import { authError, parseAmount, toId, writeAudit } from "@/lib/financeService";

const statusValues = BUDGET_STATUSES.map((item) => item.value);

export async function GET(request) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal memuat budget" }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const result = await getBudgetList({
    search: cleanText(params.get("search"), 120),
    status: statusValues.includes(params.get("status")) ? params.get("status") : "",
    departmentId: toId(params.get("departmentId")),
    actorId: actor.id,
  });

  return NextResponse.json({ success: true, data: result, ...result });
}

export async function POST(request) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal membuat budget" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name, 120);
  const periodStart = parseDateInput(body.periodStart);
  const periodEnd = parseDateInput(body.periodEnd);
  const amount = parseAmount(body.amount);
  const departmentId = toId(body.departmentId);
  const notes = cleanText(body.notes, 5000);

  if (name.length < 2) {
    return NextResponse.json({ success: false, message: "Nama budget minimal 2 karakter" }, { status: 400 });
  }
  if (!periodStart || !periodEnd) {
    return NextResponse.json({ success: false, message: "Periode budget tidak valid" }, { status: 400 });
  }
  if (periodEnd < periodStart) {
    return NextResponse.json({ success: false, message: "Tanggal akhir harus setelah tanggal mulai" }, { status: 400 });
  }
  if (!amount) {
    return NextResponse.json({ success: false, message: "Jumlah budget harus lebih dari 0" }, { status: 400 });
  }
  if (departmentId) {
    const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
    if (!department) {
      return NextResponse.json({ success: false, message: "Departemen tidak ditemukan" }, { status: 400 });
    }
  }

  try {
    const budget = await prisma.$transaction(async (tx) => {
      const created = await tx.budget.create({
        data: {
          name,
          departmentId,
          periodStart,
          periodEnd,
          amount,
          notes: notes || null,
          createdById: actor.id,
        },
        include: { department: { select: { id: true, name: true } } },
      });
      await writeAudit(tx, actor.id, "BUDGET_CREATED", "Budget", created.id, `name=${name}, amount=${amount}`);
      return created;
    });

    return NextResponse.json({ success: true, data: budget }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, message: "Gagal membuat budget" }, { status: 500 });
  }
}
