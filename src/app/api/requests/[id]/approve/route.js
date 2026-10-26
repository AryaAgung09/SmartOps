import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  getCurrentApproval,
  getNextApproval,
} from "@/lib/requestApproval";
import { ROLES } from "@/lib/roles";

class ApprovalError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function POST(request, { params }) {
  try {
    const user = await requireRole(ROLES);

    const { id } = await params;
    const requestId = Number(id);

    if (Number.isNaN(requestId)) {
      return NextResponse.json(
        { success: false, message: "ID request tidak valid." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const action = body.action;
    const comment =
      typeof body.comment === "string"
        ? body.comment.trim() || null
        : null;

    if (!["APPROVED", "REJECTED"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          message: "Action harus APPROVED atau REJECTED.",
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM requests
        WHERE id = ${requestId}
        FOR UPDATE
      `;

      const existingRequest = await tx.request.findUnique({
        where: { id: requestId },
        include: {
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
            orderBy: { stepOrder: "asc" },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (!existingRequest) {
        throw new ApprovalError(404, "Request tidak ditemukan.");
      }

      if (existingRequest.status !== "PENDING") {
        throw new ApprovalError(400, "Request sudah diproses.");
      }

      if (Number(existingRequest.userId) === Number(user.id)) {
        throw new ApprovalError(
          403,
          "Pemilik request tidak dapat melakukan approval terhadap request sendiri."
        );
      }

      const currentApproval = getCurrentApproval(
        existingRequest.approvals
      );

      if (!currentApproval) {
        throw new ApprovalError(
          400,
          "Tidak ada tahap approval yang sedang menunggu tindakan."
        );
      }

      const isAdmin = user.role === "ADMIN";
      const isTargetRole =
        currentApproval.approverRole === user.role;

      if (!isAdmin && !isTargetRole) {
        throw new ApprovalError(
          403,
          `Saat ini request menunggu approval dari role ${currentApproval.approverRole || "berwenang"}.`
        );
      }

      const approval = await tx.approval.update({
        where: { id: currentApproval.id },
        data: {
          status: action,
          approverId: Number(user.id),
          comment,
          actedAt: new Date(),
        },
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
      });

      const overrideNote = isAdmin && !isTargetRole;

      if (action === "REJECTED") {
        const updatedRequest = await tx.request.update({
          where: { id: requestId },
          data: { status: "REJECTED" },
        });

        await tx.auditLog.create({
          data: {
            action: "REQUEST_REJECTED",
            entity: "Request",
            entityId: requestId,
            userId: Number(user.id),
            details: `step=${currentApproval.stepOrder}, role=${currentApproval.approverRole}, adminOverride=${overrideNote}`,
          },
        });

        await tx.notification.create({
          data: {
            userId: existingRequest.userId,
            title: "Request Ditolak",
            message: `Request "${existingRequest.title}" ditolak oleh ${user.name}.`,
          },
        });

        return {
          approval,
          request: updatedRequest,
          completed: true,
          rejected: true,
        };
      }

      const nextApproval = getNextApproval(
        existingRequest.approvals,
        currentApproval.stepOrder
      );

      if (!nextApproval) {
        const updatedRequest = await tx.request.update({
          where: { id: requestId },
          data: {
            status: "APPROVED",
            currentStep: currentApproval.stepOrder + 1,
          },
        });

        await tx.auditLog.create({
          data: {
            action: "REQUEST_APPROVED",
            entity: "Request",
            entityId: requestId,
            userId: Number(user.id),
            details: `step=${currentApproval.stepOrder}, role=${currentApproval.approverRole}, adminOverride=${overrideNote}`,
          },
        });

        await tx.notification.create({
          data: {
            userId: existingRequest.userId,
            title: "Request Disetujui",
            message: `Request "${existingRequest.title}" telah disetujui.`,
          },
        });

        return {
          approval,
          request: updatedRequest,
          completed: true,
          rejected: false,
        };
      }

      const updatedRequest = await tx.request.update({
        where: { id: requestId },
        data: {
          status: "PENDING",
          currentStep: nextApproval.stepOrder,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "REQUEST_APPROVED",
          entity: "Request",
          entityId: requestId,
          userId: Number(user.id),
          details: `step=${currentApproval.stepOrder}, role=${currentApproval.approverRole}, adminOverride=${overrideNote}`,
        },
      });

      if (nextApproval.approverRole) {
        const recipients = await tx.user.findMany({
          where: {
            role: nextApproval.approverRole,
            employmentStatus: "ACTIVE",
            id: { not: existingRequest.userId },
          },
          select: { id: true },
        });

        if (recipients.length > 0) {
          await tx.notification.createMany({
            data: recipients.map((recipient) => ({
              userId: recipient.id,
              title: "Approval Request Baru",
              message: `Request "${existingRequest.title}" menunggu approval Anda.`,
            })),
          });
        }
      }

      await tx.notification.create({
        data: {
          userId: existingRequest.userId,
          title: "Request Diproses",
          message: `Request "${existingRequest.title}" disetujui oleh ${user.name} dan diteruskan ke ${nextApproval.stepLabel || "tahap berikutnya"}.`,
        },
      });

      return {
        approval,
        request: updatedRequest,
        completed: false,
        rejected: false,
      };
    });

    return NextResponse.json(
      {
        success: true,
        message: result.rejected
          ? "Request berhasil ditolak."
          : result.completed
            ? "Request berhasil disetujui."
            : "Approval berhasil diproses.",
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ApprovalError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Forbidden." },
        { status: 403 }
      );
    }

    console.error("APPROVAL ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Gagal memproses approval." },
      { status: 500 }
    );
  }
}
