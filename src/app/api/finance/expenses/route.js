import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getExpenseList } from "@/lib/financeQueries";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  cleanText,
  parseDateInput,
} from "@/lib/finance";
import { authError, parseAmount, toId, writeAudit } from "@/lib/financeService";

const categoryValues = EXPENSE_CATEGORIES.map((item) => item.value);
const statusValues = EXPENSE_STATUSES.map((item) => item.value);

export async function GET(request) {
  try {
    await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal memuat pengeluaran" }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const result = await getExpenseList({
    search: cleanText(params.get("search"), 120),
    category: categoryValues.includes(params.get("category")) ? params.get("category") : "",
    status: statusValues.includes(params.get("status")) ? params.get("status") : "",
    departmentId: toId(params.get("departmentId")),
    vendorId: toId(params.get("vendorId")),
    budgetId: toId(params.get("budgetId")),
    page: Number(params.get("page")) || 1,
    limit: Number(params.get("limit")) || 20,
  });

  return NextResponse.json({ success: true, data: result, ...result });
}

export async function POST(request) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal mencatat pengeluaran" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const title = cleanText(body.title, 160);
  const category = String(body.category || "");
  const amount = parseAmount(body.amount);
  const expenseDate = parseDateInput(body.expenseDate);
  const status = body.status === "DRAFT" ? "DRAFT" : "PENDING";
  const departmentId = toId(body.departmentId);
  const vendorId = toId(body.vendorId);
  const budgetId = toId(body.budgetId);
  const notes = cleanText(body.notes, 5000);

  if (title.length < 2) {
    return NextResponse.json({ success: false, message: "Judul pengeluaran minimal 2 karakter" }, { status: 400 });
  }
  if (!categoryValues.includes(category)) {
    return NextResponse.json({ success: false, message: "Kategori pengeluaran tidak valid" }, { status: 400 });
  }
  if (!amount) {
    return NextResponse.json({ success: false, message: "Jumlah pengeluaran harus lebih dari 0" }, { status: 400 });
  }
  if (!expenseDate) {
    return NextResponse.json({ success: false, message: "Tanggal pengeluaran tidak valid" }, { status: 400 });
  }

  const [vendor, budget] = await Promise.all([
    vendorId ? prisma.financeVendor.findUnique({ where: { id: vendorId }, select: { id: true } }) : null,
    budgetId ? prisma.budget.findUnique({ where: { id: budgetId }, select: { id: true, departmentId: true } }) : null,
  ]);

  if (vendorId && !vendor) {
    return NextResponse.json({ success: false, message: "Vendor tidak ditemukan" }, { status: 400 });
  }
  if (budgetId && !budget) {
    return NextResponse.json({ success: false, message: "Budget tidak ditemukan" }, { status: 400 });
  }

  try {
    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          title,
          category,
          amount,
          expenseDate,
          status,
          departmentId: departmentId || budget?.departmentId || null,
          vendorId,
          budgetId,
          notes: notes || null,
          createdById: actor.id,
        },
        include: {
          department: { select: { id: true, name: true } },
          vendor: { select: { id: true, name: true } },
          budget: { select: { id: true, name: true } },
        },
      });
      await writeAudit(
        tx,
        actor.id,
        "EXPENSE_CREATED",
        "Expense",
        created.id,
        `title=${title}, amount=${amount}, status=${status}`
      );
      return created;
    });

    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, message: "Gagal mencatat pengeluaran" }, { status: 500 });
  }
}
