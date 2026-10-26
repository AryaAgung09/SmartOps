import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateLeaveDays, getStartOfDayInTz, getAvailableDays } from "@/lib/leave";

export async function GET(request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const status = searchParams.get("status");
    const isAdmin = actor.role === "ADMIN" || actor.role === "HR";

    let where = {};
    if (!isAdmin) {
      where.userId = Number(actor.id);
    }
    if (status && ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
      where.status = status;
    }

    let page = 1;
    let limit = 20;
    if (pageParam !== null) {
      const p = Number(pageParam);
      if (!Number.isNaN(p) && p >= 1 && Number.isInteger(p)) page = p;
    }
    if (limitParam !== null) {
      const l = Number(limitParam);
      if (!Number.isNaN(l) && l >= 1 && Number.isInteger(l) && l <= 100) limit = l;
    }
    const skip = (page - 1) * limit;

    const [leaves, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true, managerId: true } }, leaveType: true, approvedBy: { select: { id: true, name: true } }, rejectedBy: { select: { id: true, name: true } } },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: leaves, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("GET LEAVES ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil data cuti" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const leaveTypeId = Number(body.leaveTypeId);
    const startDate = body.startDate;
    const endDate = body.endDate;
    const reason = body.reason ? String(body.reason).trim() : null;

    if (Number.isNaN(leaveTypeId) || !startDate || !endDate) {
      return NextResponse.json({ success: false, message: "Data tidak lengkap" }, { status: 400 });
    }

    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType || !leaveType.isActive) {
      return NextResponse.json({ success: false, message: "Jenis cuti tidak valid" }, { status: 400 });
    }

    const s = getStartOfDayInTz(new Date(startDate));
    const e = getStartOfDayInTz(new Date(endDate));
    if (s > e) {
      return NextResponse.json({ success: false, message: "Tanggal tidak valid" }, { status: 400 });
    }

    const totalDays = calculateLeaveDays(s, e);
    if (totalDays <= 0) {
      return NextResponse.json({ success: false, message: "Jumlah hari tidak valid" }, { status: 400 });
    }

    const year = s.getFullYear();

    const result = await prisma.$transaction(async (tx) => {
      const overlap = await tx.leaveRequest.findFirst({
        where: {
          userId: Number(actor.id),
          status: { in: ["PENDING", "APPROVED"] },
          startDate: { lte: e },
          endDate: { gte: s },
        },
      });
      if (overlap) {
        throw new Error("OVERLAP");
      }

      let balance = await tx.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: Number(actor.id), leaveTypeId, year } },
      });
      if (!balance) {
        balance = await tx.leaveBalance.create({
          data: { userId: Number(actor.id), leaveTypeId, year, allocatedDays: leaveType.defaultDays || 0, adjustmentDays: 0, usedDays: 0, pendingDays: 0 },
        });
      }

      const available = (balance.allocatedDays + balance.adjustmentDays) - balance.usedDays - balance.pendingDays;
      if (available < totalDays) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pendingDays: balance.pendingDays + totalDays },
      });

      const leave = await tx.leaveRequest.create({
        data: {
          userId: Number(actor.id),
          leaveTypeId,
          startDate: s,
          endDate: e,
          totalDays,
          reason,
          status: "PENDING",
        },
      });

      await tx.auditLog.create({
        data: { action: "LEAVE_REQUEST_CREATED", entity: "LeaveRequest", entityId: leave.id, userId: Number(actor.id), details: `days=${totalDays}` },
      });

      return leave;
    });

    try {
      const approvers = await prisma.user.findMany({ where: { role: { in: ["HR", "ADMIN"] } }, select: { id: true } });
      for (const a of approvers) {
        await prisma.notification.create({
          data: { userId: a.id, title: "Pengajuan Cuti", message: `Ada pengajuan cuti baru menunggu persetujuan.` },
        });
      }
    } catch (e) {}

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    if (error.message === "OVERLAP") return NextResponse.json({ success: false, message: "Terdapat cuti yang bertabrakan pada periode tersebut" }, { status: 409 });
    if (error.message === "INSUFFICIENT_BALANCE") return NextResponse.json({ success: false, message: "Saldo cuti tidak mencukupi" }, { status: 400 });
    console.error("CREATE LEAVE ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengajukan cuti" }, { status: 500 });
  }
}
