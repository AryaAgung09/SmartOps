"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NotificationItem({
  notification,
}) {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  async function markAsRead() {
    if (notification.isRead) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/notifications/${notification.id}`,
        {
          method: "PATCH",
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            "Gagal menandai notification"
        );
      }

      router.refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new Event("notifications:changed")
        );
      }
    } catch (error) {
      window.alert(
        error.message ||
          "Terjadi kesalahan"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`notification-card ${
        notification.isRead
          ? "notification-read"
          : "notification-unread"
      }`}
      onClick={markAsRead}
      style={{
        cursor: notification.isRead
          ? "default"
          : "pointer",
      }}
    >
      <div className="notification-content">
        <div className="notification-header">
          <h3>
            {notification.title}
          </h3>

          {!notification.isRead && (
            <span className="notification-badge">
              {loading
                ? "Memproses..."
                : "Baru"}
            </span>
          )}
        </div>

        <p>
          {notification.message}
        </p>

        <small>
          {new Date(
            notification.createdAt
          ).toLocaleString("id-ID")}
        </small>
      </div>
    </div>
  );
}
