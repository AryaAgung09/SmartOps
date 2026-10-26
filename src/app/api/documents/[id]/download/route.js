import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canViewDocument } from "@/lib/documents";

export async function GET(request, { params }) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const document = await prisma.employeeDocument.findUnique({
    where: { id: Number(id) },
  });

  if (!document) {
    return NextResponse.json({ success: false, message: "Dokumen tidak ditemukan" }, { status: 404 });
  }
  if (!canViewDocument(actor, document)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const fileBuffer = await readFile(
      path.join(process.cwd(), "storage", "documents", document.filePath)
    );
    const inline = request.nextUrl.searchParams.get("inline") === "1";
    const disposition = inline ? "inline" : "attachment";

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Length": String(fileBuffer.length),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: "File dokumen tidak ditemukan" }, { status: 404 });
  }
}
