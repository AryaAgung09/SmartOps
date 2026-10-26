import { connection } from "next/server";
import { redirect } from "next/navigation";

import AccessControlForm from "./AccessControlForm";
import { requireRole } from "@/lib/auth";
import { getFeatureAccessMatrix } from "@/lib/featureAccess";

export const instant = false;

export default async function AccessControlPage() {
  await connection();

  try {
    await requireRole(["ADMIN"]);
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      redirect("/login");
    }

    redirect("/dashboard");
  }

  const matrix = await getFeatureAccessMatrix();

  return (
    <main className="access-page">
      <div className="page-header access-page-header">
        <div>
          <span className="access-eyebrow">Administration</span>
          <h1>Feature Access</h1>
          <p>
            Atur fitur mana saja yang dapat dibuka oleh setiap role. Perubahan
            berlaku untuk menu dan akses langsung melalui URL.
          </p>
        </div>
      </div>

      <AccessControlForm initialMatrix={matrix} />
    </main>
  );
}
