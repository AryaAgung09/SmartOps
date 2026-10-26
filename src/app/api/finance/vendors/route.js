import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getVendorList } from "@/lib/financeQueries";
import { cleanText } from "@/lib/finance";
import { authError, writeAudit } from "@/lib/financeService";

export async function GET(request) {
  try {
    await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal memuat vendor" }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const result = await getVendorList({
    search: cleanText(params.get("search"), 120),
    includeInactive: params.get("includeInactive") === "1",
  });

  return NextResponse.json({ success: true, data: result, ...result });
}

export async function POST(request) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal menambah vendor" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 160);
  const phone = cleanText(body.phone, 40);
  const address = cleanText(body.address, 1000);
  const taxNumber = cleanText(body.taxNumber, 80);
  const notes = cleanText(body.notes, 2000);

  if (name.length < 2) {
    return NextResponse.json({ success: false, message: "Nama vendor minimal 2 karakter" }, { status: 400 });
  }

  try {
    const vendor = await prisma.$transaction(async (tx) => {
      const created = await tx.financeVendor.create({
        data: {
          name,
          email: email || null,
          phone: phone || null,
          address: address || null,
          taxNumber: taxNumber || null,
          notes: notes || null,
        },
      });
      await writeAudit(tx, actor.id, "VENDOR_CREATED", "FinanceVendor", created.id, `name=${name}`);
      return created;
    });

    return NextResponse.json({ success: true, data: vendor }, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json({ success: false, message: "Nama vendor sudah digunakan" }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: "Gagal menambah vendor" }, { status: 500 });
  }
}
