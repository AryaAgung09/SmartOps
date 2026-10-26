import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_VISIBILITIES,
  canViewDocument,
  getDocumentStatus,
  parseDateInput,
} from "@/lib/documents";

const categoryValues = DOCUMENT_CATEGORIES.map((item) => item.value);
const visibilityValues = DOCUMENT_VISIBILITIES.map((item) => item.value);

function authError(error) {
  if (error.message === "UNAUTHORIZED") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  if (error.message === "FORBIDDEN") {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }
  return null;
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

async function findDocument(id) {
  return prisma.employeeDocument.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, department: { select: { name: true } } } },
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function GET(request, { params }) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const document = await findDocument(Number(id));

  if (!document) {
    return NextResponse.json({ success: false, message: "Dokumen tidak ditemukan" }, { status: 404 });
  }
  if (!canViewDocument(actor, document)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    data: { ...document, status: getDocumentStatus(document) },
  });
}

export async function PATCH(request, { params }) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal memperbarui dokumen" }, { status: 500 });
  }

  const { id } = await params;
  const documentId = Number(id);
  const existing = await findDocument(documentId);

  if (!existing) {
    return NextResponse.json({ success: false, message: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};

  if (body.title !== undefined) {
    const title = cleanText(body.title, 160);
    if (title.length < 2) {
      return NextResponse.json({ success: false, message: "Judul dokumen minimal 2 karakter" }, { status: 400 });
    }
    data.title = title;
  }

  if (body.category !== undefined) {
    if (!categoryValues.includes(body.category)) {
      return NextResponse.json({ success: false, message: "Kategori dokumen tidak valid" }, { status: 400 });
    }
    data.category = body.category;
  }

  if (body.visibility !== undefined) {
    if (!visibilityValues.includes(body.visibility)) {
      return NextResponse.json({ success: false, message: "Visibilitas dokumen tidak valid" }, { status: 400 });
    }
    data.visibility = body.visibility;
  }

  if (body.ownerId !== undefined) {
    const ownerId = body.ownerId === null || body.ownerId === "" ? null : Number(body.ownerId);
    if (ownerId) {
      const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!owner) {
        return NextResponse.json({ success: false, message: "Karyawan tidak ditemukan" }, { status: 400 });
      }
    }
    data.ownerId = ownerId;
  }

  if (body.issueDate !== undefined) {
    const issueDate = body.issueDate ? parseDateInput(body.issueDate) : null;
    if (body.issueDate && !issueDate) {
      return NextResponse.json({ success: false, message: "Tanggal terbit tidak valid" }, { status: 400 });
    }
    data.issueDate = issueDate;
  }

  if (body.expiryDate !== undefined) {
    const expiryDate = body.expiryDate ? parseDateInput(body.expiryDate) : null;
    if (body.expiryDate && !expiryDate) {
      return NextResponse.json({ success: false, message: "Tanggal kedaluwarsa tidak valid" }, { status: 400 });
    }
    data.expiryDate = expiryDate;
  }

  if (body.notes !== undefined) {
    data.notes = cleanText(body.notes, 5000) || null;
  }

  if (body.archived !== undefined) {
    data.archived = Boolean(body.archived);
  }

  const issueDate = data.issueDate !== undefined ? data.issueDate : existing.issueDate;
  const expiryDate = data.expiryDate !== undefined ? data.expiryDate : existing.expiryDate;
  if (issueDate && expiryDate && new Date(expiryDate) < new Date(issueDate)) {
    return NextResponse.json({ success: false, message: "Tanggal kedaluwarsa harus setelah tanggal terbit" }, { status: 400 });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, message: "Tidak ada perubahan" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.employeeDocument.update({
        where: { id: documentId },
        data,
        include: {
          owner: { select: { id: true, name: true, email: true, department: { select: { name: true } } } },
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "DOCUMENT_UPDATED",
          entity: "EmployeeDocument",
          entityId: documentId,
          userId: actor.id,
          details: `fields=${Object.keys(data).join(",")}`,
        },
      });

      return result;
    });

    return NextResponse.json({
      success: true,
      data: { ...updated, status: getDocumentStatus(updated) },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Gagal memperbarui dokumen" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal menghapus dokumen" }, { status: 500 });
  }

  const { id } = await params;
  const documentId = Number(id);
  const document = await findDocument(documentId);

  if (!document) {
    return NextResponse.json({ success: false, message: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.employeeDocument.delete({ where: { id: documentId } });
      await tx.auditLog.create({
        data: {
          action: "DOCUMENT_DELETED",
          entity: "EmployeeDocument",
          entityId: documentId,
          userId: actor.id,
          details: `title=${document.title}`,
        },
      });
    });

    await unlink(path.join(process.cwd(), "storage", "documents", document.filePath)).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Gagal menghapus dokumen" }, { status: 500 });
  }
}
