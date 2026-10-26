import { redirect } from "next/navigation";

export default function LegacyNewUserPage() {
  redirect("/users/create");
}
