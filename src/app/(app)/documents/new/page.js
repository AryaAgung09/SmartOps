import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/auth";
import DocumentForm from "../DocumentForm";

export const instant = false;

export default async function NewDocumentPage() {
  try {
    await requireFeature("documents-upload");
  } catch (error) {
    if (error.message === "UNAUTHORIZED") redirect("/login");
    redirect("/documents");
  }

  const employees = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="doc-page">
      <div className="doc-dashboard">
        <header className="doc-page-head">
          <div>
            <span className="doc-eyebrow">Document Control</span>
            <h1>Upload Dokumen</h1>
            <p>Tambahkan dokumen baru ke arsip HR dan atur masa berlakunya.</p>
          </div>
          <Link href="/documents" className="doc-secondary-btn">
            ← Kembali ke Document Center
          </Link>
        </header>

        <section className="doc-form-card">
          <DocumentForm mode="create" employees={employees} />
        </section>
      </div>
    </main>
  );
}
