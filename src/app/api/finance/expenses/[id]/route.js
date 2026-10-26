import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  cleanText,
  formatCurrency,
  parseDateInput,
} from "@/lib/finance";
import { authError, parseAmount, toId, writeAudit } from "@/lib/financeService";

const categoryValues = EXPENSE_CATEGORIES.map((item) => item.value);
const statusValues = EXPENSE_STATUSES.map((item) => item.value);

export async function PATCH(request, context) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal memperbarui pengeluaran" }, { status: 500 });
  }

  const id = toId((await context.params).id);
  if (!id) {
    return NextResponse.json({ success: false, message: "Pengeluaran tidak valid" }, { status: 400 });
  }

  const existing = await prisma.expense.findUnique({
    where: { id },
    include: { payments: { select: { id: true } } },
  });
  if (!existing) {
    return NextResponse.json({ success: false, message: "Pengeluaran tidak ditemukan" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  let notification = null;

  if (body.status !== undefined) {
    const status = String(body.status);
    if (!statusValues.includes(status)) {
      return NextResponse.json({ success: false, message: "Status pengeluaran tidak valid" }, { status: 400 });
    }
    if (status === "PAID") {
      return NextResponse.json(
        { success: false, message: "Gunakan menu pembayaran untuk menandai pengeluaran sebagai dibayar" },
        { status: 400 }
      );
    }
    if (existing.status === "PAID") {
      return NextResponse.json(
        { success: false, message: "Pengeluaran yang sudah dibayar tidak dapat diubah statusnya" },
        { status: 400 }
      );
    }

    data.status = status;
    if (status === "APPROVED") {
      data.approvedById = actor.id;
      data.approvedAt = new Date();
      notification = {
        userId: existing.createdById,
        title: "Pengeluaran disetujui",
        message: `Pengeluaran "${existing.title}" sebesar ${formatCurrency(existing.amount)} telah disetujui.`,
      };
    } else if (status === "REJECTED") {
      data.approvedById = actor.id;
      data.approvedAt = new Date();
      notification = {
        userId: existing.createdById,
        title: "Pengeluaran ditolak",
        message: `Pengeluaran "${existing.title}" sebesar ${formatCurrency(existing.amount)} ditolak.`,
      };
    } else {
      data.approvedById = null;
      data.approvedAt = null;
    }
  }

  const canEdit = ["DRAFT", "PENDING"].includes(existing.status) && existing.payments.length === 0;

  if (body.title !== undefined) {
    if (!canEdit) {
      return NextResponse.json({ success: false, message: "Pengeluaran ini tidak dapat diedit" }, { status: 400 });
    }
    const title = cleanText(body.title, 160);
    if (title.length < 2) {
      return NextResponse.json({ success: false, message: "Judul pengeluaran minimal 2 karakter" }, { status: 400 });
    }
    data.title = title;
  }

  if (body.category !== undefined) {
    if (!canEdit) {
      return NextResponse.json({ success: false, message: "Pengeluaran ini tidak dapat diedit" }, { status: 400 });
    }
    if (!categoryValues.includes(body.category)) {
      return NextResponse.json({ success: false, message: "Kategori pengeluaran tidak valid" }, { status: 400 });
    }
    data.category = body.category;
  }

  if (body.amount !== undefined) {
    if (!canEdit) {
      return NextResponse.json({ success: false, message: "Pengeluaran ini tidak dapat diedit" }, { status: 400 });
    }
    const amount = parseAmount(body.amount);
    if (!amount) {
      return NextResponse.json({ success: false, message: "Jumlah pengeluaran harus lebih dari 0" }, { status: 400 });
    }
    data.amount = amount;
  }

  if (body.expenseDate !== undefined) {
    if (!canEdit) {
      return NextResponse.json({ success: false, message: "Pengeluaran ini tidak dapat diedit" }, { status: 400 });
    }
    const expenseDate = parseDateInput(body.expenseDate);
    if (!expenseDate) {
      return NextResponse.json({ success: false, message: "Tanggal pengeluaran tidak valid" }, { status: 400 });
    }
    data.expenseDate = expenseDate;
  }

  if (body.departmentId !== undefined) data.departmentId = toId(body.departmentId);
  if (body.vendorId !== undefined) data.vendorId = toId(body.vendorId);
  if (body.budgetId !== undefined) data.budgetId = toId(body.budgetId);
  if (body.notes !== undefined) data.notes = cleanText(body.notes, 5000) || null;

  try {
    const expense = await prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data,
        include: {
          department: { select: { id: true, name: true } },
          vendor: { select: { id: true, name: true } },
          budget: { select: { id: true, name: true } },
        },
      });
      if (notification && notification.userId !== actor.id) {
        await tx.notification.create({ data: notification });
      }
      await writeAudit(
        tx,
        actor.id,
        "EXPENSE_UPDATED",
        "Expense",
        id,
        `fields=${Object.keys(data).join(",")}`
      );
      return updated;
    });

    return NextResponse.json({ success: true, data: expense });
  } catch {
    return NextResponse.json({ success: false, message: "Gagal memperbarui pengeluaran" }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal menghapus pengeluaran" }, { status: 500 });
  }

  const id = toId((await context.params).id);
  if (!id) {
    return NextResponse.json({ success: false, message: "Pengeluaran tidak valid" }, { status: 400 });
  }

  const existing = await prisma.expense.findUnique({
    where: { id },
    include: { payments: { select: { id: true } } },
  });
  if (!existing) {
    return NextResponse.json({ success: false, message: "Pengeluaran tidak ditemukan" }, { status: 404 });
  }
  if (existing.payments.length > 0 || !["DRAFT", "REJECTED"].includes(existing.status)) {
    return NextResponse.json(
      { success: false, message: "Pengeluaran yang sudah diproses tidak dapat dihapus" },
      { status: 400 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.expense.delete({ where: { id } });
      await writeAudit(tx, actor.id, "EXPENSE_DELETED", "Expense", id, `title=${existing.title}`);
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "Gagal menghapus pengeluaran" }, { status: 500 });
  }
}
