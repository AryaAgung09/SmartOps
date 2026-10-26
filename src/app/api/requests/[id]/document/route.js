import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_SIZE,
  safeFileName,
} from "@/lib/documents";
import { isHrRole } from "@/lib/roles";

const STORAGE_DIR = path.join(process.cwd(), "storage", "requests");

function parseRequestId(id) {
  const requestId = Number(id);
  return Number.isNaN(requestId) ? null : requestId;
}

export async function POST(request, { params }) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);

    const { id } = await params;
    const requestId = parseRequestId(id);

    if (requestId === null) {
      return NextResponse.json(
        { success: false, message: "ID request tidak valid" },
        { status: 400 }
      );
    }

    const existingRequest = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        userId: true,
        documentCategory: true,
        fulfilledFilePath: true,
      },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { success: false, message: "Request tidak ditemukan" },
        { status: 404 }
      );
    }

    if (existingRequest.type !== "ADMINISTRATIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Dokumen hanya dapat diunggah untuk request administrative",
        },
        { status: 400 }
      );
    }

    if (!existingRequest.documentCategory) {
      return NextResponse.json(
        {
          success: false,
          message: "Request belum memiliki kategori dokumen",
        },
        { status: 400 }
      );
    }

    if (existingRequest.status !== "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          message: "Dokumen dapat diunggah setelah request disetujui",
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "File dokumen wajib diunggah" },
        { status: 400 }
      );
    }

    if (file.size > MAX_DOCUMENT_SIZE) {
      return NextResponse.json(
        { success: false, message: "Ukuran file maksimal 10 MB" },
        { status: 400 }
      );
    }

    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: "Format file tidak didukung" },
        { status: 400 }
      );
    }

    const storedName = `${Date.now()}-${randomUUID()}-${safeFileName(file.name)}`;
    const storedPath = path.join(STORAGE_DIR, storedName);

    await mkdir(STORAGE_DIR, { recursive: true });
    await writeFile(storedPath, Buffer.from(await file.arrayBuffer()));

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const updated = await tx.request.update({
        where: { id: requestId },
        data: {
          fulfilledFileName: safeFileName(file.name),
          fulfilledFilePath: storedName,
          fulfilledMimeType: file.type,
          fulfilledFileSize: file.size,
          fulfilledAt: new Date(),
          fulfilledById: Number(actor.id),
        },
      });

      await tx.auditLog.create({
        data: {
          action: "REQUEST_DOCUMENT_UPLOADED",
          entity: "Request",
          entityId: requestId,
          userId: Number(actor.id),
          details: `fileName=${updated.fulfilledFileName}, size=${file.size}`,
        },
      });

      await tx.notification.create({
        data: {
          userId: existingRequest.userId,
          title: "Dokumen request tersedia",
          message: `Dokumen untuk request "${existingRequest.title}" telah diunggah dan dapat Anda unduh.`,
        },
      });

      return updated;
    });

    if (
      existingRequest.fulfilledFilePath &&
      existingRequest.fulfilledFilePath !== storedName
    ) {
      await unlink(
        path.join(STORAGE_DIR, existingRequest.fulfilledFilePath)
      ).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: "Dokumen request berhasil diunggah",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("UPLOAD REQUEST DOCUMENT ERROR:", error);

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
      { success: false, message: "Gagal mengunggah dokumen request" },
      { status: 500 }
    );
  }
}

export async function GET(request, { params }) {
  try {
    const actor = await getCurrentUser();

    if (!actor) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const requestId = parseRequestId(id);

    if (requestId === null) {
      return NextResponse.json(
        { success: false, message: "ID request tidak valid" },
        { status: 400 }
      );
    }

    const existingRequest = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        userId: true,
        fulfilledFileName: true,
        fulfilledFilePath: true,
        fulfilledMimeType: true,
      },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { success: false, message: "Request tidak ditemukan" },
        { status: 404 }
      );
    }

    const isOwner =
      Number(existingRequest.userId) === Number(actor.id);

    if (!isOwner && !isHrRole(actor.role)) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    if (!existingRequest.fulfilledFilePath) {
      return NextResponse.json(
        { success: false, message: "Dokumen belum tersedia" },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(
      path.join(STORAGE_DIR, existingRequest.fulfilledFilePath)
    );
    const inline = request.nextUrl.searchParams.get("inline") === "1";
    const disposition = inline ? "inline" : "attachment";

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type":
          existingRequest.fulfilledMimeType || "application/octet-stream",
        "Content-Length": String(fileBuffer.length),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(existingRequest.fulfilledFileName || "document")}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("DOWNLOAD REQUEST DOCUMENT ERROR:", error);

    if (error.code === "ENOENT") {
      return NextResponse.json(
        { success: false, message: "File dokumen tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Gagal mengunduh dokumen request" },
      { status: 500 }
    );
  }
}
