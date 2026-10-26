import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  PAYMENT_DIRECTIONS,
  PAYMENT_METHODS,
  cleanText,
  formatCurrency,
  paidAmount,
  parseDateInput,
  toNumber,
} from "@/lib/finance";
import {
  authError,
  parseAmount,
  recalculateExpense,
  recalculateInvoice,
  toId,
  writeAudit,
} from "@/lib/financeService";

const methodValues = PAYMENT_METHODS.map((item) => item.value);
const directionValues = PAYMENT_DIRECTIONS.map((item) => item.value);

export async function POST(request) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal mencatat pembayaran" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const invoiceId = toId(body.invoiceId);
  const expenseId = toId(body.expenseId);
  const amount = parseAmount(body.amount);
  const paymentDate = parseDateInput(body.paymentDate);
  const method = methodValues.includes(body.method) ? body.method : "BANK_TRANSFER";
  const reference = cleanText(body.reference, 120);
  const notes = cleanText(body.notes, 2000);

  if (!amount) {
    return NextResponse.json({ success: false, message: "Jumlah pembayaran harus lebih dari 0" }, { status: 400 });
  }
  if (!paymentDate) {
    return NextResponse.json({ success: false, message: "Tanggal pembayaran tidak valid" }, { status: 400 });
  }
  if (invoiceId && expenseId) {
    return NextResponse.json(
      { success: false, message: "Pembayaran hanya dapat dikaitkan ke satu invoice atau satu pengeluaran" },
      { status: 400 }
    );
  }

  let direction = directionValues.includes(body.direction) ? body.direction : null;
  let vendorId = toId(body.vendorId);
  let invoice = null;
  let expense = null;

  if (invoiceId) {
    invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { select: { amount: true } } },
    });
    if (!invoice) {
      return NextResponse.json({ success: false, message: "Invoice tidak ditemukan" }, { status: 404 });
    }
    if (["PAID", "CANCELLED"].includes(invoice.status)) {
      return NextResponse.json({ success: false, message: "Invoice ini tidak dapat dibayar" }, { status: 400 });
    }
    const outstanding = Math.max(toNumber(invoice.amount) - paidAmount(invoice.payments), 0);
    if (amount > outstanding) {
      return NextResponse.json(
        { success: false, message: `Jumlah melebihi sisa tagihan ${formatCurrency(outstanding)}` },
        { status: 400 }
      );
    }
    direction = "OUTBOUND";
    vendorId = invoice.vendorId;
  }

  if (expenseId) {
    expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { payments: { select: { amount: true } } },
    });
    if (!expense) {
      return NextResponse.json({ success: false, message: "Pengeluaran tidak ditemukan" }, { status: 404 });
    }
    if (expense.status !== "APPROVED") {
      return NextResponse.json(
        { success: false, message: "Pengeluaran harus disetujui sebelum dibayar" },
        { status: 400 }
      );
    }
    const outstanding = Math.max(toNumber(expense.amount) - paidAmount(expense.payments), 0);
    if (amount > outstanding) {
      return NextResponse.json(
        { success: false, message: `Jumlah melebihi sisa pengeluaran ${formatCurrency(outstanding)}` },
        { status: 400 }
      );
    }
    direction = "OUTBOUND";
    vendorId = expense.vendorId || vendorId;
  }

  if (!direction) direction = "OUTBOUND";
  if (vendorId) {
    const vendor = await prisma.financeVendor.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor tidak ditemukan" }, { status: 400 });
    }
  }

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          direction,
          amount,
          paymentDate,
          method,
          reference: reference || null,
          notes: notes || null,
          invoiceId,
          expenseId,
          vendorId,
          createdById: actor.id,
        },
        include: {
          vendor: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
          expense: { select: { id: true, title: true } },
        },
      });

      if (invoiceId) {
        const updated = await recalculateInvoice(tx, invoiceId);
        if (updated.status === "PAID" && invoice.status !== "PAID" && invoice.createdById !== actor.id) {
          await tx.notification.create({
            data: {
              userId: invoice.createdById,
              title: "Invoice lunas",
              message: `Invoice ${invoice.invoiceNumber} sebesar ${formatCurrency(invoice.amount)} telah lunas.`,
            },
          });
        }
      }
      if (expenseId) {
        await recalculateExpense(tx, expenseId);
      }

      await writeAudit(
        tx,
        actor.id,
        "PAYMENT_CREATED",
        "Payment",
        created.id,
        `direction=${direction}, amount=${amount}, invoiceId=${invoiceId || ""}, expenseId=${expenseId || ""}`
      );

      return created;
    });

    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, message: "Gagal mencatat pembayaran" }, { status: 500 });
  }
}
