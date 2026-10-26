import { connection } from "next/server";
import { requireFeature } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import UserToolbar from "./UserToolbar";

export default async function UsersPage() {
  await connection();

  let user;

  try {
    user = await requireFeature("users");
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      redirect("/login");
    }

    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      department: true,
    },
  });

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>User Management</h1>

          <p>
            Kelola pengguna dan hak akses sistem SmartOps.
          </p>
        </div>

        <div className="user-count">
          {users.length} User
        </div>
      </div>

      <UserToolbar users={users} />
    </main>
  );
}