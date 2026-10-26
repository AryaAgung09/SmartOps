import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { cleanText } from "@/lib/finance";
import { authError, toId, writeAudit } from "@/lib/financeService";

export async function PATCH(request, context) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal memperbarui vendor" }, { status: 500 });
  }

  const id = toId((await context.params).id);
  if (!id) {
    return NextResponse.json({ success: false, message: "Vendor tidak valid" }, { status: 400 });
  }

  const existing = await prisma.financeVendor.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, message: "Vendor tidak ditemukan" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};

  if (body.name !== undefined) {
    const name = cleanText(body.name, 120);
    if (name.length < 2) {
      return NextResponse.json({ success: false, message: "Nama vendor minimal 2 karakter" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.email !== undefined) data.email = cleanText(body.email, 160) || null;
  if (body.phone !== undefined) data.phone = cleanText(body.phone, 40) || null;
  if (body.address !== undefined) data.address = cleanText(body.address, 1000) || null;
  if (body.taxNumber !== undefined) data.taxNumber = cleanText(body.taxNumber, 80) || null;
  if (body.notes !== undefined) data.notes = cleanText(body.notes, 2000) || null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  try {
    const vendor = await prisma.$transaction(async (tx) => {
      const updated = await tx.financeVendor.update({ where: { id }, data });
      await writeAudit(tx, actor.id, "VENDOR_UPDATED", "FinanceVendor", id, `fields=${Object.keys(data).join(",")}`);
      return updated;
    });
    return NextResponse.json({ success: true, data: vendor });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json({ success: false, message: "Nama vendor sudah digunakan" }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: "Gagal memperbarui vendor" }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal menghapus vendor" }, { status: 500 });
  }

  const id = toId((await context.params).id);
  if (!id) {
    return NextResponse.json({ success: false, message: "Vendor tidak valid" }, { status: 400 });
  }

  const [expenseCount, invoiceCount, paymentCount] = await Promise.all([
    prisma.expense.count({ where: { vendorId: id } }),
    prisma.invoice.count({ where: { vendorId: id } }),
    prisma.payment.count({ where: { vendorId: id } }),
  ]);

  if (expenseCount + invoiceCount + paymentCount > 0) {
    return NextResponse.json(
      { success: false, message: "Vendor yang memiliki transaksi tidak dapat dihapus. Nonaktifkan vendor saja." },
      { status: 400 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.financeVendor.delete({ where: { id } });
      await writeAudit(tx, actor.id, "VENDOR_DELETED", "FinanceVendor", id, "deleted");
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "Gagal menghapus vendor" }, { status: 500 });
  }
}
