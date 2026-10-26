import { prisma } from "@/lib/prisma";
import {
  EXPIRY_WINDOW_DAYS,
  addDays,
  buildDocumentWhere,
  canViewDocument,
  getDocumentStatus,
  startOfToday,
} from "@/lib/documents";

function mergeWhere(base, condition) {
  if (!base || Object.keys(base).length === 0) return condition;
  return { AND: [base, condition] };
}

export function withDocumentStatus(document) {
  return { ...document, status: getDocumentStatus(document) };
}

export async function getDocumentSummary(user, filters = {}) {
  const { status, ...rest } = filters;
  const base = buildDocumentWhere(user, rest);
  const today = startOfToday();
  const warningDate = addDays(today, EXPIRY_WINDOW_DAYS);

  const [total, active, expiring, expired, archived] = await Promise.all([
    prisma.employeeDocument.count({ where: base }),
    prisma.employeeDocument.count({
      where: mergeWhere(base, {
        archived: false,
        OR: [{ expiryDate: null }, { expiryDate: { gt: warningDate } }],
      }),
    }),
    prisma.employeeDocument.count({
      where: mergeWhere(base, {
        archived: false,
        expiryDate: { gte: today, lte: warningDate },
      }),
    }),
    prisma.employeeDocument.count({
      where: mergeWhere(base, { archived: false, expiryDate: { lt: today } }),
    }),
    prisma.employeeDocument.count({ where: mergeWhere(base, { archived: true }) }),
  ]);

  return { total, active, expiring, expired, archived };
}

export async function getDocumentList(user, filters = {}) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const { status, ...rest } = filters;
  const where = buildDocumentWhere(user, filters);

  const [documents, total, summary] = await Promise.all([
    prisma.employeeDocument.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        uploadedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.employeeDocument.count({ where }),
    getDocumentSummary(user, rest),
  ]);

  return {
    documents: documents.map(withDocumentStatus),
    summary,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

export async function getDocumentById(id, user) {
  const document = await prisma.employeeDocument.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, department: { select: { name: true } } } },
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!document || !canViewDocument(user, document)) return null;
  return withDocumentStatus(document);
}
