import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/auditLog";
import { requireRole } from "@/lib/auth";
import {
  getFeatureAccessMatrix,
  saveFeatureAccessMatrix,
} from "@/lib/featureAccess";

function errorResponse(error, fallbackMessage) {
  console.error("ACCESS CONTROL ERROR:", error);

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

export async function GET() {
  try {
    await requireRole(["ADMIN"]);

    const matrix = await getFeatureAccessMatrix();

    return NextResponse.json({
      success: true,
      data: matrix,
    });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil pengaturan akses fitur");
  }
}

export async function PUT(request) {
  try {
    const actor = await requireRole(["ADMIN"]);

    const body = await request.json();
    const permissions = body?.permissions;

    if (!permissions || typeof permissions !== "object") {
      return NextResponse.json(
        { success: false, message: "Data permission tidak valid" },
        { status: 400 }
      );
    }

    const matrix = await saveFeatureAccessMatrix(permissions);

    await createAuditLog({
      userId: actor.id,
      action: "UPDATE_FEATURE_ACCESS",
      entity: "RoleFeatureAccess",
      details: "Mengubah akses fitur per role",
    });

    return NextResponse.json({
      success: true,
      message: "Akses fitur berhasil disimpan",
      data: matrix,
    });
  } catch (error) {
    return errorResponse(error, "Gagal menyimpan pengaturan akses fitur");
  }
}
