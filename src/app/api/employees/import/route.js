import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { calculateEmployeeSalary } from "@/lib/employeeSalary";
import { HR_ASSIGNABLE_ROLES, ROLES } from "@/lib/roles";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 500;
const MANAGED_ROLES = ROLES;
const EMPLOYMENT_STATUSES = ["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"];

const CONTRACT_ALIASES = {
  PERMANENT: "PERMANENT",
  "KARYAWAN TETAP": "PERMANENT",
  TETAP: "PERMANENT",
  FIXED_TERM: "FIXED_TERM",
  "FIXED TERM": "FIXED_TERM",
  "KONTRAK (PKWT)": "FIXED_TERM",
  KONTRAK: "FIXED_TERM",
  PKWT: "FIXED_TERM",
  PROBATION: "PROBATION",
  PROBASI: "PROBATION",
  INTERNSHIP: "INTERNSHIP",
  INTERN: "INTERNSHIP",
  MAGANG: "INTERNSHIP",
  FREELANCE: "FREELANCE",
  FREELANCER: "FREELANCE",
};

const HEADER_ALIASES = {
  name: ["nama lengkap", "nama", "name"],
  email: ["email"],
  password: ["password", "kata sandi"],
  role: ["role"],
  employeeId: ["employee id", "employeeid", "nik"],
  phone: ["no telepon", "nomor telepon", "telepon", "phone", "no hp"],
  address: ["alamat", "address"],
  gender: ["gender", "jenis kelamin"],
  employmentStatus: ["status kepegawaian", "employment status", "status"],
  joinDate: ["tanggal join", "join date", "tanggal masuk"],
  dateOfBirth: ["tanggal lahir", "date of birth", "birth date"],
  contractType: ["tipe kontrak", "contract type", "tipe"],
  contractStartDate: ["mulai kontrak", "contract start", "tanggal mulai kontrak"],
  contractEndDate: ["berakhir kontrak", "contract end", "tanggal berakhir kontrak"],
  department: ["department", "departemen"],
  managerEmail: ["manager email", "email manager"],
};

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[*]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildHeaderMap(worksheet) {
  const map = {};
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const header = normalizeHeader(cell.text || cell.value);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (!map[key] && aliases.includes(header)) {
        map[key] = columnNumber;
      }
    }
  });
  return map;
}

function cellValue(cell) {
  const value = cell?.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if (value.text !== undefined) return value.text;
    if (value.result !== undefined) return value.result;
    if (Array.isArray(value.richText)) return value.richText.map((item) => item.text).join("");
  }
  return value;
}

function toText(cell) {
  const value = cellValue(cell);
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value ?? "").trim();
}

function normalizeDate(value) {
  if (value === null || value === undefined || value === "") {
    return { valid: true, value: null };
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { valid: false, value: null };
    return { valid: true, value: value.toISOString().slice(0, 10) };
  }

  if (typeof value === "number" && value > 0) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    if (Number.isNaN(date.getTime())) return { valid: false, value: null };
    return { valid: true, value: date.toISOString().slice(0, 10) };
  }

  const text = String(value).trim();
  if (!text) return { valid: true, value: null };

  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/);
  if (match) {
    const [, year, month, day] = match;
    return buildIsoDate(Number(year), Number(month), Number(day));
  }

  match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return buildIsoDate(Number(year), Number(month), Number(day));
  }

  return { valid: false, value: null };
}

function buildIsoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { valid: false, value: null };
  }
  return { valid: true, value: date.toISOString().slice(0, 10) };
}

function normalizeGender(value) {
  const token = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!token) return { valid: true, value: null };
  if (["MALE", "M", "L", "LAKI_LAKI", "PRIA"].includes(token)) return { valid: true, value: "MALE" };
  if (["FEMALE", "F", "P", "PEREMPUAN", "WANITA"].includes(token)) return { valid: true, value: "FEMALE" };
  if (["OTHER", "LAINNYA", "O"].includes(token)) return { valid: true, value: "OTHER" };
  return { valid: false, value: null };
}

function normalizeStatus(value) {
  const token = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!token) return { valid: true, value: "ACTIVE" };
  return { valid: EMPLOYMENT_STATUSES.includes(token), value: token };
}

function normalizeContractType(value) {
  const token = String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!token) return { valid: false, value: null };
  return { valid: Boolean(CONTRACT_ALIASES[token]), value: CONTRACT_ALIASES[token] || null };
}

function normalizeRole(value, actorRole) {
  const token = String(value || "").trim().toUpperCase();
  if (!token) return { valid: true, value: "STAFF" };
  if (!MANAGED_ROLES.includes(token)) return { valid: false, value: null };
  if (actorRole === "HR" && !HR_ASSIGNABLE_ROLES.includes(token)) return { valid: false, value: null };
  return { valid: true, value: token };
}

function buildLookup(items) {
  const map = new Map();
  for (const item of items) {
    if (item.name) map.set(String(item.name).trim().toLowerCase(), item);
    if (item.code) map.set(String(item.code).trim().toLowerCase(), item);
  }
  return map;
}

