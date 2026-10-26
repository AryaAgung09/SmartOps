import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getInvoiceList } from "@/lib/financeQueries";
import { INVOICE_STATUSES, cleanText, parseDateInput } from "@/lib/finance";
import { authError, parseAmount, toId, writeAudit } from "@/lib/financeService";

const statusValues = INVOICE_STATUSES.map((item) => item.value);

export async function GET(request) {
  try {
    await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal memuat invoice" }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const result = await getInvoiceList({
    search: cleanText(params.get("search"), 120),
    status: statusValues.includes(params.get("status")) ? params.get("status") : "",
    vendorId: toId(params.get("vendorId")),
    departmentId: toId(params.get("departmentId")),
    page: Number(params.get("page")) || 1,
    limit: Number(params.get("limit")) || 20,
  });

  return NextResponse.json({ success: true, data: result, ...result });
}

export async function POST(request) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "HR"]);
  } catch (error) {
    return authError(error) || NextResponse.json({ success: false, message: "Gagal membuat invoice" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const invoiceNumber = cleanText(body.invoiceNumber, 80);
  const vendorId = toId(body.vendorId);
  const departmentId = toId(body.departmentId);
  const issueDate = parseDateInput(body.issueDate);
  const dueDate = parseDateInput(body.dueDate);
  const amount = parseAmount(body.amount);
  const status = body.status === "SENT" ? "SENT" : "DRAFT";
  const notes = cleanText(body.notes, 5000);

  if (invoiceNumber.length < 2) {
    return NextResponse.json({ success: false, message: "Nomor invoice minimal 2 karakter" }, { status: 400 });
  }
  if (!vendorId) {
    return NextResponse.json({ success: false, message: "Vendor wajib dipilih" }, { status: 400 });
  }
  if (!issueDate || !dueDate) {
    return NextResponse.json({ success: false, message: "Tanggal invoice tidak valid" }, { status: 400 });
  }
  if (dueDate < issueDate) {
    return NextResponse.json({ success: false, message: "Jatuh tempo harus setelah tanggal invoice" }, { status: 400 });
  }
  if (!amount) {
    return NextResponse.json({ success: false, message: "Jumlah invoice harus lebih dari 0" }, { status: 400 });
  }

  const vendor = await prisma.financeVendor.findUnique({ where: { id: vendorId }, select: { id: true } });
  if (!vendor) {
    return NextResponse.json({ success: false, message: "Vendor tidak ditemukan" }, { status: 400 });
  }

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          vendorId,
          departmentId,
          issueDate,
          dueDate,
          amount,
          status,
          notes: notes || null,
          createdById: actor.id,
        },
        include: { vendor: { select: { id: true, name: true } } },
      });
      await writeAudit(
        tx,
        actor.id,
        "INVOICE_CREATED",
        "Invoice",
        created.id,
        `number=${invoiceNumber}, amount=${amount}, status=${status}`
      );
      return created;
    });

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json({ success: false, message: "Nomor invoice sudah digunakan" }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: "Gagal membuat invoice" }, { status: 500 });
  }
}
