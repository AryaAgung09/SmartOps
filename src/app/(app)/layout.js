
import { connection } from "next/server";

import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { getCurrentUser } from "@/lib/auth";
import { getAllowedFeatureKeys } from "@/lib/featureAccess";
import { redirect } from "next/navigation";

export const instant = false;

export default async function AppLayout({ children }) {
  await connection();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const allowedFeatureKeys = await getAllowedFeatureKeys(user.role);

  return (
    <div className="app-layout">
      <Sidebar allowedFeatureKeys={allowedFeatureKeys} />
      <div className="main-area">
        <Navbar />
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}
