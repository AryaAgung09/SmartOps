import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/auth";
import FinanceNav from "./FinanceNav";

export const instant = false;

export default async function FinanceLayout({ children }) {
  try {
    await requireFeature("finance");
  } catch (error) {
    if (error.message === "UNAUTHORIZED") redirect("/login");
    redirect("/dashboard");
  }

  return (
    <div className="fin-module">
      <FinanceNav />
      {children}
    </div>
  );
}
