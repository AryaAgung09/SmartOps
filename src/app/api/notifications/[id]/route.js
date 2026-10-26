import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

export async function PATCH(
  request,
  { params }
) {
  try {
    const user = await requireRole(ROLES);

    const { id } = await params;
    const notificationId = Number(id);

    if (Number.isNaN(notificationId)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID notification tidak valid",
        },
        { status: 400 }
      );
    }

    const notification =
      await prisma.notification.findUnique({
        where: {
          id: notificationId,
        },
      });

    if (!notification) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Notification tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // User hanya boleh mengubah notification miliknya
    if (
      notification.userId !==
      Number(user.id)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kamu tidak memiliki akses ke notification ini",
        },
        { status: 403 }
      );
    }

    const updatedNotification =
      await prisma.notification.update({
        where: {
          id: notificationId,
        },

        data: {
          isRead: true,
        },

        select: {
          id: true,
          title: true,
          message: true,
          isRead: true,
          createdAt: true,
        },
      });

    return NextResponse.json({
      success: true,
      message:
        "Notification ditandai sudah dibaca",
      data: updatedNotification,
    });
  } catch (error) {
    console.error(
      "MARK NOTIFICATION READ ERROR:",
      error
    );

    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengubah notification",
      },
      { status: 500 }
    );
  }
}