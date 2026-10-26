import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

function authError(error) {
  if (error.message === "UNAUTHORIZED") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  if (error.message === "FORBIDDEN") {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST(request, { params }) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal mengirim pengingat" }, { status: 500 });
  }

  const { id } = await params;
  const documentId = Number(id);
  const document = await prisma.employeeDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      title: true,
      ownerId: true,
      expiryDate: true,
    },
  });

  if (!document) {
    return NextResponse.json({ success: false, message: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  const recipients = document.ownerId
    ? [document.ownerId]
    : (
        await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "HR"] } },
          select: { id: true },
        })
      ).map((user) => user.id);

  const expiryText = document.expiryDate
    ? ` Berlaku hingga ${new Date(document.expiryDate).toLocaleDateString("id-ID")}.`
    : "";

  const message = `Pengingat dokumen "${document.title}".${expiryText}`;

  const result = await prisma.$transaction(async (tx) => {
    const notifications = await tx.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        title: "Pengingat dokumen",
        message,
      })),
    });

    await tx.auditLog.create({
      data: {
        action: "DOCUMENT_REMINDER_SENT",
        entity: "EmployeeDocument",
        entityId: documentId,
        userId: actor.id,
        details: `recipients=${recipients.length}`,
      },
    });

    return notifications;
  });

  return NextResponse.json({ success: true, data: { count: result.count } });
}
