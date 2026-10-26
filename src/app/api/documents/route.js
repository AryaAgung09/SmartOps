import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { getDocumentList } from "@/lib/documentQueries";
import {
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
  DOCUMENT_VISIBILITIES,
  MAX_DOCUMENT_SIZE,
  parseDateInput,
  safeFileName,
} from "@/lib/documents";

const categoryValues = DOCUMENT_CATEGORIES.map((item) => item.value);
const visibilityValues = DOCUMENT_VISIBILITIES.map((item) => item.value);

function authError(error) {
  if (error.message === "UNAUTHORIZED") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  if (error.message === "FORBIDDEN") {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }
  return null;
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export async function GET(request) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const result = await getDocumentList(actor, {
    search: cleanText(params.get("search"), 100),
    category: categoryValues.includes(params.get("category")) ? params.get("category") : "",
    status: params.get("status") || "",
    ownerId: Number(params.get("ownerId")) || null,
    page: Number(params.get("page")) || 1,
    limit: Number(params.get("limit")) || 20,
  });

  return NextResponse.json({ success: true, data: result, ...result });
}

export async function POST(request) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal mengunggah dokumen" }, { status: 500 });
  }

  const formData = await request.formData();
  const title = cleanText(formData.get("title"), 160);
  const category = String(formData.get("category") || "");
  const visibility = String(formData.get("visibility") || "HR_ONLY");
  const notes = cleanText(formData.get("notes"), 5000);
  const ownerValue = String(formData.get("ownerId") || "").trim();
  const ownerId = ownerValue ? Number(ownerValue) : null;
  const file = formData.get("file");

  const rawIssueDate = String(formData.get("issueDate") || "").trim();
  const rawExpiryDate = String(formData.get("expiryDate") || "").trim();
  const issueDate = rawIssueDate ? parseDateInput(rawIssueDate) : null;
  const expiryDate = rawExpiryDate ? parseDateInput(rawExpiryDate) : null;

  if (title.length < 2) {
    return NextResponse.json({ success: false, message: "Judul dokumen minimal 2 karakter" }, { status: 400 });
  }
  if (!categoryValues.includes(category)) {
    return NextResponse.json({ success: false, message: "Kategori dokumen tidak valid" }, { status: 400 });
  }
  if (!visibilityValues.includes(visibility)) {
    return NextResponse.json({ success: false, message: "Visibilitas dokumen tidak valid" }, { status: 400 });
  }
  if (rawIssueDate && !issueDate) {
    return NextResponse.json({ success: false, message: "Tanggal terbit tidak valid" }, { status: 400 });
  }
  if (rawExpiryDate && !expiryDate) {
    return NextResponse.json({ success: false, message: "Tanggal kedaluwarsa tidak valid" }, { status: 400 });
  }
  if (issueDate && expiryDate && expiryDate < issueDate) {
    return NextResponse.json({ success: false, message: "Tanggal kedaluwarsa harus setelah tanggal terbit" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: "File dokumen wajib diunggah" }, { status: 400 });
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    return NextResponse.json({ success: false, message: "Ukuran file maksimal 10 MB" }, { status: 400 });
  }
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return NextResponse.json({ success: false, message: "Format file tidak didukung" }, { status: 400 });
  }

  if (ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } });
    if (!owner) {
      return NextResponse.json({ success: false, message: "Karyawan tidak ditemukan" }, { status: 400 });
    }
  }

  const storageDir = path.join(process.cwd(), "storage", "documents");
  const storedName = `${Date.now()}-${randomUUID()}-${safeFileName(file.name)}`;
  const storedPath = path.join(storageDir, storedName);

  try {
    await mkdir(storageDir, { recursive: true });
    await writeFile(storedPath, Buffer.from(await file.arrayBuffer()));

    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.employeeDocument.create({
        data: {
          title,
          category,
          ownerId,
          uploadedById: actor.id,
          fileName: safeFileName(file.name),
          filePath: storedName,
          mimeType: file.type,
          fileSize: file.size,
          issueDate,
          expiryDate,
          visibility,
          notes: notes || null,
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          uploadedBy: { select: { id: true, name: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "DOCUMENT_UPLOADED",
          entity: "EmployeeDocument",
          entityId: created.id,
          userId: actor.id,
          details: `title=${title}, category=${category}`,
        },
      });

      if (ownerId && visibility === "EMPLOYEE") {
        await tx.notification.create({
          data: {
            userId: ownerId,
            title: "Dokumen baru tersedia",
            message: `Dokumen "${title}" telah diunggah dan dapat Anda lihat.`,
          },
        });
      }

      return created;
    });

    return NextResponse.json({ success: true, data: document }, { status: 201 });
  } catch (error) {
    await unlink(storedPath).catch(() => {});
    return NextResponse.json({ success: false, message: "Gagal mengunggah dokumen" }, { status: 500 });
  }
}
