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

export async function GET() {
  const actor = await requireRole().catch(() => null);
  if (!actor) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(actor.id) },
    select: { profilePhoto: true },
  });

  if (!user?.profilePhoto) {
    return NextResponse.json({ success: false, message: "Foto profile tidak ditemukan" }, { status: 404 });
  }

  if (isRemoteProfilePhoto(user.profilePhoto)) {
    return NextResponse.redirect(user.profilePhoto);
  }

  const storedName = path.basename(user.profilePhoto);

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

export async function POST(request) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    const status = error.message === "UNAUTHORIZED" ? 401 : 403;
    const message = error.message === "UNAUTHORIZED" ? "Unauthorized" : "Hanya HR dan Admin yang dapat mengganti foto profile";
    return NextResponse.json({ success: false, message }, { status });
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
  const storedName = newProfilePhotoName(actor.id, extension);
  const storedPath = path.join(PROFILE_PHOTO_DIR, storedName);

  try {
    await mkdir(PROFILE_PHOTO_DIR, { recursive: true });
    await writeFile(storedPath, Buffer.from(await file.arrayBuffer()));

    const previous = await prisma.user.findUnique({
      where: { id: Number(actor.id) },
      select: { profilePhoto: true },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: Number(actor.id) },
        data: { profilePhoto: storedName },
        select: { profilePhoto: true },
      });

      await tx.auditLog.create({
        data: {
          action: "PROFILE_PHOTO_UPDATED",
          entity: "User",
          entityId: Number(actor.id),
          userId: Number(actor.id),
          details: `file=${storedName}`,
        },
      });

      return user;
    });

    if (previous?.profilePhoto && previous.profilePhoto !== storedName) {
      await deleteStoredProfilePhoto(previous.profilePhoto);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    await deleteStoredProfilePhoto(storedName);
    console.error("UPLOAD PROFILE PHOTO ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengunggah foto profile" }, { status: 500 });
  }
}
