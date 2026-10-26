import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { ROLES } from "@/lib/roles";

const MANAGED_ROLES = ROLES;

export async function GET(request, { params }) {
  try {
    await requireRole(["ADMIN", "HR"]);

    const { id } = await params;
    const userId = Number(id);

    if (Number.isNaN(userId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID user tidak valid",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        createdAt: true,
        department: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak ditemukan",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("GET USER ERROR");

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

export async function PUT(request, { params }) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);

    const { id } = await params;
    const userId = Number(id);

    if (Number.isNaN(userId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID user tidak valid",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const name = String(body.name ?? "").trim();
    let email = String(body.email ?? "").trim().toLowerCase();
    let role = String(body.role ?? "").trim().toUpperCase();
    const departmentId =
      body.departmentId === "" ||
      body.departmentId === null ||
      body.departmentId === undefined
        ? null
        : Number(body.departmentId);

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama wajib diisi",
        },
        { status: 400 }
      );
    }

    if (departmentId !== null && Number.isNaN(departmentId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Department tidak valid",
        },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (actor.role === "ADMIN") {
      if (!role) {
        return NextResponse.json(
          {
            success: false,
            message: "Role wajib diisi",
          },
          { status: 400 }
        );
      }

      if (!MANAGED_ROLES.includes(role)) {
        return NextResponse.json(
          {
            success: false,
            message: "Role tidak valid",
          },
          { status: 400 }
        );
      }
    } else {
      if (targetUser.role === "ADMIN") {
        return NextResponse.json(
          {
            success: false,
            message: "HR tidak dapat mengubah user ADMIN",
          },
          { status: 403 }
        );
      }

      if (role && role !== targetUser.role) {
        return NextResponse.json(
          {
            success: false,
            message: "Hanya Admin yang dapat mengubah role user",
          },
          { status: 403 }
        );
      }

      if (email && email !== (targetUser.email || "")) {
        return NextResponse.json(
          {
            success: false,
            message: "Hanya Admin yang dapat mengubah email akun",
          },
          { status: 403 }
        );
      }

      email = targetUser.email || "";
      role = targetUser.role;
    }

    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: {
            id: userId,
          },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          {
            success: false,
            message: "Email sudah digunakan user lain",
          },
          { status: 409 }
        );
      }
    }

    const oldRole = targetUser.role;
    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name,
        email: email || null,
        role,
        departmentId,
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

    if (oldRole !== user.role) {
      await createAuditLog({
        userId: actor.id,
        action: "USER_ROLE_CHANGED",
        entity: "User",
        entityId: userId,
        details: `${oldRole}->${user.role}`,
      });
    }

    await createAuditLog({
      userId: actor.id,
      action: "USER_UPDATED",
      entity: "User",
      entityId: userId,
      details: `role=${user.role}`,
    });

    return NextResponse.json({
      success: true,
      message: "User berhasil diperbarui",
      data: user,
    });
  } catch (error) {
    console.error("UPDATE USER ERROR");

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
        message: "Gagal memperbarui user",
      },
      { status: 500 }
    );
    
  }
  
}
export async function DELETE(request, { params }) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);

    const { id } = await params;
    const userId = Number(id);

    if (Number.isNaN(userId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID user tidak valid",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (actor.role === "HR" && user.role === "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "HR tidak dapat menghapus user ADMIN",
        },
        { status: 403 }
      );
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.delete({
          where: {
            id: userId,
          },
        });
        await tx.auditLog.create({
          data: {
            action: "USER_DELETED",
            entity: "User",
            entityId: userId,
            userId: Number(actor.id),
          },
        });
      });
    } catch (deleteError) {
      console.error("DELETE USER ERROR");

      if (deleteError.code === "P2003" || deleteError.message?.includes("Foreign key")) {
        return NextResponse.json(
          {
            success: false,
            message: "User tidak dapat dihapus karena masih memiliki data terkait",
          },
          { status: 400 }
        );
      }

      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: "User berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE USER ERROR");

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
        message: "Gagal menghapus user",
      },
      { status: 500 }
    );
  }
}
