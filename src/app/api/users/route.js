import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { createAuditLog } from "@/lib/auditLog";
import { ROLES } from "@/lib/roles";

const MANAGED_ROLES = ROLES;

export async function GET() {
  try {
    await requireRole(["ADMIN", "HR"]);

    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);

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
        message: "Gagal mengambil data user",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const actor = await requireRole(["ADMIN"]);

    const body = await request.json();

    const {
      name,
      email,
      password,
      role,
      departmentId,
    } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama, email, password, dan role wajib diisi",
        },
        { status: 400 }
      );
    }

    const normalizedRole = String(role).trim().toUpperCase();

    if (!MANAGED_ROLES.includes(normalizedRole)) {
      return NextResponse.json(
        {
          success: false,
          message: "Role tidak valid",
        },
        { status: 400 }
      );
    }

    if (actor.role === "HR" && normalizedRole === "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "HR tidak dapat membuat user dengan role ADMIN",
        },
        { status: 403 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Email sudah digunakan",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: normalizedRole,
        departmentId: departmentId
          ? Number(departmentId)
          : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
      },
    });

    await createAuditLog({
      userId: actor.id,
      action: "USER_CREATED",
      entity: "User",
      entityId: user.id,
      details: `role=${user.role}`,
    });

    return NextResponse.json(
      {
        success: true,
        message: "User berhasil dibuat",
        data: user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CREATE USER ERROR:", error);

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
        message: "Gagal membuat user",
      },
      { status: 500 }
    );
  }
}   