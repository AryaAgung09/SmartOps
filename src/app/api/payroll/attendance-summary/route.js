
import { connection } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getDateOnlyInTz } from "@/lib/attendance";
import { getAttendancePayrollSummary } from "@/lib/payroll";

export async function GET(request) {
  await connection();

  try {
    const actor = await getCurrentUser();

    if (!actor) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const startDate = getDateOnlyInTz(
      searchParams.get("startDate")
        ? new Date(searchParams.get("startDate"))
        : new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
          )
    );

    const endDate = getDateOnlyInTz(
      searchParams.get("endDate")
        ? new Date(searchParams.get("endDate"))
        : new Date()
    );

    const isAdmin =
      actor.role === "ADMIN" || actor.role === "HR";

    const requestedUserId = searchParams.get("userId");

    if (actor.role === "IT") {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden",
        },
        { status: 403 }
      );
    }

    if (
      requestedUserId &&
      Number.isNaN(Number(requestedUserId))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "User ID tidak valid",
        },
        { status: 400 }
      );
    }

    if (
      requestedUserId &&
      !isAdmin &&
      Number(requestedUserId) !== Number(actor.id)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden",
        },
        { status: 403 }
      );
    }

    const userId = isAdmin
      ? requestedUserId
      : actor.id;

    const data = await getAttendancePayrollSummary(
      prisma,
      {
        userId,
        startDate,
        endDate,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        startDate,
        endDate,
        userId: userId ? Number(userId) : null,
        ...data,
      },
    });
  } catch (error) {
    console.error(
      "GET PAYROLL ATTENDANCE SUMMARY ERROR:",
      error?.message || error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil ringkasan attendance payroll",
      },
      { status: 500 }
    );
  }
}
