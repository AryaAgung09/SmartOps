import { prisma } from "@/lib/prisma";
import {
  addMonths,
  budgetUsage,
  getInvoiceState,
  monthEnd,
  monthLabel,
  monthStart,
  paidAmount,
  startOfToday,
  toNumber,
  withInvoiceTotals,
} from "@/lib/finance";

function dateRangeWhere(field, start, end) {
  return { [field]: { gte: start, lte: end } };
}

function mergeWhere(base, condition) {
  if (!base || Object.keys(base).length === 0) return condition;
  return { AND: [base, condition] };
}

export async function getFinanceOverview() {
  const today = startOfToday();
  const currentStart = monthStart();
  const currentEnd = monthEnd();
  const flowStart = addMonths(currentStart, -5);

  const [budgets, expenses, invoices, payments, pendingExpenses, vendors, recentExpenses, recentInvoices] = await Promise.all([
    prisma.budget.findMany({
      where: { status: "ACTIVE" },
      include: { department: { select: { id: true, name: true } } },
      orderBy: { periodEnd: "asc" },
    }),
    prisma.expense.findMany({
      where: { status: { in: ["APPROVED", "PAID"] } },
      select: {
        id: true,
        amount: true,
        category: true,
        budgetId: true,
        departmentId: true,
        expenseDate: true,
      },
    }),
    prisma.invoice.findMany({
      where: { status: { not: "CANCELLED" } },
      select: {
        id: true,
        amount: true,
        dueDate: true,
        status: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: flowStart, lte: currentEnd } },
      select: { amount: true, direction: true, paymentDate: true },
    }),
    prisma.expense.findMany({
      where: { status: "PENDING" },
      select: { amount: true },
    }),
    prisma.financeVendor.count({ where: { isActive: true } }),
    prisma.expense.findMany({
      take: 5,
      include: {
        department: { select: { name: true } },
        vendor: { select: { name: true } },
      },
      orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
    }),
    prisma.invoice.findMany({
      where: { status: { notIn: ["PAID", "CANCELLED"] } },
      take: 5,
      include: {
        vendor: { select: { name: true } },
        payments: { select: { amount: true } },
      },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    }),
  ]);

  const budgetSpend = new Map();
  for (const expense of expenses) {
    if (!expense.budgetId) continue;
    budgetSpend.set(expense.budgetId, (budgetSpend.get(expense.budgetId) || 0) + toNumber(expense.amount));
  }

  const budgetRows = budgets.map((budget) => {
    const usage = budgetUsage(budget.amount, budgetSpend.get(budget.id) || 0);
    return {
      id: budget.id,
      name: budget.name,
      department: budget.department?.name || "Perusahaan",
      periodEnd: budget.periodEnd,
      amount: toNumber(budget.amount),
      ...usage,
    };
  });

  const totalBudget = budgetRows.reduce((total, budget) => total + budget.amount, 0);
  const totalSpent = budgetRows.reduce((total, budget) => total + budget.spent, 0);
  const totalRemaining = totalBudget - totalSpent;

  const invoiceRows = invoices.map((invoice) => {
    const paid = paidAmount(invoice.payments);
    return {
      ...invoice,
      paid,
      outstanding: Math.max(toNumber(invoice.amount) - paid, 0),
      displayStatus: getInvoiceState(invoice),
    };
  });

  const outstanding = invoiceRows.reduce((total, invoice) => total + invoice.outstanding, 0);
  const overdueRows = invoiceRows.filter((invoice) => invoice.displayStatus === "OVERDUE");
  const overdueAmount = overdueRows.reduce((total, invoice) => total + invoice.outstanding, 0);

  const currentPayments = payments.filter(
    (payment) => new Date(payment.paymentDate) >= currentStart && new Date(payment.paymentDate) <= currentEnd
  );
  const cashIn = currentPayments
    .filter((payment) => payment.direction === "INBOUND")
    .reduce((total, payment) => total + toNumber(payment.amount), 0);
  const cashOut = currentPayments
    .filter((payment) => payment.direction === "OUTBOUND")
    .reduce((total, payment) => total + toNumber(payment.amount), 0);

  const cashFlow = [];
  for (let offset = 0; offset < 6; offset += 1) {
    const start = addMonths(currentStart, offset - 5);
    const end = monthEnd(start);
    const monthPayments = payments.filter(
      (payment) => new Date(payment.paymentDate) >= start && new Date(payment.paymentDate) <= end
    );
    cashFlow.push({
      label: monthLabel(start),
      inbound: monthPayments
        .filter((payment) => payment.direction === "INBOUND")
        .reduce((total, payment) => total + toNumber(payment.amount), 0),
      outbound: monthPayments
        .filter((payment) => payment.direction === "OUTBOUND")
        .reduce((total, payment) => total + toNumber(payment.amount), 0),
    });
  }

  const currentExpenses = expenses.filter(
    (expense) =>
      new Date(expense.expenseDate) >= currentStart && new Date(expense.expenseDate) <= currentEnd
  );
  const categoryTotals = new Map();
  for (const expense of currentExpenses) {
    categoryTotals.set(
      expense.category,
      (categoryTotals.get(expense.category) || 0) + toNumber(expense.amount)
    );
  }
  const spendingByCategory = [...categoryTotals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    generatedAt: new Date(),
    totalBudget,
    totalSpent,
    totalRemaining,
    utilization: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
    outstanding,
    overdueAmount,
    overdueCount: overdueRows.length,
    pendingCount: pendingExpenses.length,
    pendingAmount: pendingExpenses.reduce((total, expense) => total + toNumber(expense.amount), 0),
    vendorCount: vendors,
    cashIn,
    cashOut,
    netCash: cashIn - cashOut,
    budgetRows,
    cashFlow,
    spendingByCategory,
    recentExpenses,
    recentInvoices: recentInvoices.map(withInvoiceTotals),
    today,
  };
}

