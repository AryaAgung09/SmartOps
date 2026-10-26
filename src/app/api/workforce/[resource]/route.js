import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";

const models = { schedules: "workSchedule", shifts: "shift", holidays: "holiday" };

function getModel(resource) {
  return models[resource] || null;
}

function payloadFor(resource, body) {
  if (resource === "holidays") {
    const date = new Date(`${body.date}T00:00:00+07:00`);
    if (!body.name || Number.isNaN(date.getTime())) return null;
    return { date, name: String(body.name).trim(), description: body.description ? String(body.description).trim() : null, isActive: body.isActive !== false };
  }
  if (!body.name || !/^\d{1,2}:\d{2}$/.test(String(body.startTime)) || !/^\d{1,2}:\d{2}$/.test(String(body.endTime))) return null;
  const payload = {
    name: String(body.name).trim(),
    startTime: String(body.startTime),
    endTime: String(body.endTime),
    breakMinutes: Math.max(Number(body.breakMinutes ?? 60), 0),
    gracePeriodMinutes: Math.max(Number(body.gracePeriodMinutes ?? 15), 0),
    isActive: body.isActive !== false,
  };
  if (resource === "schedules") payload.workingDays = String(body.workingDays || "1,2,3,4,5");
  return payload;
}

function handleAuthError(error) {
  if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET(request, { params }) {
  try {
    const { resource } = await params;
    const model = getModel(resource);
    if (!model) return NextResponse.json({ success: false, message: "Resource tidak valid" }, { status: 404 });
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    const isAdmin = actor.role === "ADMIN" || actor.role === "HR";
    if (resource === "holidays") {
      const data = await prisma[model].findMany({ where: { isActive: true }, orderBy: { date: "asc" } });
      return NextResponse.json({ success: true, data });
    }
    if (isAdmin) {
      const data = await prisma[model].findMany({ orderBy: { name: "asc" } });
      return NextResponse.json({ success: true, data });
    }
    const user = await prisma.user.findUnique({ where: { id: Number(actor.id) }, select: { workSchedule: true, shift: true } });
    return NextResponse.json({ success: true, data: user?.[model] ? [user[model]] : [] });
  } catch (error) {
    return handleAuthError(error) || NextResponse.json({ success: false, message: "Gagal mengambil workforce configuration" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { resource } = await params;
    const model = getModel(resource);
    if (!model) return NextResponse.json({ success: false, message: "Resource tidak valid" }, { status: 404 });
    const actor = await requireRole(["ADMIN", "HR"]);
    const body = await request.json();
    const data = payloadFor(resource, body);
    if (!data) return NextResponse.json({ success: false, message: "Data tidak valid" }, { status: 400 });
    const created = await prisma.$transaction(async (tx) => {
      const item = await tx[model].create({ data });
      await tx.auditLog.create({ data: { action: "WORKFORCE_CONFIGURATION_CREATED", entity: resource, entityId: item.id, userId: Number(actor.id), details: `name=${data.name}` } });
      return item;
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return handleAuthError(error) || (error.code === "P2002" ? NextResponse.json({ success: false, message: "Data sudah ada" }, { status: 409 }) : NextResponse.json({ success: false, message: "Gagal membuat workforce configuration" }, { status: 500 }));
  }
}

export async function PATCH(request, { params }) {
  try {
    const { resource } = await params;
    const model = getModel(resource);
    if (!model) return NextResponse.json({ success: false, message: "Resource tidak valid" }, { status: 404 });
    const actor = await requireRole(["ADMIN", "HR"]);
    const body = await request.json();
    const id = Number(body.id);
    const data = payloadFor(resource, body);
    if (Number.isNaN(id) || !data) return NextResponse.json({ success: false, message: "Data tidak valid" }, { status: 400 });
    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx[model].update({ where: { id }, data });
      await tx.auditLog.create({ data: { action: "WORKFORCE_CONFIGURATION_UPDATED", entity: resource, entityId: id, userId: Number(actor.id) } });
      return item;
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleAuthError(error) || (error.code === "P2025" ? NextResponse.json({ success: false, message: "Data tidak ditemukan" }, { status: 404 }) : NextResponse.json({ success: false, message: "Gagal mengubah workforce configuration" }, { status: 500 }));
  }
}

export async function DELETE(request, { params }) {
  try {
    const { resource } = await params;
    const model = getModel(resource);
    if (!model) return NextResponse.json({ success: false, message: "Resource tidak valid" }, { status: 404 });
    const actor = await requireRole(["ADMIN", "HR"]);
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (Number.isNaN(id)) return NextResponse.json({ success: false, message: "ID tidak valid" }, { status: 400 });
    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx[model].update({ where: { id }, data: { isActive: false } });
      await tx.auditLog.create({ data: { action: "WORKFORCE_CONFIGURATION_DEACTIVATED", entity: resource, entityId: id, userId: Number(actor.id) } });
      return item;
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleAuthError(error) || (error.code === "P2025" ? NextResponse.json({ success: false, message: "Data tidak ditemukan" }, { status: 404 }) : NextResponse.json({ success: false, message: "Gagal menonaktifkan workforce configuration" }, { status: 500 }));
  }
}
