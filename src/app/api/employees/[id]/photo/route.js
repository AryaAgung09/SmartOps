import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  deleteStoredProfilePhoto,
  isRemoteProfilePhoto,
  newProfilePhotoName,
  PROFILE_PHOTO_DIR,
  profilePhotoExtension,
  profilePhotoMime,
  profilePhotoValidationError,
} from "@/lib/profilePhoto";

function roleError(error) {
  if (error.message === "UNAUTHORIZED") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
}

async function findEmployee(id) {
  const employeeId = Number(id);
  if (Number.isNaN(employeeId)) return null;
  return prisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, role: true, profilePhoto: true },
  });
}

function canManageEmployee(actor, employee) {
  if (!employee) return false;
  if (actor.role === "HR" && employee.role === "ADMIN") return false;
  return true;
}

export async function GET(request, { params }) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return roleError(error);
  }

  const { id } = await params;
  const employee = await findEmployee(id);
  if (!employee) {
    return NextResponse.json({ success: false, message: "Employee tidak ditemukan" }, { status: 404 });
  }

  if (!employee.profilePhoto) {
    return NextResponse.json({ success: false, message: "Foto profile tidak ditemukan" }, { status: 404 });
  }

  if (isRemoteProfilePhoto(employee.profilePhoto)) {
    return NextResponse.redirect(employee.profilePhoto);
  }

  const storedName = path.basename(employee.profilePhoto);

  try {
    const fileBuffer = await readFile(path.join(PROFILE_PHOTO_DIR, storedName));
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": profilePhotoMime(storedName),
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "Foto profile tidak ditemukan" }, { status: 404 });
  }
}

export async function POST(request, { params }) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return roleError(error);
  }

  const { id } = await params;
  const employee = await findEmployee(id);
  if (!employee) {
    return NextResponse.json({ success: false, message: "Employee tidak ditemukan" }, { status: 404 });
  }
  if (!canManageEmployee(actor, employee)) {
    return NextResponse.json({ success: false, message: "HR tidak dapat mengubah foto user ADMIN" }, { status: 403 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, message: "Data upload tidak valid" }, { status: 400 });
  }

  const file = formData.get("file");
  const validationError = profilePhotoValidationError(file);
  if (validationError) {
    return NextResponse.json({ success: false, message: validationError }, { status: 400 });
  }

  const extension = profilePhotoExtension(file.type);
  const storedName = newProfilePhotoName(employee.id, extension);
  const storedPath = path.join(PROFILE_PHOTO_DIR, storedName);

  try {
    await mkdir(PROFILE_PHOTO_DIR, { recursive: true });
    await writeFile(storedPath, Buffer.from(await file.arrayBuffer()));

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: employee.id },
        data: { profilePhoto: storedName },
        select: { profilePhoto: true },
      });

      await tx.auditLog.create({
        data: {
          action: "EMPLOYEE_PROFILE_PHOTO_UPDATED",
          entity: "User",
          entityId: employee.id,
          userId: Number(actor.id),
          details: `file=${storedName}`,
        },
      });

      return user;
    });

    if (employee.profilePhoto && employee.profilePhoto !== storedName) {
      await deleteStoredProfilePhoto(employee.profilePhoto);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    await deleteStoredProfilePhoto(storedName);
    console.error("UPLOAD EMPLOYEE PHOTO ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengunggah foto employee" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return roleError(error);
  }

  const { id } = await params;
  const employee = await findEmployee(id);
  if (!employee) {
    return NextResponse.json({ success: false, message: "Employee tidak ditemukan" }, { status: 404 });
  }
  if (!canManageEmployee(actor, employee)) {
    return NextResponse.json({ success: false, message: "HR tidak dapat mengubah foto user ADMIN" }, { status: 403 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: employee.id }, data: { profilePhoto: null } });
      await tx.auditLog.create({
        data: {
          action: "EMPLOYEE_PROFILE_PHOTO_REMOVED",
          entity: "User",
          entityId: employee.id,
          userId: Number(actor.id),
        },
      });
    });

    await deleteStoredProfilePhoto(employee.profilePhoto);
    return NextResponse.json({ success: true, data: { profilePhoto: null } });
  } catch (error) {
    console.error("REMOVE EMPLOYEE PHOTO ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal menghapus foto employee" }, { status: 500 });
  }
}
