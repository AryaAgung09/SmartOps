import { connection } from "next/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

export async function GET() {
  await connection();

  try {
    const user = await requireRole(ROLES);

    const count = await prisma.notification.count({
      where: {
        userId: Number(user.id),
        isRead: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        count,
      },
    });
  } catch (error) {
    console.error(
      "GET UNREAD NOTIFICATION ERROR:",
      error instanceof Error ? error.message : "Unknown error"
    );

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
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
        message: "Gagal mengambil jumlah notification",
      },
      { status: 500 }
    );
  }
}