import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";

import DeleteRequestButton from "./DeleteRequestButton";
import ApprovalActions from "./ApprovalActions";
import RequestDocumentPanel from "./RequestDocumentPanel";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canApproveCurrentStep,
  getCurrentApproval,
} from "@/lib/requestApproval";
import { requestTypeLabel } from "@/lib/requestTypes";
import { ROLES, roleLabel } from "@/lib/roles";

function approvalStatusLabel(status) {
  if (status === "APPROVED") return "Disetujui";
  if (status === "REJECTED") return "Ditolak";
  return "Menunggu";
}

export default async function RequestDetailPage({
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

  const request = await prisma.request.findFirst({
    where: {
      id: requestId,
      ...(user.role === "STAFF"
        ? { userId: Number(user.id) }
        : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      approvals: {
        include: {
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
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

  if (!request) {
    redirect("/requests");
  }

  const currentUserId = Number(user.id);
  const isOwner = Number(request.userId) === currentUserId;
  const hasActedApproval = request.approvals.some(
    (approval) => approval.status !== "PENDING"
  );
  const canEdit =
    request.status === "PENDING" &&
    !hasActedApproval &&
    (isOwner || user.role === "ADMIN" || user.role === "HR");
  const canDelete = canEdit;
  const currentApproval = getCurrentApproval(request.approvals);
  const canApprove = canApproveCurrentStep(
    user,
    request,
    request.approvals
  );
  const actedApprovals = request.approvals.filter(
    (approval) => approval.status !== "PENDING"
  );
  const canFulfillDocument =
    (user.role === "ADMIN" || user.role === "HR") &&
    request.type === "ADMINISTRATIVE" &&
    request.status === "APPROVED" &&
    Boolean(request.documentCategory);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Detail Request</h1>
          <p>Informasi lengkap pengajuan request.</p>
        </div>

        <div className="form-actions">
          <Link href="/requests" className="secondary-button">
            Kembali
          </Link>

          {canEdit && (
            <Link
              href={`/requests/${request.id}/edit`}
              className="primary-button"
            >
              Edit Request
            </Link>
          )}

          {canDelete && (
            <DeleteRequestButton requestId={request.id} />
          )}
        </div>
      </div>

      <div className="form-card">
        <div className="request-detail">
          <div className="detail-row">
            <span className="detail-label">Judul</span>
            <strong>{request.title}</strong>
          </div>

          <div className="detail-row">
            <span className="detail-label">Pengaju</span>
            <span>{request.user?.name ?? "-"}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Email</span>
            <span>{request.user?.email ?? "-"}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Role</span>
            <span>{roleLabel(request.user?.role)}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Tipe</span>
            <span>{requestTypeLabel(request.type)}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Department</span>
            <span>{request.department?.name ?? "-"}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Status</span>
            <span
              className={`request-status status-${request.status.toLowerCase()}`}
            >
              {request.status}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Dibuat</span>
            <span>
              {new Date(request.createdAt).toLocaleString("id-ID")}
            </span>
          </div>

          <div className="detail-row detail-description">
            <span className="detail-label">Deskripsi</span>
            <p>{request.description || "Tidak ada deskripsi."}</p>
          </div>
        </div>
      </div>

      {request.type === "ADMINISTRATIVE" && request.documentCategory && (
        <RequestDocumentPanel
          requestId={request.id}
          category={request.documentCategory}
          fileName={request.fulfilledFileName}
          fileSize={request.fulfilledFileSize}
          fulfilledAt={request.fulfilledAt}
          canUpload={canFulfillDocument}
        />
      )}

      {request.approvals.length > 0 && (
        <section className="dashboard-section">
          <div className="section-header">
            <div>
              <h2>Approval Workflow</h2>
              <p>Tahapan persetujuan untuk request ini.</p>
            </div>
          </div>

          <div className="approval-list">
            {request.approvals.map((approval) => {
              const isCurrent =
                currentApproval?.id === approval.id &&
                request.status === "PENDING";
              const stateClass =
                approval.status === "APPROVED"
                  ? "approval-completed"
                  : approval.status === "REJECTED"
                    ? "approval-rejected"
                    : isCurrent
                      ? "approval-current"
                      : "approval-waiting";

              return (
                <div
                  key={approval.id}
                  className={`approval-card ${stateClass}`}
                >
                  <div>
                    <strong>
                      Tahap {approval.stepOrder} -{" "}
                      {approval.stepLabel || "Approval"}
                    </strong>
                    <span>
                      {approval.approver?.name ||
                        `Role ${roleLabel(approval.approverRole)}`}{" "}
                      - {roleLabel(approval.approverRole)}
                    </span>
                  </div>

                  <div>
                    <span
                      className={`request-status approval-status-${approval.status.toLowerCase()}`}
                    >
                      {approvalStatusLabel(approval.status)}
                    </span>

                    {approval.comment && (
                      <p>{approval.comment}</p>
                    )}
                  </div>

                  <small>
                    {approval.actedAt
                      ? new Date(approval.actedAt).toLocaleString(
                          "id-ID"
                        )
                      : "-"}
                  </small>
                </div>
              );
            })}
          </div>

          {request.status === "PENDING" && currentApproval && (
            <p className="approval-next-info">
              Saat ini request menunggu approval dari{" "}
              <strong>
                {currentApproval.approver?.name ||
                  `role ${roleLabel(currentApproval.approverRole)}`}
              </strong>{" "}
              pada tahap{" "}
              <strong>
                {currentApproval.stepLabel ||
                  `Tahap ${currentApproval.stepOrder}`}
              </strong>
              .
            </p>
          )}

          {request.status === "APPROVED" && (
            <p className="approval-next-info">
              Semua tahap approval telah selesai.
            </p>
          )}

          {request.status === "REJECTED" && (
            <p className="approval-next-info">
              Request telah ditolak.
            </p>
          )}
        </section>
      )}

      {actedApprovals.length > 0 && (
        <section className="dashboard-section request-approval-section">
          <div className="section-header">
            <div>
              <h2>Riwayat Approval</h2>
              <p>Riwayat proses persetujuan request.</p>
            </div>
          </div>

          <div className="approval-list">
            {actedApprovals.map((approval) => (
              <div key={approval.id} className="approval-card">
                <div>
                  <strong>{approval.approver?.name ?? "-"}</strong>
                  <span>
                    {roleLabel(
                      approval.approverRole ||
                        approval.approver?.role
                    )}
                  </span>
                </div>

                <div>
                  <strong>{approvalStatusLabel(approval.status)}</strong>
                  {approval.comment && <p>{approval.comment}</p>}
                </div>

                <small>
                  {new Date(
                    approval.actedAt || approval.createdAt
                  ).toLocaleString("id-ID")}
                </small>
              </div>
            ))}
          </div>
        </section>
      )}

      {canApprove && currentApproval && (
        <section className="dashboard-section">
          <ApprovalActions
            requestId={request.id}
            requestType={requestTypeLabel(request.type)}
            stepLabel={
              currentApproval.stepLabel ||
              `Tahap ${currentApproval.stepOrder}`
            }
          />
        </section>
      )}
    </main>
  );
}


