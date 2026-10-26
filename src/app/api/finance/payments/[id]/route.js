import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  authError,
  recalculateExpense,
  recalculateInvoice,
  toId,
  writeAudit,
} from "@/lib/financeService";

export async function DELETE(request, context) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal menghapus pembayaran" }, { status: 500 });
  }

  const id = toId((await context.params).id);
  if (!id) {
    return NextResponse.json({ success: false, message: "Pembayaran tidak valid" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { expense: { select: { payrollId: true } } },
  });
  if (!payment) {
    return NextResponse.json({ success: false, message: "Pembayaran tidak ditemukan" }, { status: 404 });
  }
  if (payment.expense?.payrollId) {
    return NextResponse.json(
      { success: false, message: "Pembayaran payroll tidak dapat dihapus dari Finance" },
      { status: 400 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id } });
      if (payment.invoiceId) await recalculateInvoice(tx, payment.invoiceId);
      if (payment.expenseId) await recalculateExpense(tx, payment.expenseId);
      await writeAudit(tx, actor.id, "PAYMENT_DELETED", "Payment", id, `amount=${payment.amount}`);
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "Gagal menghapus pembayaran" }, { status: 500 });
  }
}
