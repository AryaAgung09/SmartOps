import { Suspense } from "react";
import EditUserForm from "./EditUserForm";

function EditUserFallback() {
  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <section className="doc-form-card user-edit-loading">
          <span className="user-edit-loader" aria-hidden="true" />
          <h1>Memuat user</h1>
          <p>Menyiapkan data akun dan hak akses.</p>
        </section>
      </div>
    </main>
  );
}

async function EditUserPageContent({ params }) {
  const { id } = await params;

  return <EditUserForm userId={id} />;
}

export default function EditUserPage({ params }) {
  return (
    <Suspense fallback={<EditUserFallback />}>
      <EditUserPageContent params={params} />
    </Suspense>
  );
}
