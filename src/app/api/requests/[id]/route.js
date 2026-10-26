import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { REQUEST_TYPE_VALUES } from "@/lib/requestTypes";
import { DOCUMENT_CATEGORIES } from "@/lib/documents";
import { ROLES } from "@/lib/roles";

const DOCUMENT_CATEGORY_VALUES = DOCUMENT_CATEGORIES.map(
  (item) => item.value
);

function parseDocumentCategory(type, value) {
  const category = String(value ?? "").trim().toUpperCase();

  if (type !== "ADMINISTRATIVE") return null;
  if (!DOCUMENT_CATEGORY_VALUES.includes(category)) return undefined;

  return category;
}

function parseRequestId(id) {
  const requestId = Number(id);
  return Number.isNaN(requestId) ? null : requestId;
}

function canManageRequest(user, request) {
  return (
    request.userId === Number(user.id) ||
    user.role === "ADMIN" ||
    user.role === "HR"
  );
}

function handleError(error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (error.message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  if (error.message === "FORBIDDEN") {
    return NextResponse.json(
      { success: false, message: "Forbidden" },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { success: false, message: fallbackMessage },
    { status: 500 }
  );
}

export async function PUT(request, { params }) {
  try {
    const user = await requireRole(ROLES);

    const { id } = await params;
    const requestId = parseRequestId(id);

    if (requestId === null) {
      return NextResponse.json(
        { success: false, message: "ID request tidak valid" },
        { status: 400 }
      );
    }

    const existingRequest = await prisma.request.findUnique({
      where: { id: requestId },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { success: false, message: "Request tidak ditemukan" },
        { status: 404 }
      );
    }

    if (!canManageRequest(user, existingRequest)) {
      return NextResponse.json(
        { success: false, message: "Kamu tidak memiliki akses ke request ini" },
        { status: 403 }
      );
    }

    if (existingRequest.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          message: "Request yang sudah diproses tidak dapat diedit",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim() || null;
    const type = String(body.type ?? "").trim().toUpperCase();
    const documentCategory = parseDocumentCategory(
      type,
      body.documentCategory
    );
    const departmentId =
      body.departmentId === null ||
      body.departmentId === undefined ||
      body.departmentId === ""
        ? null
        : Number(body.departmentId);

    if (!title) {
      return NextResponse.json(
        { success: false, message: "Judul request wajib diisi" },
        { status: 400 }
      );
    }

    if (!REQUEST_TYPE_VALUES.includes(type)) {
      return NextResponse.json(
        { success: false, message: "Tipe request tidak valid" },
        { status: 400 }
      );
    }

    if (documentCategory === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: "Kategori dokumen wajib dipilih untuk request administrative",
        },
        { status: 400 }
      );
    }

    if (departmentId !== null && Number.isNaN(departmentId)) {
      return NextResponse.json(
        { success: false, message: "Department tidak valid" },
        { status: 400 }
      );
    }

    if (departmentId !== null) {
      const departmentExists = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true },
      });

      if (!departmentExists) {
        return NextResponse.json(
          { success: false, message: "Department tidak valid" },
          { status: 400 }
        );
      }
    }

    const actedApprovalCount = await prisma.approval.count({
      where: {
        requestId,
        status: { not: "PENDING" },
      },
    });

    if (actedApprovalCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Request yang sudah diproses tidak dapat diedit",
        },
        { status: 400 }
      );
    }

    const approvalCount = await prisma.approval.count({
      where: { requestId },
    });

    if (type !== existingRequest.type && approvalCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tipe request tidak dapat diubah karena proses approval sudah dimulai",
        },
        { status: 400 }
      );
    }

    const updatedRequest = await prisma.request.update({
      where: { id: requestId },
      data: {
        title,
        description,
        type,
        documentCategory,
        departmentId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "REQUEST_UPDATED",
      entity: "Request",
      entityId: requestId,
      details: `type=${type}`,
    });

    return NextResponse.json({
      success: true,
      message: "Request berhasil diperbarui",
      data: updatedRequest,
    });
  } catch (error) {
    return handleError(error, "Gagal memperbarui request");
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireRole(ROLES);

    const { id } = await params;
    const requestId = parseRequestId(id);

    if (requestId === null) {
      return NextResponse.json(
        { success: false, message: "ID request tidak valid" },
        { status: 400 }
      );
    }

    const existingRequest = await prisma.request.findUnique({
      where: { id: requestId },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { success: false, message: "Request tidak ditemukan" },
        { status: 404 }
      );
    }

    if (!canManageRequest(user, existingRequest)) {
      return NextResponse.json(
        { success: false, message: "Kamu tidak memiliki akses ke request ini" },
        { status: 403 }
      );
    }

    if (existingRequest.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          message: "Request yang sudah diproses tidak dapat dihapus",
        },
        { status: 400 }
      );
    }

    const actedApprovalCount = await prisma.approval.count({
      where: {
        requestId,
        status: { not: "PENDING" },
      },
    });

    if (actedApprovalCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Request yang sudah diproses tidak dapat dihapus",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.approval.deleteMany({ where: { requestId } });
      await tx.request.delete({ where: { id: requestId } });

      await tx.auditLog.create({
        data: {
          action: "REQUEST_DELETED",
          entity: "Request",
          entityId: requestId,
          userId: Number(user.id),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Request berhasil dihapus",
    });
  } catch (error) {
    return handleError(error, "Gagal menghapus request");
  }
}
