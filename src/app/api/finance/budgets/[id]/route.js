import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { BUDGET_STATUSES, cleanText, parseDateInput, toNumber } from "@/lib/finance";
import { authError, parseAmount, toId, writeAudit } from "@/lib/financeService";

const statusValues = BUDGET_STATUSES.map((item) => item.value);

export async function PATCH(request, context) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal memperbarui budget" }, { status: 500 });
  }

  const id = toId((await context.params).id);
  if (!id) {
    return NextResponse.json({ success: false, message: "Budget tidak valid" }, { status: 400 });
  }

  const existing = await prisma.budget.findUnique({
    where: { id },
    include: {
      expenses: {
        where: { status: { in: ["APPROVED", "PAID"] } },
        select: { amount: true },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ success: false, message: "Budget tidak ditemukan" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  const spent = existing.expenses.reduce((total, expense) => total + toNumber(expense.amount), 0);

  if (body.status !== undefined) {
    if (!statusValues.includes(body.status)) {
      return NextResponse.json({ success: false, message: "Status budget tidak valid" }, { status: 400 });
    }
    data.status = body.status;
  }

  if (body.name !== undefined) {
    const name = cleanText(body.name, 120);
    if (name.length < 2) {
      return NextResponse.json({ success: false, message: "Nama budget minimal 2 karakter" }, { status: 400 });
    }
    data.name = name;
  }

  if (body.periodStart !== undefined || body.periodEnd !== undefined) {
    const periodStart = parseDateInput(body.periodStart ?? existing.periodStart.toISOString().slice(0, 10));
    const periodEnd = parseDateInput(body.periodEnd ?? existing.periodEnd.toISOString().slice(0, 10));
    if (!periodStart || !periodEnd || periodEnd < periodStart) {
      return NextResponse.json({ success: false, message: "Periode budget tidak valid" }, { status: 400 });
    }
    data.periodStart = periodStart;
    data.periodEnd = periodEnd;
  }

  if (body.amount !== undefined) {
    const amount = parseAmount(body.amount);
    if (!amount) {
      return NextResponse.json({ success: false, message: "Jumlah budget harus lebih dari 0" }, { status: 400 });
    }
    if (amount < spent) {
      return NextResponse.json(
        { success: false, message: "Jumlah budget tidak boleh lebih kecil dari realisasi" },
        { status: 400 }
      );
    }
    data.amount = amount;
  }

  if (body.departmentId !== undefined) {
    data.departmentId = toId(body.departmentId);
  }

  if (body.notes !== undefined) {
    data.notes = cleanText(body.notes, 5000) || null;
  }

  try {
    const budget = await prisma.$transaction(async (tx) => {
      const updated = await tx.budget.update({
        where: { id },
        data,
        include: { department: { select: { id: true, name: true } } },
      });
      await writeAudit(tx, actor.id, "BUDGET_UPDATED", "Budget", id, `fields=${Object.keys(data).join(",")}`);
      return updated;
    });
    return NextResponse.json({ success: true, data: budget });
  } catch {
    return NextResponse.json({ success: false, message: "Gagal memperbarui budget" }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal menghapus budget" }, { status: 500 });
  }

  const id = toId((await context.params).id);
  if (!id) {
    return NextResponse.json({ success: false, message: "Budget tidak valid" }, { status: 400 });
  }

  const expenseCount = await prisma.expense.count({ where: { budgetId: id } });
  if (expenseCount > 0) {
    return NextResponse.json(
      { success: false, message: "Budget yang sudah dipakai pengeluaran tidak dapat dihapus" },
      { status: 400 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.budget.delete({ where: { id } });
      await writeAudit(tx, actor.id, "BUDGET_DELETED", "Budget", id, "deleted");
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "Gagal menghapus budget" }, { status: 500 });
  }
}
