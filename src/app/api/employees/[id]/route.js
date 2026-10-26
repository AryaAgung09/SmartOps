import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { createAuditLog } from "@/lib/auditLog";
import { CONTRACT_TYPE_VALUES } from "@/lib/employeeContract";
import { HR_ASSIGNABLE_ROLES, ROLES } from "@/lib/roles";

const MANAGED_ROLES = ROLES;

function isValidDateString(value) {
  if (!value) return true;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function formatDateInput(d) {
  if (!d) return null;
  try {
    return new Date(d).toISOString().split("T")[0];
  } catch {
    return null;
  }
}

export async function GET(request, { params }) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const { id } = await params;
    const userId = Number(id);
    if (Number.isNaN(userId)) {
      return NextResponse.json({ success: false, message: "ID employee tidak valid" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
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
        contractType: true,
        contractStartDate: true,
        contractEndDate: true,
        profilePhoto: true,
        departmentId: true,
        managerId: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: { id: true, name: true, code: true, description: true, status: true },
        },
        manager: { select: { id: true, name: true, email: true } },
        salaryStructures: { orderBy: { effectiveFrom: "desc" } },
        employeeHistories: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            userId: true,
            changedById: true,
            field: true,
            oldValue: true,
            newValue: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "Employee tidak ditemukan" }, { status: 404 });
    }

    const data = {
      ...user,
      dateOfBirth: formatDateInput(user.dateOfBirth),
      joinDate: formatDateInput(user.joinDate),
      contractStartDate: formatDateInput(user.contractStartDate),
      contractEndDate: formatDateInput(user.contractEndDate),
      employeeHistories: user.employeeHistories.map((h) => ({
        ...h,
        createdAt: h.createdAt,
      })),
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    console.error("GET EMPLOYEE ERROR");
    return NextResponse.json({ success: false, message: "Gagal mengambil data employee" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const actor = await requireRole(["ADMIN", "HR"]);
    const { id } = await params;
    const userId = Number(id);
    if (Number.isNaN(userId)) {
      return NextResponse.json({ success: false, message: "ID employee tidak valid" }, { status: 400 });
    }

    const body = await request.json();
    const canManageAccount = actor.role === "ADMIN";
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const rawEmail = canManageAccount && body.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;
    const email = rawEmail !== undefined ? (rawEmail || null) : undefined;
    const role = body.role !== undefined ? String(body.role).trim().toUpperCase() : undefined;
    const password = canManageAccount && body.password ? String(body.password) : undefined;
    const employeeId = body.employeeId !== undefined ? (body.employeeId ? String(body.employeeId).trim() : null) : undefined;
    const phone = body.phone !== undefined ? (body.phone ? String(body.phone).trim() : null) : undefined;
    const address = body.address !== undefined ? (body.address ? String(body.address).trim() : null) : undefined;
    const gender = body.gender !== undefined ? (body.gender ? String(body.gender).trim().toUpperCase() : null) : undefined;
    const employmentStatus = body.employmentStatus !== undefined ? String(body.employmentStatus).trim().toUpperCase() : undefined;
    const joinDate = body.joinDate !== undefined ? body.joinDate : undefined;
    const dateOfBirth = body.dateOfBirth !== undefined ? body.dateOfBirth : undefined;
    const contractType = body.contractType !== undefined ? (body.contractType ? String(body.contractType).trim().toUpperCase() : null) : undefined;
    const contractStartDate = body.contractStartDate !== undefined ? body.contractStartDate : undefined;
    const contractEndDate = body.contractEndDate !== undefined ? body.contractEndDate : undefined;
    const departmentId = body.departmentId !== undefined ? (body.departmentId === "" || body.departmentId === null ? null : Number(body.departmentId)) : undefined;
    const managerId = body.managerId !== undefined ? (body.managerId === "" || body.managerId === null ? null : Number(body.managerId)) : undefined;
    const profilePhoto = body.profilePhoto !== undefined ? (body.profilePhoto ? String(body.profilePhoto).trim() : null) : undefined;

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        email: true,
        passwordHash: true,
        employeeId: true,
        departmentId: true,
        managerId: true,
        employmentStatus: true,
        contractType: true,
        contractStartDate: true,
        contractEndDate: true,
      },
    });
    if (!target) {
      return NextResponse.json({ success: false, message: "Employee tidak ditemukan" }, { status: 404 });
    }

    if (actor.role === "HR") {
      if (target.role === "ADMIN") {
        return NextResponse.json({ success: false, message: "HR tidak dapat mengubah user ADMIN" }, { status: 403 });
      }
      if (role !== undefined && ["ADMIN", "HR"].includes(target.role)) {
        return NextResponse.json({ success: false, message: "Role user tersebut hanya dapat diubah oleh Admin" }, { status: 403 });
      }
      if (role !== undefined && !HR_ASSIGNABLE_ROLES.includes(role)) {
        return NextResponse.json({ success: false, message: "HR tidak dapat menetapkan role tersebut" }, { status: 403 });
      }
    }

    if (role !== undefined && !MANAGED_ROLES.includes(role)) {
      return NextResponse.json({ success: false, message: "Role tidak valid" }, { status: 400 });
    }
    if (password !== undefined && password.length < 8) {
      return NextResponse.json({ success: false, message: "Password minimal 8 karakter" }, { status: 400 });
    }
    if (email !== undefined && email !== null && !target.passwordHash && !password) {
      return NextResponse.json({ success: false, message: "Password wajib diisi untuk mengaktifkan akun" }, { status: 400 });
    }
    if (password !== undefined) {
      const nextEmail = email !== undefined ? email : target.email;
      if (!nextEmail) {
        return NextResponse.json({ success: false, message: "Email wajib diisi sebelum membuat password" }, { status: 400 });
      }
    }
    if (employmentStatus !== undefined && !["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"].includes(employmentStatus)) {
      return NextResponse.json({ success: false, message: "Employment status tidak valid" }, { status: 400 });
    }
    if (gender !== undefined && gender !== null && !["MALE", "FEMALE", "OTHER"].includes(gender)) {
      return NextResponse.json({ success: false, message: "Gender tidak valid" }, { status: 400 });
    }
    if (contractType !== undefined && contractType !== null && !CONTRACT_TYPE_VALUES.includes(contractType)) {
      return NextResponse.json({ success: false, message: "Tipe kontrak tidak valid" }, { status: 400 });
    }
    if (departmentId !== undefined && departmentId !== null && Number.isNaN(departmentId)) {
      return NextResponse.json({ success: false, message: "Department tidak valid" }, { status: 400 });
    }
    if (managerId !== undefined && managerId !== null && Number.isNaN(managerId)) {
      return NextResponse.json({ success: false, message: "Manager tidak valid" }, { status: 400 });
    }
    if (managerId !== undefined && managerId !== null && managerId === userId) {
      return NextResponse.json({ success: false, message: "Manager tidak boleh sama dengan employee" }, { status: 400 });
    }
    if (joinDate !== undefined && joinDate && !isValidDateString(joinDate)) {
      return NextResponse.json({ success: false, message: "Tanggal join tidak valid" }, { status: 400 });
    }
    if (dateOfBirth !== undefined && dateOfBirth && !isValidDateString(dateOfBirth)) {
      return NextResponse.json({ success: false, message: "Tanggal lahir tidak valid" }, { status: 400 });
    }
    if (contractStartDate !== undefined && contractStartDate && !isValidDateString(contractStartDate)) {
      return NextResponse.json({ success: false, message: "Tanggal mulai kontrak tidak valid" }, { status: 400 });
    }
    if (contractEndDate !== undefined && contractEndDate && !isValidDateString(contractEndDate)) {
      return NextResponse.json({ success: false, message: "Tanggal berakhir kontrak tidak valid" }, { status: 400 });
    }
    if (contractStartDate !== undefined || contractEndDate !== undefined) {
      const nextStart = contractStartDate !== undefined ? contractStartDate : target.contractStartDate;
      const nextEnd = contractEndDate !== undefined ? contractEndDate : target.contractEndDate;
      if (nextStart && nextEnd && new Date(nextEnd) < new Date(nextStart)) {
        return NextResponse.json({ success: false, message: "Tanggal berakhir kontrak tidak boleh lebih awal dari tanggal mulai" }, { status: 400 });
      }
    }

    if (email) {
      const existingUser = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
      if (existingUser) {
        return NextResponse.json({ success: false, message: "Email sudah digunakan user lain" }, { status: 409 });
      }
    }
    if (employeeId !== undefined && employeeId) {
      const existingEmp = await prisma.user.findFirst({ where: { employeeId, NOT: { id: userId } } });
      if (existingEmp) {
        return NextResponse.json({ success: false, message: "Employee ID sudah digunakan" }, { status: 409 });
      }
    }
    if (departmentId !== undefined && departmentId !== null) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
      if (!dept) return NextResponse.json({ success: false, message: "Department tidak valid" }, { status: 400 });
    }
    if (managerId !== undefined && managerId !== null) {
      const mgr = await prisma.user.findUnique({ where: { id: managerId }, select: { id: true } });
      if (!mgr) return NextResponse.json({ success: false, message: "Manager tidak valid" }, { status: 400 });
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
    const accountChanged = email !== undefined || passwordHash !== undefined;

    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (passwordHash !== undefined) data.passwordHash = passwordHash;
    if (employeeId !== undefined) data.employeeId = employeeId;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;
    if (gender !== undefined) data.gender = gender;
    if (employmentStatus !== undefined) data.employmentStatus = employmentStatus;
    if (joinDate !== undefined) data.joinDate = joinDate ? new Date(joinDate) : null;
    if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (contractType !== undefined) data.contractType = contractType;
    if (contractStartDate !== undefined) data.contractStartDate = contractStartDate ? new Date(contractStartDate) : null;
    if (contractEndDate !== undefined) data.contractEndDate = contractEndDate ? new Date(contractEndDate) : null;
    if (departmentId !== undefined) data.departmentId = departmentId;
    if (managerId !== undefined) data.managerId = managerId;
    if (profilePhoto !== undefined) data.profilePhoto = profilePhoto;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data,
        select: {
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
          contractType: true,
          contractStartDate: true,
          contractEndDate: true,
          profilePhoto: true,
          departmentId: true,
          managerId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (employmentStatus !== undefined && employmentStatus !== target.employmentStatus) {
        await tx.employeeHistory.create({ data: { userId, changedById: Number(actor.id), field: "STATUS_CHANGED", oldValue: target.employmentStatus, newValue: employmentStatus } });
        await tx.auditLog.create({ data: { action: "EMPLOYEE_STATUS_CHANGED", entity: "User", entityId: userId, userId: Number(actor.id), details: `${target.employmentStatus}->${employmentStatus}` } });
      }
      if (departmentId !== undefined && departmentId !== target.departmentId) {
        await tx.employeeHistory.create({ data: { userId, changedById: Number(actor.id), field: "DEPARTMENT_CHANGED", oldValue: String(target.departmentId || ""), newValue: String(departmentId || "") } });
        await tx.auditLog.create({ data: { action: "EMPLOYEE_DEPARTMENT_CHANGED", entity: "User", entityId: userId, userId: Number(actor.id), details: `${target.departmentId || "null"}->${departmentId || "null"}` } });
      }
      if (role !== undefined && role !== target.role) {
        await tx.employeeHistory.create({ data: { userId, changedById: Number(actor.id), field: "ROLE_CHANGED", oldValue: target.role, newValue: role } });
        await tx.auditLog.create({ data: { action: "EMPLOYEE_ROLE_CHANGED", entity: "User", entityId: userId, userId: Number(actor.id), details: `${target.role}->${role}` } });
      }
      if (managerId !== undefined && managerId !== target.managerId) {
        await tx.employeeHistory.create({ data: { userId, changedById: Number(actor.id), field: "MANAGER_CHANGED", oldValue: String(target.managerId || ""), newValue: String(managerId || "") } });
        await tx.auditLog.create({ data: { action: "EMPLOYEE_MANAGER_CHANGED", entity: "User", entityId: userId, userId: Number(actor.id), details: `${target.managerId || "null"}->${managerId || "null"}` } });
      }
      const contractChanged =
        (contractType !== undefined && contractType !== target.contractType) ||
        (contractStartDate !== undefined && (contractStartDate ? new Date(contractStartDate).getTime() : null) !== (target.contractStartDate ? new Date(target.contractStartDate).getTime() : null)) ||
        (contractEndDate !== undefined && (contractEndDate ? new Date(contractEndDate).getTime() : null) !== (target.contractEndDate ? new Date(target.contractEndDate).getTime() : null));
      if (contractChanged) {
        const oldContract = `${target.contractType || "-"}|${formatDateInput(target.contractStartDate) || "-"}|${formatDateInput(target.contractEndDate) || "-"}`;
        const newContract = `${contractType !== undefined ? (contractType || "-") : (target.contractType || "-")}|${contractStartDate !== undefined ? (formatDateInput(contractStartDate) || "-") : (formatDateInput(target.contractStartDate) || "-")}|${contractEndDate !== undefined ? (formatDateInput(contractEndDate) || "-") : (formatDateInput(target.contractEndDate) || "-")}`;
        await tx.employeeHistory.create({ data: { userId, changedById: Number(actor.id), field: "CONTRACT_CHANGED", oldValue: oldContract, newValue: newContract } });
        await tx.auditLog.create({ data: { action: "EMPLOYEE_CONTRACT_CHANGED", entity: "User", entityId: userId, userId: Number(actor.id), details: `${oldContract}->${newContract}` } });
      }
      if (accountChanged) {
        await tx.employeeHistory.create({ data: { userId, changedById: Number(actor.id), field: "ACCOUNT_UPDATED", oldValue: target.email ? "active" : "pending", newValue: (email !== undefined ? email : target.email) ? "active" : "pending" } });
        await tx.auditLog.create({ data: { action: "EMPLOYEE_ACCOUNT_UPDATED", entity: "User", entityId: userId, userId: Number(actor.id), details: `email=${email === undefined ? target.email || "unchanged" : email || "cleared"},password=${passwordHash ? "reset" : "unchanged"}` } });
      }
      await tx.employeeHistory.create({ data: { userId, changedById: Number(actor.id), field: "UPDATED", oldValue: null, newValue: "profile_update" } });
      await tx.auditLog.create({ data: { action: "EMPLOYEE_UPDATED", entity: "User", entityId: userId, userId: Number(actor.id) } });
      return updated;
    });

    return NextResponse.json({
      success: true,
      message: "Employee berhasil diperbarui",
      data: {
        ...result,
        dateOfBirth: formatDateInput(result.dateOfBirth),
        joinDate: formatDateInput(result.joinDate),
        contractStartDate: formatDateInput(result.contractStartDate),
        contractEndDate: formatDateInput(result.contractEndDate),
      },
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    console.error("UPDATE EMPLOYEE ERROR");
    return NextResponse.json({ success: false, message: "Gagal memperbarui employee" }, { status: 500 });
  }
}
