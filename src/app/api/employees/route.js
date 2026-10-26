import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { createAuditLog } from "@/lib/auditLog";
import { CONTRACT_TYPE_VALUES } from "@/lib/employeeContract";
import { calculateEmployeeSalary } from "@/lib/employeeSalary";
import { HR_ASSIGNABLE_ROLES, ROLES } from "@/lib/roles";

const MANAGED_ROLES = ROLES;

function isValidDateString(value) {
  if (!value) return true;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

export async function GET(request) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim().toLowerCase() || "";
    const departmentIdParam = searchParams.get("departmentId");
    const roleParam = searchParams.get("role");
    const employmentStatus = searchParams.get("employmentStatus");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const where = {};

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
        { employeeId: { contains: q } },
      ];
    }

    if (departmentIdParam) {
      const departmentId = Number(departmentIdParam);
      if (!Number.isNaN(departmentId)) {
        where.departmentId = departmentId;
      }
    }

    if (roleParam && ROLES.includes(roleParam)) {
      where.role = roleParam;
    }

    if (employmentStatus && ["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"].includes(employmentStatus)) {
      where.employmentStatus = employmentStatus;
    }

    let page = 1;
    let limit = 20;
    if (pageParam !== null) {
      const p = Number(pageParam);
      if (!Number.isNaN(p) && p >= 1 && Number.isInteger(p)) {
        page = p;
      }
    }
    if (limitParam !== null) {
      const l = Number(limitParam);
      if (!Number.isNaN(l) && l >= 1 && Number.isInteger(l) && l <= 100) {
        limit = l;
      }
    }

    const skip = (page - 1) * limit;

    const [employees, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          employeeId: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          employmentStatus: true,
          joinDate: true,
          contractType: true,
          contractStartDate: true,
          contractEndDate: true,
          departmentId: true,
          managerId: true,
          profilePhoto: true,
          department: { select: { id: true, name: true, code: true } },
          manager: { select: { id: true, name: true, email: true } },
          salaryStructures: {
            where: { status: "ACTIVE" },
            orderBy: { effectiveFrom: "desc" },
            take: 1,
          },
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    console.error("GET EMPLOYEES ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal mengambil data employee" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);

    const body = await request.json();
    const canManageAccount = actor.role === "ADMIN";
    const createAccount = canManageAccount && body.createAccount !== false;
    const name = String(body.name ?? "").trim();
    const email = createAccount ? String(body.email ?? "").trim().toLowerCase() : "";
    const password = createAccount ? String(body.password ?? "") : "";
    const role = String(body.role ?? "STAFF").trim().toUpperCase();
    const employeeId = body.employeeId ? String(body.employeeId).trim() : null;
    const phone = body.phone ? String(body.phone).trim() : null;
    const address = body.address ? String(body.address).trim() : null;
    const gender = body.gender ? String(body.gender).trim().toUpperCase() : null;
    const employmentStatus = body.employmentStatus ? String(body.employmentStatus).trim().toUpperCase() : "ACTIVE";
    const joinDate = body.joinDate || null;
    const dateOfBirth = body.dateOfBirth || null;
    const contractType = body.contractType ? String(body.contractType).trim().toUpperCase() : null;
    const contractStartDate = body.contractStartDate || null;
    const contractEndDate = body.contractEndDate || null;
    const departmentId = body.departmentId === "" || body.departmentId === null || body.departmentId === undefined ? null : Number(body.departmentId);
    const managerId = body.managerId === "" || body.managerId === null || body.managerId === undefined ? null : Number(body.managerId);
    const profilePhoto = body.profilePhoto ? String(body.profilePhoto).trim() : null;

    if (!name) {
      return NextResponse.json({ success: false, message: "Nama wajib diisi" }, { status: 400 });
    }
    if (createAccount && (!email || !password)) {
      return NextResponse.json({ success: false, message: "Email dan password wajib diisi untuk membuat akun" }, { status: 400 });
    }
    if (!MANAGED_ROLES.includes(role)) {
      return NextResponse.json({ success: false, message: "Role tidak valid" }, { status: 400 });
    }
    if (actor.role === "HR" && !HR_ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json({ success: false, message: "HR tidak dapat menetapkan role tersebut" }, { status: 403 });
    }
    if (!["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"].includes(employmentStatus)) {
      return NextResponse.json({ success: false, message: "Employment status tidak valid" }, { status: 400 });
    }
    if (gender && !["MALE", "FEMALE", "OTHER"].includes(gender)) {
      return NextResponse.json({ success: false, message: "Gender tidak valid" }, { status: 400 });
    }
    if (contractType && !CONTRACT_TYPE_VALUES.includes(contractType)) {
      return NextResponse.json({ success: false, message: "Tipe kontrak tidak valid" }, { status: 400 });
    }
    if (departmentId !== null && Number.isNaN(departmentId)) {
      return NextResponse.json({ success: false, message: "Department tidak valid" }, { status: 400 });
    }
    if (managerId !== null && Number.isNaN(managerId)) {
      return NextResponse.json({ success: false, message: "Manager tidak valid" }, { status: 400 });
    }
    if (joinDate && !isValidDateString(joinDate)) {
      return NextResponse.json({ success: false, message: "Tanggal join tidak valid" }, { status: 400 });
    }
    if (dateOfBirth && !isValidDateString(dateOfBirth)) {
      return NextResponse.json({ success: false, message: "Tanggal lahir tidak valid" }, { status: 400 });
    }
    if (contractStartDate && !isValidDateString(contractStartDate)) {
      return NextResponse.json({ success: false, message: "Tanggal mulai kontrak tidak valid" }, { status: 400 });
    }
    if (contractEndDate && !isValidDateString(contractEndDate)) {
      return NextResponse.json({ success: false, message: "Tanggal berakhir kontrak tidak valid" }, { status: 400 });
    }
    if (contractStartDate && contractEndDate && new Date(contractEndDate) < new Date(contractStartDate)) {
      return NextResponse.json({ success: false, message: "Tanggal berakhir kontrak tidak boleh lebih awal dari tanggal mulai" }, { status: 400 });
    }

    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return NextResponse.json({ success: false, message: "Email sudah digunakan" }, { status: 409 });
      }
    }
    if (employeeId) {
      const existingEmp = await prisma.user.findUnique({ where: { employeeId } });
      if (existingEmp) {
        return NextResponse.json({ success: false, message: "Employee ID sudah digunakan" }, { status: 409 });
      }
    }
    if (departmentId !== null) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
      if (!dept) return NextResponse.json({ success: false, message: "Department tidak valid" }, { status: 400 });
    }
    if (managerId !== null) {
      const mgr = await prisma.user.findUnique({ where: { id: managerId }, select: { id: true } });
      if (!mgr) return NextResponse.json({ success: false, message: "Manager tidak valid" }, { status: 400 });
    }

    const salary = calculateEmployeeSalary({
      role,
      contractType,
    });
    const salaryEffectiveFrom = contractStartDate || joinDate || new Date().toISOString().slice(0, 10);

    const passwordHash = createAccount ? await bcrypt.hash(password, 12) : null;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: email || null,
          passwordHash,
          role,
          employeeId,
          phone,
          address,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          gender: gender || null,
          employmentStatus,
          joinDate: joinDate ? new Date(joinDate) : null,
          contractType,
          contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
          contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
          managerId,
          profilePhoto,
          departmentId,
        },
      });

      await tx.employeeHistory.create({
        data: {
          userId: user.id,
          changedById: Number(actor.id),
          field: "CREATED",
          oldValue: null,
          newValue: `role=${role},status=${employmentStatus}`,
        },
      });

      if (salary) {
        const salaryStructure = await tx.salaryStructure.create({
          data: {
            userId: user.id,
            basicSalary: salary.amount,
            currency: "IDR",
            effectiveFrom: new Date(salaryEffectiveFrom),
            status: "ACTIVE",
            notes: `Auto salary: role ${salary.salaryBand} x ${salary.contractLabel}`,
          },
        });

        await tx.employeeHistory.create({
          data: {
            userId: user.id,
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
            details: `userId=${user.id},auto=true`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "EMPLOYEE_CREATED",
          entity: "User",
          entityId: user.id,
          userId: Number(actor.id),
          details: `role=${role},status=${employmentStatus},account=${createAccount ? "active" : "pending"}${salary ? `,salary=${salary.amount}` : ""}`,
        },
      });

      return { user, salary };
    });

    return NextResponse.json(
      {
        success: true,
        message: "Employee berhasil dibuat",
        data: {
          id: result.user.id,
          name: result.user.name,
          salary: result.salary?.amount || null,
          salaryBand: result.salary?.salaryBand || null,
          accountCreated: Boolean(result.user.passwordHash),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    console.error("CREATE EMPLOYEE ERROR:", error?.message || error);
    return NextResponse.json({ success: false, message: "Gagal membuat employee" }, { status: 500 });
  }
}
