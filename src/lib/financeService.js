import { NextResponse } from "next/server";
import { cleanText, paidAmount, startOfToday, toNumber } from "@/lib/finance";

export function authError(error) {
  if (error?.message === "UNAUTHORIZED") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  if (error?.message === "FORBIDDEN") {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }
  return null;
}

export function toId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function parseAmount(value) {
  const amount = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export async function recalculateInvoice(tx, invoiceId) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: { select: { amount: true } } },
  });
  if (!invoice || invoice.status === "CANCELLED") return invoice;

  const paid = paidAmount(invoice.payments);
  const total = toNumber(invoice.amount);
  let status = invoice.status;

  if (invoice.status !== "DRAFT") {
    if (paid >= total && total > 0) {
      status = "PAID";
    } else if (paid > 0) {
      status = "PARTIALLY_PAID";
    } else if (new Date(invoice.dueDate) < startOfToday()) {
      status = "OVERDUE";
    } else {
      status = "SENT";
    }
  }

  return tx.invoice.update({
    where: { id: invoiceId },
    data: {
      status,
      paidAt: status === "PAID" ? invoice.paidAt || new Date() : null,
    },
  });
}

export async function recalculateExpense(tx, expenseId) {
  const expense = await tx.expense.findUnique({
    where: { id: expenseId },
    include: { payments: { select: { amount: true } } },
  });
  if (!expense || expense.status === "REJECTED" || expense.status === "DRAFT") return expense;

  const paid = paidAmount(expense.payments);
  const total = toNumber(expense.amount);
  let status = expense.status;

  if (paid >= total && total > 0) {
    status = "PAID";
  } else if (status === "PAID") {
    status = expense.approvedAt ? "APPROVED" : "PENDING";
  }

  return tx.expense.update({
    where: { id: expenseId },
    data: {
      status,
      paidAt: status === "PAID" ? expense.paidAt || new Date() : null,
    },
  });
}

export async function recordPayrollExpense(tx, payroll, actorId) {
  const existing = await tx.expense.findUnique({ where: { payrollId: payroll.id } });
  if (existing) return existing;

  const amount = toNumber(payroll.netSalary);
  if (amount <= 0) return null;

  const paymentDate = startOfToday();
  const periodName = payroll.payrollPeriod?.name || `Periode #${payroll.payrollPeriodId}`;
  const employeeName = payroll.user?.name || payroll.user?.email || `Karyawan #${payroll.userId}`;
  const title = cleanText(`Payroll ${employeeName} - ${periodName}`, 160);
  const notes = cleanText(
    `Pencatatan otomatis saat payroll ditandai lunas. Karyawan: ${employeeName}. Periode: ${periodName}. Net salary: ${amount}.`,
    5000
  );

  const expense = await tx.expense.create({
    data: {
      title,
      category: "PAYROLL",
      amount,
      expenseDate: paymentDate,
      status: "PAID",
      departmentId: payroll.user?.departmentId || null,
      payrollId: payroll.id,
      notes,
      createdById: actorId,
      approvedById: actorId,
      approvedAt: paymentDate,
      paidAt: paymentDate,
    },
  });

  await tx.payment.create({
    data: {
      direction: "OUTBOUND",
      amount,
      paymentDate,
      method: "BANK_TRANSFER",
      reference: `PAYROLL-${payroll.payrollPeriodId}-${payroll.id}`,
      notes,
      expenseId: expense.id,
      createdById: actorId,
    },
  });

  await writeAudit(
    tx,
    actorId,
    "PAYROLL_EXPENSE_CREATED",
    "Expense",
    expense.id,
    `payrollId=${payroll.id},periodId=${payroll.payrollPeriodId},amount=${amount}`
  );

  return expense;
}

export async function writeAudit(tx, actorId, action, entity, entityId, details) {
  return tx.auditLog.create({
    data: {
      action,
      entity,
      entityId,
      userId: actorId,
      details,
    },
  });
}
