import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { FEATURE_BY_KEY } from "@/lib/features";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage({ searchParams }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const deniedFeature = FEATURE_BY_KEY[params?.accessDenied]?.label || "";

  return (
    <DashboardClient
      user={{ id: user.id, name: user.name, role: user.role }}
      deniedFeature={deniedFeature}
    />
  );
}