function isBlankRow(rowData) {
  return Object.values(rowData).every((value) => String(value ?? "").trim() === "");
}

export async function POST(request) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const canManageAccount = actor.role === "ADMIN";
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, message: "File Excel wajib dipilih" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, message: "Ukuran file maksimal 5 MB" }, { status: 400 });
    }
    if (!/\.xlsx$/i.test(file.name || "")) {
      return NextResponse.json({ success: false, message: "Format file harus .xlsx" }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()));
    } catch {
      return NextResponse.json({ success: false, message: "File Excel tidak dapat dibaca" }, { status: 400 });
    }

    const worksheet = workbook.getWorksheet("Employees") || workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ success: false, message: "Worksheet tidak ditemukan" }, { status: 400 });
    }

    const headerMap = buildHeaderMap(worksheet);
    const requiredHeaders = ["name", "contractType"];
    const missingHeaders = requiredHeaders.filter((key) => !headerMap[key]).map((key) => {
      if (key === "name") return "Nama Lengkap";
      if (key === "contractType") return "Tipe Kontrak";
      return key;
    });
    if (missingHeaders.length) {
      return NextResponse.json(
        { success: false, message: `Header tidak lengkap: ${missingHeaders.join(", ")}` },
        { status: 400 }
      );
    }

    const [existingUsers, departments] = await Promise.all([
      prisma.user.findMany({ select: { id: true, email: true, employeeId: true, role: true } }),
      prisma.department.findMany({ select: { id: true, name: true, code: true } }),
    ]);

    const departmentLookup = buildLookup(departments);
    const emailSet = new Set(existingUsers.filter((user) => user.email).map((user) => user.email.toLowerCase()));
    const employeeIdSet = new Set(existingUsers.filter((user) => user.employeeId).map((user) => user.employeeId.toLowerCase()));
    const managerLookup = new Map(
      existingUsers.filter((user) => user.email).map((user) => [user.email.toLowerCase(), user])
    );

    const imported = [];
    const errors = [];
    let processedRows = 0;

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const rowData = {};
      for (const [key, column] of Object.entries(headerMap)) {
        rowData[key] = toText(row.getCell(column));
      }

      if (isBlankRow(rowData)) continue;

      processedRows += 1;
      if (processedRows > MAX_ROWS) {
        errors.push({ row: rowNumber, message: `Maksimal ${MAX_ROWS} baris per file.` });
        break;
      }

      if (
        rowData.email.toLowerCase() === "budi.santoso@smartops.com" &&
        rowData.employeeId === "EMP-1001" &&
        rowData.name === "Budi Santoso"
      ) {
        continue;
      }

      const rowErrors = [];
      const name = rowData.name.trim();
      const email = canManageAccount ? rowData.email.trim().toLowerCase() : "";
      const password = canManageAccount ? rowData.password : "";
      const createAccount = canManageAccount && Boolean(email || password);
      const roleResult = normalizeRole(rowData.role, actor.role);
      const genderResult = normalizeGender(rowData.gender);
      const statusResult = normalizeStatus(rowData.employmentStatus);
      const contractResult = normalizeContractType(rowData.contractType);
      const joinDateResult = normalizeDate(rowData.joinDate);
      const birthDateResult = normalizeDate(rowData.dateOfBirth);
      const contractStartResult = normalizeDate(rowData.contractStartDate);
      const contractEndResult = normalizeDate(rowData.contractEndDate);
      const employeeId = rowData.employeeId ? rowData.employeeId.trim() : null;
      const phone = rowData.phone ? rowData.phone.trim() : null;
      const address = rowData.address ? rowData.address.trim() : null;
      const managerEmail = rowData.managerEmail ? rowData.managerEmail.trim().toLowerCase() : "";
      const departmentKey = rowData.department ? rowData.department.trim().toLowerCase() : "";

      if (!name) rowErrors.push("Nama wajib diisi.");
      else if (name.length > 120) rowErrors.push("Nama maksimal 120 karakter.");
      if (canManageAccount && Boolean(email) !== Boolean(password)) {
        rowErrors.push("Email dan password harus diisi bersamaan, atau kosongkan keduanya untuk karyawan tanpa akun.");
      } else if (createAccount) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowErrors.push("Format email tidak valid.");
        else if (emailSet.has(email)) rowErrors.push("Email sudah digunakan.");
        if (password.length < 8) rowErrors.push("Password minimal 8 karakter.");
      }
      if (!roleResult.valid) rowErrors.push("Role tidak valid atau tidak boleh dibuat oleh HR.");
      if (!genderResult.valid) rowErrors.push("Gender tidak valid.");
      if (!statusResult.valid) rowErrors.push("Status kepegawaian tidak valid.");
      if (!contractResult.valid) rowErrors.push("Tipe kontrak wajib diisi dan harus valid.");
      if (!joinDateResult.valid) rowErrors.push("Tanggal join tidak valid.");
      if (!birthDateResult.valid) rowErrors.push("Tanggal lahir tidak valid.");
      if (!contractStartResult.valid) rowErrors.push("Tanggal mulai kontrak tidak valid.");
      if (!contractEndResult.valid) rowErrors.push("Tanggal berakhir kontrak tidak valid.");
      if (
        contractStartResult.value &&
        contractEndResult.value &&
        contractEndResult.value < contractStartResult.value
      ) {
        rowErrors.push("Tanggal berakhir kontrak tidak boleh lebih awal dari tanggal mulai.");
      }
      if (employeeId && employeeId.length > 50) rowErrors.push("Employee ID maksimal 50 karakter.");
      if (employeeId && employeeIdSet.has(employeeId.toLowerCase())) {
        rowErrors.push("Employee ID sudah digunakan.");
      }

      const department = departmentKey ? departmentLookup.get(departmentKey) : null;
      if (departmentKey && !department) rowErrors.push(`Department "${rowData.department}" tidak ditemukan.`);

      const manager = managerEmail ? managerLookup.get(managerEmail) : null;
      if (managerEmail && !manager) rowErrors.push(`Manager email "${rowData.managerEmail}" tidak ditemukan.`);

      if (rowErrors.length) {
        errors.push({ row: rowNumber, message: rowErrors.join(" ") });
        continue;
      }

      const salary = calculateEmployeeSalary({
        role: roleResult.value,
        contractType: contractResult.value,
      });
      const effectiveFrom =
        contractStartResult.value || joinDateResult.value || new Date().toISOString().slice(0, 10);
      const passwordHash = createAccount ? await bcrypt.hash(password, 12) : null;

      try {
        const user = await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              name,
              email: email || null,
              passwordHash,
              role: roleResult.value,
              employeeId,
              phone,
              address,
              gender: genderResult.value,
              employmentStatus: statusResult.value,
              joinDate: joinDateResult.value ? new Date(joinDateResult.value) : null,
              dateOfBirth: birthDateResult.value ? new Date(birthDateResult.value) : null,
              contractType: contractResult.value,
              contractStartDate: contractStartResult.value ? new Date(contractStartResult.value) : null,
              contractEndDate: contractEndResult.value ? new Date(contractEndResult.value) : null,
              departmentId: department?.id || null,
              managerId: manager?.id || null,
            },
          });

          await tx.employeeHistory.create({
            data: {
              userId: created.id,
              changedById: Number(actor.id),
              field: "CREATED",
              oldValue: null,
              newValue: `source=excel,role=${roleResult.value},status=${statusResult.value},account=${createAccount ? "active" : "pending"}`,
            },
          });

          if (salary) {
            const salaryStructure = await tx.salaryStructure.create({
              data: {
                userId: created.id,
                basicSalary: salary.amount,
                currency: "IDR",
                effectiveFrom: new Date(effectiveFrom),
                status: "ACTIVE",
                notes: `Auto salary: role ${salary.salaryBand} x ${salary.contractLabel}`,
              },
            });

            await tx.employeeHistory.create({
              data: {
                userId: created.id,
                changedById: Number(actor.id),
                field: "SALARY_SET",
                oldValue: null,
                newValue: String(salary.amount),
              },
            });

            await tx.auditLog.create({
              data: {
                action: "SALARY_CREATED",
                entity: "SalaryStructure",
                entityId: salaryStructure.id,
                userId: Number(actor.id),
                details: `userId=${created.id},source=excel,auto=true`,
              },
            });
          }

          await tx.auditLog.create({
            data: {
              action: "EMPLOYEE_CREATED",
              entity: "User",
              entityId: created.id,
              userId: Number(actor.id),
              details: `source=excel,role=${roleResult.value},status=${statusResult.value},account=${createAccount ? "active" : "pending"}${
                salary ? `,salary=${salary.amount}` : ""
              }`,
            },
          });

          return created;
        });

        if (email) {
          emailSet.add(email);
          managerLookup.set(email, user);
        }
        if (employeeId) employeeIdSet.add(employeeId.toLowerCase());
        imported.push({
          id: user.id,
          name: user.name,
          email: user.email,
          salary: salary?.amount || null,
        });
      } catch (rowError) {
        console.error("IMPORT EMPLOYEE ROW ERROR:", rowError?.message || rowError);
        errors.push({ row: rowNumber, message: "Gagal menyimpan baris ini." });
      }
    }

    if (processedRows === 0) {
      return NextResponse.json(
        { success: false, message: "File tidak memiliki data karyawan" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        imported.length > 0
          ? `${imported.length} karyawan berhasil diimpor${errors.length ? `, ${errors.length} baris gagal` : ""}.`
          : "Tidak ada karyawan yang berhasil diimpor.",
      data: {
        imported: imported.length,
        failed: errors.length,
        employees: imported,
        errors,
      },
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    console.error("IMPORT EMPLOYEES ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengimpor employee" }, { status: 500 });
  }
}
