import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { buildApprovalSteps } from "@/lib/requestApproval";
import { REQUEST_TYPE_VALUES, isRequestType } from "@/lib/requestTypes";
import { DOCUMENT_CATEGORIES } from "@/lib/documents";
import { ROLES } from "@/lib/roles";

const ALLOWED_REQUEST_STATUSES = [
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
  "CANCELLED",
];

const DOCUMENT_CATEGORY_VALUES = DOCUMENT_CATEGORIES.map(
  (item) => item.value
);

function parseDocumentCategory(type, value) {
  const category = String(value ?? "").trim().toUpperCase();

  if (type !== "ADMINISTRATIVE") return null;
  if (!DOCUMENT_CATEGORY_VALUES.includes(category)) return undefined;

  return category;
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const typeParam = searchParams.get("type");
    const departmentIdParam = searchParams.get("departmentId");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const where = {};

    if (user.role === "STAFF") {
      where.userId = Number(user.id);
    }

    if (statusParam) {
      const status = String(statusParam).trim().toUpperCase();
      if (!ALLOWED_REQUEST_STATUSES.includes(status)) {
        return NextResponse.json(
          { success: false, message: "Status tidak valid" },
          { status: 400 }
        );
      }
      where.status = status;
    }

    if (typeParam) {
      const type = String(typeParam).trim().toUpperCase();
      if (!isRequestType(type)) {
        return NextResponse.json(
          { success: false, message: "Tipe request tidak valid" },
          { status: 400 }
        );
      }
      where.type = type;
    }

    if (departmentIdParam) {
      const departmentId = Number(departmentIdParam);
      if (Number.isNaN(departmentId)) {
        return NextResponse.json(
          { success: false, message: "Department tidak valid" },
          { status: 400 }
        );
      }
      where.departmentId = departmentId;
    }

    let page = 1;
    let limit = 20;
    if (pageParam !== null) {
      const p = Number(pageParam);
      if (Number.isNaN(p) || p < 1 || !Number.isInteger(p)) {
        return NextResponse.json(
          { success: false, message: "Page tidak valid" },
          { status: 400 }
        );
      }
      page = p;
    }
    if (limitParam !== null) {
      const l = Number(limitParam);
      if (Number.isNaN(l) || l < 1 || !Number.isInteger(l) || l > 100) {
        return NextResponse.json(
          { success: false, message: "Limit tidak valid" },
          { status: 400 }
        );
      }
      limit = l;
    }

    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          approvals: {
            include: {
              approver: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
            orderBy: {
              stepOrder: "asc",
            },
          },
        },
      }),
      prisma.request.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET REQUESTS ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Gagal mengambil data request" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await requireRole(ROLES);

    const body = await request.json();

    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const type = String(body.type ?? "").trim().toUpperCase();

    if (!title) {
      return NextResponse.json(
        { success: false, message: "Judul request wajib diisi" },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { success: false, message: "Tipe request wajib dipilih" },
        { status: 400 }
      );
    }

    if (!REQUEST_TYPE_VALUES.includes(type)) {
      return NextResponse.json(
        { success: false, message: "Tipe request tidak valid" },
        { status: 400 }
      );
    }

    const documentCategory = parseDocumentCategory(
      type,
      body.documentCategory
    );

    if (documentCategory === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: "Kategori dokumen wajib dipilih untuk request administrative",
        },
        { status: 400 }
      );
    }

    const bodyDeptId =
      body.departmentId === null ||
      body.departmentId === undefined ||
      body.departmentId === ""
        ? null
        : Number(body.departmentId);

    if (bodyDeptId !== null && Number.isNaN(bodyDeptId)) {
      return NextResponse.json(
        { success: false, message: "Department tidak valid" },
        { status: 400 }
      );
    }

    if (bodyDeptId !== null) {
      const departmentExists = await prisma.department.findUnique({
        where: { id: bodyDeptId },
        select: { id: true },
      });

      if (!departmentExists) {
        return NextResponse.json(
          { success: false, message: "Department tidak valid" },
          { status: 400 }
        );
      }
    }

    const newRequest = await prisma.$transaction(async (tx) => {
      const approvalSteps = buildApprovalSteps(type);

      const createdRequest = await tx.request.create({
        data: {
          title,
          description: description || null,
          type,
          documentCategory,
          currentStep: approvalSteps[0]?.stepOrder ?? 1,
          user: {
            connect: { id: Number(user.id) },
          },
          department: user.departmentId
            ? {
                connect: { id: Number(user.departmentId) },
              }
            : undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await tx.approval.createMany({
        data: approvalSteps.map((step) => ({
          ...step,
          requestId: createdRequest.id,
        })),
      });

      const approvals = await tx.approval.findMany({
        where: { requestId: createdRequest.id },
        include: {
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { stepOrder: "asc" },
      });

      const firstApproval = approvals.find(
        (approval) => approval.status === "PENDING"
      );

      await tx.auditLog.create({
        data: {
          action: "REQUEST_CREATED",
          entity: "Request",
          entityId: createdRequest.id,
          userId: Number(user.id),
          details: `type=${createdRequest.type}, role=${firstApproval?.approverRole || "-"}`,
        },
      });

      if (firstApproval?.approverRole) {
        const recipients = await tx.user.findMany({
          where: {
            role: firstApproval.approverRole,
            employmentStatus: "ACTIVE",
            id: { not: Number(user.id) },
          },
          select: { id: true },
        });

        if (recipients.length > 0) {
          await tx.notification.createMany({
            data: recipients.map((recipient) => ({
              userId: recipient.id,
              title: "Approval Request Baru",
              message: `Request "${title}" dari ${user.name} menunggu approval Anda.`,
            })),
          });
        }
      }

      return { ...createdRequest, approvals };
    });

    return NextResponse.json(
      {
        success: true,
        message: "Request berhasil dibuat",
        data: newRequest,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CREATE REQUEST ERROR:", error);

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
      { success: false, message: "Gagal membuat request" },
      { status: 500 }
    );
  }
}
