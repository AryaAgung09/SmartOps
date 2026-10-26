import { connection } from "next/server";
import { redirect } from "next/navigation";
import NotificationItem from "./NotificationItem";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";

export default async function NotificationsPage() {
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

  const notifications =
    await prisma.notification.findMany({
      where: {
        userId: Number(user.id),
      },

      orderBy: {
        createdAt: "desc",
      },

      select: {
        id: true,
        title: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    });

  return (
    <main className="notifications-page">
      <div className="page-header">
        <div>
          <h1>Notifications</h1>

          <p>
            Informasi dan pemberitahuan
            aktivitas SmartOps.
          </p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="notification-empty">
          <h3>No notifications yet</h3>
          <p>Notifikasi aktivitas SmartOps akan muncul di sini.</p>
        </div>
      ) : (
        <div className="notification-list">
         {notifications.map(
  (notification) => (
    <NotificationItem
      key={notification.id}
      notification={notification}
    />
  )
)}
        </div>
      )}
    </main>
  );
}
