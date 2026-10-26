import { connection } from "next/server";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";

import EditRequestForm from "./EditRequestForm";

export default async function EditRequestPage({
  params,
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

  const { id } = await params;
  const requestId = Number(id);

  if (Number.isNaN(requestId)) {
    redirect("/requests");
  }

  const request =
    await prisma.request.findUnique({
      where: {
        id: requestId,
      },
      include: {
        department: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

  if (!request) {
    redirect("/requests");
  }

  if (
    request.userId !== Number(user.id) &&
    user.role !== "ADMIN" &&
    user.role !== "HR"
  ) {
    redirect("/requests");
  }

  if (request.status !== "PENDING") {
    redirect(`/requests/${request.id}`);
  }

  const approvalCount =
    await prisma.approval.count({
      where: {
        requestId,
      },
    });

  const actedApprovalCount =
    await prisma.approval.count({
      where: {
        requestId,
        status: {
          not: "PENDING",
        },
      },
    });

  if (actedApprovalCount > 0) {
    redirect(`/requests/${request.id}`);
  }

  const departments =
    await prisma.department.findMany({
      orderBy: {
        name: "asc",
      },
    });

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Edit Request</h1>

          <p>
            Perbarui informasi request sebelum
            diproses.
          </p>
        </div>
      </div>

      <EditRequestForm
        request={request}
        departments={departments}
        hasApproval={approvalCount > 0}
      />
    </main>
  );
}