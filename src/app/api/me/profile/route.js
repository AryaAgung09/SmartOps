import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const profileSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  employeeId: true,
  phone: true,
  address: true,
  dateOfBirth: true,
  gender: true,
  employmentStatus: true,
  joinDate: true,
  profilePhoto: true,
  department: { select: { id: true, name: true, code: true } },
  manager: { select: { id: true, name: true, email: true } },
};

export async function GET() {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    const profile = await prisma.user.findUnique({ where: { id: Number(actor.id) }, select: profileSelect });
    if (!profile) return NextResponse.json({ success: false, message: "Profile tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    console.error("GET MY PROFILE ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil profile" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const data = {};
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim().slice(0, 40) : null;
    if (body.address !== undefined) data.address = body.address ? String(body.address).trim().slice(0, 4000) : null;
    if (!Object.keys(data).length) return NextResponse.json({ success: false, message: "Tidak ada field yang dapat diubah" }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      const profile = await tx.user.update({ where: { id: Number(actor.id) }, data, select: profileSelect });
      await tx.auditLog.create({ data: { action: "SELF_PROFILE_UPDATED", entity: "User", entityId: Number(actor.id), userId: Number(actor.id), details: `fields=${Object.keys(data).join(",")}` } });
      return profile;
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("UPDATE MY PROFILE ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal memperbarui profile" }, { status: 500 });
  }
}
