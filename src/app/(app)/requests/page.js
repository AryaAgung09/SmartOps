import { connection } from "next/server";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";

import RequestList from "./RequestList";
import RequestFilters from "./RequestFilters";

export default async function RequestsPage({
  searchParams,
}) {
  await connection();

  let user;

  try {
    user = await requireRole(ROLES);
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      redirect("/login");
    }

    redirect("/dashboard");
  }

  const params = await searchParams;

  const status = params?.status || "";
  const type = params?.type || "";
  const search = params?.search || "";

  const where = {};

  if (status) {
    where.status = status;
  }

  if (type) {
    where.type = type;
  }

  if (search) {
    where.title = {
      contains: search,
    };
  }

  if (user.role === "STAFF") {
    where.userId = Number(user.id);
  }

  const requests =
    await prisma.request.findMany({
      where,

      orderBy: {
        createdAt: "desc",
      },

      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        department: {
          select: {
            id: true,
            name: true,
          },
        },

        approvals: {
          where: {
            status: "PENDING",
          },
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: {
            stepOrder: "asc",
          },
        },
      },
    });

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Request Management</h1>

          <p>
            Kelola dan pantau seluruh request
            SmartOps.
          </p>
        </div>
      </div>

      <RequestFilters />

      <RequestList
        requests={requests}
        userRole={user.role}
      />
    </main>
  );
}