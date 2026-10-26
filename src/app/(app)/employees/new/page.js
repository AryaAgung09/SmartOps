import { redirect } from "next/navigation";

export default function LegacyNewEmployeePage() {
  redirect("/employees/create");
}
