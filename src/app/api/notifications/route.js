import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

/*
 * GET
 *
 * Semua role yang sudah login boleh
 * melihat notification miliknya sendiri.
 */
export async function GET() {
  try {
    const user = await requireRole(ROLES);

    const notifications =
      await prisma.notification.findMany({
        where: {
          userId: Number(user.id),
        },

        orderBy: {
          createdAt: "desc",
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
      data: notifications,
    });
  } catch (error) {
    console.error(
      "GET NOTIFICATIONS ERROR:",
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
          "Gagal mengambil notification",
      },
      { status: 500 }
    );
  }
}

/*
 * POST
 *
 * Hanya ADMIN dan HR yang boleh
 * membuat notification manual.
 *
 * Notification otomatis dari sistem
 * seperti approval tetap dibuat langsung
 * melalui Prisma transaction dan tidak
 * menggunakan endpoint POST ini.
 */
export async function POST(request) {
  try {
    const user = await requireRole([
      "ADMIN",
      "HR",
    ]);

    const body = await request.json();

    const title =
      body.title?.toString().trim();

    const message =
      body.message?.toString().trim();

    const targetUserId =
      body.userId !== undefined
        ? Number(body.userId)
        : Number(user.id);

    /*
     * Validasi input.
     */
    if (!title || !message) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Title dan message wajib diisi",
        },
        { status: 400 }
      );
    }

    /*
     * Validasi user ID penerima.
     */
    if (Number.isNaN(targetUserId)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User ID tidak valid",
        },
        { status: 400 }
      );
    }

    /*
     * Pastikan user penerima benar-benar ada.
     */
    const targetUser =
      await prisma.user.findUnique({
        where: {
          id: targetUserId,
        },

        select: {
          id: true,
        },
      });

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User penerima notification tidak ditemukan",
        },
        { status: 404 }
      );
    }

    /*
     * Buat notification.
     */
    const notification =
      await prisma.notification.create({
        data: {
          title,
          message,
          userId: targetUserId,
        },

        select: {
          id: true,
          title: true,
          message: true,
          isRead: true,
          userId: true,
          createdAt: true,
        },
      });

    return NextResponse.json(
      {
        success: true,
        message:
          "Notification berhasil dibuat",
        data: notification,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "CREATE NOTIFICATION ERROR:",
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
          "Gagal membuat notification",
      },
      { status: 500 }
    );
  }
}