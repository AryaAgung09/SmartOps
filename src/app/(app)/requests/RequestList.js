"use client";

import { useRouter } from "next/navigation";

import { getCurrentApproval } from "@/lib/requestApproval";
import { requestTypeLabel } from "@/lib/requestTypes";
import { roleLabel } from "@/lib/roles";

export default function RequestList({
  requests,
  userRole,
}) {
  const router = useRouter();

  return (
    <>
      <div className="user-toolbar">
        <div>
          <strong>Daftar Request</strong>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push("/requests/create")
          }
        >
          + Ajukan Request
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <h3>Belum ada request</h3>

          <p>
            Belum ada pengajuan request yang tersedia.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push("/requests/create")
            }
          >
            Ajukan Request
          </button>
        </div>
      ) : (
        <div className="user-table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Judul</th>
                <th>Pengaju</th>
                <th>Tipe</th>
                <th>Department</th>
                <th>Status</th>
                <th>Tahap Approval</th>
                <th>Tanggal</th>
                <th>Aksi</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((item) => {
                const currentApproval =
                  getCurrentApproval(item.approvals);

                return (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>

                    {item.description && (
                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "12px",
                          color: "#6b7280",
                        }}
                      >
                        {item.description}
                      </div>
                    )}
                  </td>

                  <td>
                    {item.user?.name ?? "-"}
                  </td>

                  <td>
                    {requestTypeLabel(item.type)}
                  </td>

                  <td>
                    {item.department?.name ?? "-"}
                  </td>

                  <td>
                    <span
                      className={`request-status status-${item.status.toLowerCase()}`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td>
                    {item.status === "PENDING" &&
                    currentApproval
                      ? `${currentApproval.stepLabel || `Tahap ${currentApproval.stepOrder}`} - ${currentApproval.approver?.name || roleLabel(currentApproval.approverRole)}`
                      : "-"}
                  </td>

                  <td>
                    {new Date(
                      item.createdAt
                    ).toLocaleDateString("id-ID")}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="detail-button"
                      onClick={() =>
                        router.push(
                          `/requests/${item.id}`
                        )
                      }
                    >
                      Lihat Detail
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}