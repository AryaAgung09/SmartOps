import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/auth";
import { toDateInput } from "@/lib/documents";
import DocumentForm from "../../DocumentForm";

export const instant = false;

export default async function EditDocumentPage({ params }) {
  try {
    await requireFeature("documents-upload");
  } catch (error) {
    if (error.message === "UNAUTHORIZED") redirect("/login");
    redirect("/documents");
  }

  const { id } = await params;
  const document = await prisma.employeeDocument.findUnique({
    where: { id: Number(id) },
  });

  if (!document) redirect("/documents");

  const employees = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const initialDocument = {
    id: document.id,
    title: document.title,
    category: document.category,
    ownerId: document.ownerId,
    visibility: document.visibility,
    issueDate: toDateInput(document.issueDate),
    expiryDate: toDateInput(document.expiryDate),
    notes: document.notes || "",
    fileName: document.fileName,
    fileSize: document.fileSize,
  };

  return (
    <main className="doc-page">
      <div className="doc-dashboard">
        <header className="doc-page-head">
          <div>
            <span className="doc-eyebrow">Document Control</span>
            <h1>Edit Dokumen</h1>
            <p>Perbarui metadata dokumen tanpa mengubah file yang diunggah.</p>
          </div>
          <Link href={`/documents/${document.id}`} className="doc-secondary-btn">
            ← Kembali ke Detail
          </Link>
        </header>

        <section className="doc-form-card">
          <DocumentForm mode="edit" document={initialDocument} employees={employees} />
        </section>
      </div>
    </main>
  );
}
