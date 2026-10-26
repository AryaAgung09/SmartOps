import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  INVOICE_STATUSES,
  cleanText,
  paidAmount,
  parseDateInput,
  toNumber,
} from "@/lib/finance";
import {
  authError,
  parseAmount,
  recalculateInvoice,
  toId,
  writeAudit,
} from "@/lib/financeService";

const statusValues = INVOICE_STATUSES.map((item) => item.value);

export async function PATCH(request, context) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal memperbarui invoice" }, { status: 500 });
  }

  const id = toId((await context.params).id);
  if (!id) {
    return NextResponse.json({ success: false, message: "Invoice tidak valid" }, { status: 400 });
  }

  const existing = await prisma.invoice.findUnique({
    where: { id },
    include: { payments: { select: { amount: true } } },
  });
  if (!existing) {
    return NextResponse.json({ success: false, message: "Invoice tidak ditemukan" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  const paid = paidAmount(existing.payments);
  const canEdit = paid === 0 && !["PAID", "CANCELLED"].includes(existing.status);

  if (body.invoiceNumber !== undefined) {
    if (!canEdit) {
      return NextResponse.json({ success: false, message: "Invoice ini tidak dapat diedit" }, { status: 400 });
    }
    const invoiceNumber = cleanText(body.invoiceNumber, 80);
    if (invoiceNumber.length < 2) {
      return NextResponse.json({ success: false, message: "Nomor invoice minimal 2 karakter" }, { status: 400 });
    }
    data.invoiceNumber = invoiceNumber;
  }

  if (body.vendorId !== undefined) {
    if (!canEdit) {
      return NextResponse.json({ success: false, message: "Invoice ini tidak dapat diedit" }, { status: 400 });
    }
    data.vendorId = toId(body.vendorId);
  }

  if (body.departmentId !== undefined) data.departmentId = toId(body.departmentId);

  if (body.issueDate !== undefined || body.dueDate !== undefined) {
    if (!canEdit) {
      return NextResponse.json({ success: false, message: "Invoice ini tidak dapat diedit" }, { status: 400 });
    }
    const issueDate = parseDateInput(body.issueDate ?? existing.issueDate.toISOString().slice(0, 10));
    const dueDate = parseDateInput(body.dueDate ?? existing.dueDate.toISOString().slice(0, 10));
    if (!issueDate || !dueDate || dueDate < issueDate) {
      return NextResponse.json({ success: false, message: "Tanggal invoice tidak valid" }, { status: 400 });
    }
    data.issueDate = issueDate;
    data.dueDate = dueDate;
  }

  if (body.amount !== undefined) {
    if (!canEdit) {
      return NextResponse.json({ success: false, message: "Invoice ini tidak dapat diedit" }, { status: 400 });
    }
    const amount = parseAmount(body.amount);
    if (!amount) {
      return NextResponse.json({ success: false, message: "Jumlah invoice harus lebih dari 0" }, { status: 400 });
    }
    data.amount = amount;
  }

  if (body.notes !== undefined) data.notes = cleanText(body.notes, 5000) || null;

  if (body.status !== undefined) {
    const status = String(body.status);
    if (!statusValues.includes(status)) {
      return NextResponse.json({ success: false, message: "Status invoice tidak valid" }, { status: 400 });
    }
    if (status === "PAID" || status === "PARTIALLY_PAID" || status === "OVERDUE") {
      return NextResponse.json(
        { success: false, message: "Status pembayaran dihitung otomatis dari pembayaran" },
        { status: 400 }
      );
    }
    if (status === "CANCELLED" && paid > 0) {
      return NextResponse.json(
        { success: false, message: "Invoice yang sudah memiliki pembayaran tidak dapat dibatalkan" },
        { status: 400 }
      );
    }
    if (existing.status === "PAID" && status !== "PAID") {
      return NextResponse.json(
        { success: false, message: "Invoice lunas tidak dapat diubah statusnya" },
        { status: 400 }
      );
    }
    data.status = status;
  }

  if (paid > toNumber(data.amount ?? existing.amount)) {
    return NextResponse.json(
      { success: false, message: "Jumlah invoice tidak boleh lebih kecil dari pembayaran" },
      { status: 400 }
    );
  }

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      let updated = await tx.invoice.update({
        where: { id },
        data,
        include: { vendor: { select: { id: true, name: true } } },
      });
      if (updated.status !== "CANCELLED") {
        updated = await recalculateInvoice(tx, id);
      }
      await writeAudit(tx, actor.id, "INVOICE_UPDATED", "Invoice", id, `fields=${Object.keys(data).join(",")}`);
      return updated;
    });
    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json({ success: false, message: "Nomor invoice sudah digunakan" }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: "Gagal memperbarui invoice" }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal menghapus invoice" }, { status: 500 });
  }

  const id = toId((await context.params).id);
  if (!id) {
    return NextResponse.json({ success: false, message: "Invoice tidak valid" }, { status: 400 });
  }

  const existing = await prisma.invoice.findUnique({
    where: { id },
    include: { payments: { select: { id: true } } },
  });
  if (!existing) {
    return NextResponse.json({ success: false, message: "Invoice tidak ditemukan" }, { status: 404 });
  }
  if (existing.payments.length > 0 || !["DRAFT", "CANCELLED"].includes(existing.status)) {
    return NextResponse.json(
      { success: false, message: "Invoice yang sudah diproses tidak dapat dihapus" },
      { status: 400 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoice.delete({ where: { id } });
      await writeAudit(tx, actor.id, "INVOICE_DELETED", "Invoice", id, `number=${existing.invoiceNumber}`);
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "Gagal menghapus invoice" }, { status: 500 });
  }
}