export async function getBudgetList(filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.departmentId) where.departmentId = Number(filters.departmentId);
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { notes: { contains: filters.search } },
    ];
  }

  const budgets = await prisma.budget.findMany({
    where,
    include: {
      department: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      expenses: {
        where: { status: { in: ["APPROVED", "PAID"] } },
        select: { amount: true },
      },
    },
    orderBy: [{ status: "asc" }, { periodStart: "desc" }],
  });

  const rows = budgets.map((budget) => {
    const spent = budget.expenses.reduce((total, expense) => total + toNumber(expense.amount), 0);
    return {
      ...budget,
      spent,
      ...budgetUsage(budget.amount, spent),
      expenseCount: budget.expenses.length,
    };
  });

  return {
    budgets: rows,
    summary: {
      total: rows.length,
      active: rows.filter((budget) => budget.status === "ACTIVE").length,
      amount: rows.reduce((total, budget) => total + toNumber(budget.amount), 0),
      spent: rows.reduce((total, budget) => total + budget.spent, 0),
    },
  };
}

export async function getExpenseList(filters = {}) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const base = {};

  if (filters.category) base.category = filters.category;
  if (filters.departmentId) base.departmentId = Number(filters.departmentId);
  if (filters.vendorId) base.vendorId = Number(filters.vendorId);
  if (filters.budgetId) base.budgetId = Number(filters.budgetId);
  if (filters.search) {
    base.OR = [
      { title: { contains: filters.search } },
      { notes: { contains: filters.search } },
      { vendor: { name: { contains: filters.search } } },
    ];
  }

  const where = mergeWhere(base, filters.status ? { status: filters.status } : {});

  const [expenses, total, grouped] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
        budget: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.expense.count({ where }),
    prisma.expense.groupBy({
      by: ["status"],
      where: base,
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const summary = {
    total: grouped.reduce((totalCount, item) => totalCount + item._count._all, 0),
    pending: 0,
    approved: 0,
    rejected: 0,
    paid: 0,
    amount: grouped.reduce((totalAmount, item) => totalAmount + toNumber(item._sum.amount), 0),
  };

  for (const item of grouped) {
    if (item.status === "PENDING") summary.pending = item._count._all;
    if (item.status === "APPROVED") summary.approved = item._count._all;
    if (item.status === "REJECTED") summary.rejected = item._count._all;
    if (item.status === "PAID") summary.paid = item._count._all;
  }

  return {
    expenses,
    summary,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

export async function getExpenseById(id) {
  return prisma.expense.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      budget: { select: { id: true, name: true, periodStart: true, periodEnd: true } },
      payroll: {
        select: {
          id: true,
          payrollPeriod: { select: { name: true } },
          user: { select: { name: true, employeeId: true } },
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
      payments: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { paymentDate: "desc" },
      },
    },
  });
}

export async function getVendorList(filters = {}) {
  const where = {};
  if (!filters.includeInactive) where.isActive = true;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { email: { contains: filters.search } },
      { phone: { contains: filters.search } },
    ];
  }

  const vendors = await prisma.financeVendor.findMany({
    where,
    include: {
      expenses: { select: { amount: true, status: true } },
      invoices: {
        select: {
          amount: true,
          status: true,
          dueDate: true,
          payments: { select: { amount: true } },
        },
      },
      _count: { select: { expenses: true, invoices: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = vendors.map((vendor) => {
    const invoiceRows = vendor.invoices.map((invoice) => ({
      ...invoice,
      paid: paidAmount(invoice.payments),
    }));
    const invoiceTotal = invoiceRows.reduce((total, invoice) => total + toNumber(invoice.amount), 0);
    const outstanding = invoiceRows
      .filter((invoice) => invoice.status !== "CANCELLED")
      .reduce(
        (total, invoice) => total + Math.max(toNumber(invoice.amount) - invoice.paid, 0),
        0
      );
    return {
      ...vendor,
      invoiceTotal,
      outstanding,
      expenseTotal: vendor.expenses
        .filter((expense) => ["APPROVED", "PAID"].includes(expense.status))
        .reduce((total, expense) => total + toNumber(expense.amount), 0),
    };
  });

  return {
    vendors: rows,
    summary: {
      total: rows.length,
      active: rows.filter((vendor) => vendor.isActive).length,
      outstanding: rows.reduce((total, vendor) => total + vendor.outstanding, 0),
      expenseTotal: rows.reduce((total, vendor) => total + vendor.expenseTotal, 0),
    },
  };
}

export async function getInvoiceList(filters = {}) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const where = {};

  if (filters.vendorId) where.vendorId = Number(filters.vendorId);
  if (filters.departmentId) where.departmentId = Number(filters.departmentId);
  if (filters.search) {
    where.OR = [
      { invoiceNumber: { contains: filters.search } },
      { notes: { contains: filters.search } },
      { vendor: { name: { contains: filters.search } } },
    ];
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      vendor: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      payments: { select: { id: true, amount: true, paymentDate: true } },
    },
    orderBy: [{ issueDate: "desc" }, { id: "desc" }],
  });

  const mapped = invoices.map(withInvoiceTotals);
  const filtered = filters.status
    ? mapped.filter((invoice) => invoice.displayStatus === filters.status)
    : mapped;
  const total = filtered.length;
  const paged = filtered.slice((page - 1) * limit, page * limit);

  return {
    invoices: paged,
    summary: {
      total: mapped.length,
      outstanding: mapped
        .filter((invoice) => invoice.displayStatus !== "CANCELLED")
        .reduce((totalAmount, invoice) => totalAmount + invoice.outstanding, 0),
      overdue: mapped.filter((invoice) => invoice.displayStatus === "OVERDUE").length,
      paid: mapped.filter((invoice) => invoice.displayStatus === "PAID").length,
    },
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

export async function getInvoiceById(id) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      vendor: true,
      department: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      payments: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { paymentDate: "desc" },
      },
    },
  });

  return invoice ? withInvoiceTotals(invoice) : null;
}

