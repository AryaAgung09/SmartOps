import ExcelJS from "exceljs";
import { connection } from "next/server";
import { requireRole } from "@/lib/auth";
import { HR_ASSIGNABLE_ROLES, ROLES, ROLE_LABELS } from "@/lib/roles";

const HEADERS = [
  { header: "Nama Lengkap *", key: "name", width: 26 },
  { header: "Email", key: "email", width: 30 },
  { header: "Password", key: "password", width: 18 },
  { header: "Role", key: "role", width: 14 },
  { header: "Employee ID", key: "employeeId", width: 16 },
  { header: "No. Telepon", key: "phone", width: 18 },
  { header: "Alamat", key: "address", width: 32 },
  { header: "Gender", key: "gender", width: 12 },
  { header: "Status Kepegawaian", key: "employmentStatus", width: 18 },
  { header: "Tanggal Join", key: "joinDate", width: 15 },
  { header: "Tanggal Lahir", key: "dateOfBirth", width: 15 },
  { header: "Tipe Kontrak *", key: "contractType", width: 18 },
  { header: "Mulai Kontrak", key: "contractStartDate", width: 15 },
  { header: "Berakhir Kontrak", key: "contractEndDate", width: 16 },
  { header: "Department", key: "department", width: 20 },
  { header: "Manager Email", key: "managerEmail", width: 28 },
];

function styleHeaderRow(row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
}

function addListValidation(worksheet, column, values) {
  for (let row = 2; row <= 501; row += 1) {
    worksheet.getCell(`${column}${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${values.join(",")}"`],
    };
  }
}

export async function GET() {
  await connection();

  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const canManageAccount = actor.role === "ADMIN";

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SmartOps";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Employees");
    worksheet.columns = HEADERS.map((column) => {
      if (canManageAccount || !["email", "password"].includes(column.key)) return column;
      return { ...column, header: column.header.replace(" *", "") };
    });
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    styleHeaderRow(worksheet.getRow(1));

    const exampleRow = worksheet.addRow({
      name: "Budi Santoso",
      ...(canManageAccount
        ? { email: "budi.santoso@smartops.com", password: "TempPass123!" }
        : {}),
      role: "STAFF",
      employeeId: "EMP-1001",
      phone: "+62 812 3456 7890",
      address: "Jakarta",
      gender: "MALE",
      employmentStatus: "ACTIVE",
      joinDate: "2026-11-01",
      dateOfBirth: "1995-05-12",
      contractType: "FIXED_TERM",
      contractStartDate: "2026-11-01",
      contractEndDate: "2027-10-31",
      department: "Human Resources",
      managerEmail: "hr@smartops.com",
    });
    exampleRow.font = { color: { argb: "FF64748B" }, italic: true };

    worksheet.getColumn("joinDate").numFmt = "yyyy-mm-dd";
    worksheet.getColumn("dateOfBirth").numFmt = "yyyy-mm-dd";
    worksheet.getColumn("contractStartDate").numFmt = "yyyy-mm-dd";
    worksheet.getColumn("contractEndDate").numFmt = "yyyy-mm-dd";

    addListValidation(worksheet, "D", canManageAccount ? ROLES : HR_ASSIGNABLE_ROLES);
    addListValidation(worksheet, "H", ["MALE", "FEMALE", "OTHER"]);
    addListValidation(worksheet, "I", ["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"]);
    addListValidation(worksheet, "L", [
      "PERMANENT",
      "FIXED_TERM",
      "PROBATION",
      "INTERNSHIP",
      "FREELANCE",
    ]);

    const guide = workbook.addWorksheet("Petunjuk");
    guide.columns = [{ width: 26 }, { width: 80 }];
    guide.addRow(["Kolom", "Keterangan"]);
    styleHeaderRow(guide.getRow(1));
    [
      ["Nama Lengkap", "Wajib diisi."],
      [
        "Email",
        canManageAccount
          ? "Opsional. Isi email dan password bersamaan untuk membuat akun login; kosongkan keduanya untuk karyawan tanpa akun website."
          : "Opsional. HR hanya menambahkan data karyawan tanpa akun login.",
      ],
      [
        "Password",
        canManageAccount
          ? "Opsional. Minimal 8 karakter dan wajib diisi jika email diisi."
          : "Opsional. Akun login hanya dibuat oleh Admin.",
      ],
      [
        "Role",
        `${(canManageAccount ? ROLES : HR_ASSIGNABLE_ROLES).map((role) => ROLE_LABELS[role]).join(", ")}. Default STAFF. Menentukan akses login dan perhitungan gaji otomatis.`,
      ],
      ["Employee ID", "Opsional, harus unik jika diisi."],
      ["Gender", "MALE, FEMALE, atau OTHER. Bisa juga L/P."],
      ["Status Kepegawaian", "ACTIVE, INACTIVE, ON_LEAVE, atau TERMINATED. Default ACTIVE."],
      ["Tanggal", "Format YYYY-MM-DD atau DD/MM/YYYY."],
      ["Tipe Kontrak", "Wajib: PERMANENT, FIXED_TERM, PROBATION, INTERNSHIP, atau FREELANCE."],
      ["Department", "Nama department yang sudah terdaftar. Opsional."],
      ["Manager Email", "Email manager yang sudah terdaftar. Opsional."],
      ["Gaji", "Tidak perlu diisi. Gaji pokok dihitung otomatis dari role dan tipe kontrak."],
      ["Baris contoh", "Hapus baris contoh sebelum mengunggah file."],
    ].forEach((row) => guide.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="smartops-employee-import-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return Response.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    console.error("EMPLOYEE TEMPLATE ERROR:", error?.message || error);
    return Response.json({ success: false, message: "Gagal membuat template Excel" }, { status: 500 });
  }
}