export async function getPaymentList(filters = {}) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const where = {};

  if (filters.direction) where.direction = filters.direction;
  if (filters.method) where.method = filters.method;
  if (filters.search) {
    where.OR = [
      { reference: { contains: filters.search } },
      { vendor: { name: { contains: filters.search } } },
      { invoice: { invoiceNumber: { contains: filters.search } } },
      { expense: { title: { contains: filters.search } } },
    ];
  }

  const [payments, total, inbound, outbound] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
        expense: { select: { id: true, title: true, payrollId: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where: mergeWhere(where, { direction: "INBOUND" }),
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: mergeWhere(where, { direction: "OUTBOUND" }),
      _sum: { amount: true },
    }),
  ]);

  return {
    payments,
    summary: {
      total,
      inbound: toNumber(inbound._sum.amount),
      outbound: toNumber(outbound._sum.amount),
    },
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

export async function getFinanceOptions() {
  const [departments, vendors, budgets] = await Promise.all([
    prisma.department.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.financeVendor.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.budget.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, periodStart: true, periodEnd: true, amount: true },
      orderBy: { periodStart: "desc" },
    }),
  ]);

  return { departments, vendors, budgets };
}

export async function getPaymentTargets() {
  const [invoices, expenses, vendors] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { notIn: ["PAID", "CANCELLED"] } },
      include: {
        vendor: { select: { id: true, name: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.expense.findMany({
      where: { status: "APPROVED" },
      include: {
        vendor: { select: { id: true, name: true } },
        department: { select: { name: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { expenseDate: "asc" },
    }),
    prisma.financeVendor.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    invoices: invoices
      .map((invoice) => ({
        ...invoice,
        paid: paidAmount(invoice.payments),
        outstanding: Math.max(
          toNumber(invoice.amount) - paidAmount(invoice.payments),
          0
        ),
      }))
      .filter((invoice) => invoice.outstanding > 0),
    expenses: expenses
      .map((expense) => ({
        ...expense,
        paid: paidAmount(expense.payments),
        outstanding: Math.max(
          toNumber(expense.amount) - paidAmount(expense.payments),
          0
        ),
      }))
      .filter((expense) => expense.outstanding > 0),
    vendors,
  };
}

export async function getExpenseStatusSummary() {
  const grouped = await prisma.expense.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { amount: true },
  });
  return grouped;
}

export async function getFinanceSnapshot() {
  const [expenses, invoices, payments, budgets] = await Promise.all([
    prisma.expense.findMany({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      take: 4,
      include: { vendor: { select: { name: true } } },
      orderBy: { expenseDate: "desc" },
    }),
    prisma.invoice.findMany({
      where: { status: { notIn: ["PAID", "CANCELLED"] } },
      include: { vendor: { select: { name: true } }, payments: { select: { amount: true } } },
      take: 4,
      orderBy: { dueDate: "asc" },
    }),
    prisma.payment.findMany({
      take: 4,
      include: {
        vendor: { select: { name: true } },
        invoice: { select: { invoiceNumber: true } },
        expense: { select: { title: true } },
      },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.budget.findMany({
      where: { status: "ACTIVE" },
      include: {
        department: { select: { name: true } },
        expenses: {
          where: { status: { in: ["APPROVED", "PAID"] } },
          select: { amount: true },
        },
      },
      take: 3,
      orderBy: { periodEnd: "asc" },
    }),
  ]);

  return {
    expenses,
    invoices: invoices.map((invoice) => ({
      ...invoice,
      paid: paidAmount(invoice.payments),
      outstanding: Math.max(toNumber(invoice.amount) - paidAmount(invoice.payments), 0),
      displayStatus: getInvoiceState(invoice),
    })),
    payments,
    budgets: budgets.map((budget) => {
      const spent = budget.expenses.reduce((total, expense) => total + toNumber(expense.amount), 0);
      return { ...budget, spent, ...budgetUsage(budget.amount, spent) };
    }),
  };
}

export function financeDateWhere(start, end) {
  return dateRangeWhere("paymentDate", start, end);
}
