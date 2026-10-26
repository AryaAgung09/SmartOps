import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

function parseDatabaseUrl(url?: string) {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password || ""),
      database: parsed.pathname.replace(/^\//, ""),
    };
  } catch {
    return null;
  }
}

const connectionConfig =
  parseDatabaseUrl(process.env.DATABASE_URL) || {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "smartops",
  };

const adapter = new PrismaMariaDb(connectionConfig);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123", 12);

  const users = [
    {
      name: "Administrator",
      email: "admin@smartops.com",
      role: "ADMIN",
    },
    {
      name: "HR Staff",
      email: "hr@smartops.com",
      role: "HR",
    },
    {
      name: "IT Support",
      email: "it@smartops.com",
      role: "IT",
    },
    {
      name: "Finance Staff",
      email: "finance@smartops.com",
      role: "FINANCE",
    },
    {
      name: "General Affair Staff",
      email: "ga@smartops.com",
      role: "GENERAL_AFFAIR",
    },
    {
      name: "Staff",
      email: "staff@smartops.com",
      role: "STAFF",
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: {
        email: user.email,
      },
      update: {
        name: user.name,
        role: user.role,
        passwordHash,
      },
      create: {
        name: user.name,
        email: user.email,
        role: user.role,
        passwordHash,
      },
    });

    console.log(`OK: ${user.email} -> ${user.role}`);
  }

  const defaultSchedule = await prisma.workSchedule.upsert({
    where: { name: "Reguler 08.00 - 17.00" },
    update: {
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: 60,
      gracePeriodMinutes: 15,
      workingDays: "1,2,3,4,5",
      isActive: true,
    },
    create: {
      name: "Reguler 08.00 - 17.00",
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: 60,
      gracePeriodMinutes: 15,
      workingDays: "1,2,3,4,5",
      isActive: true,
    },
  });

  await prisma.user.updateMany({
    where: { workScheduleId: null, shiftId: null },
    data: { workScheduleId: defaultSchedule.id },
  });

  console.log(`OK: work schedule ${defaultSchedule.name}`);

  const departments = [
    { name: "Human Resources", code: "HR" },
    { name: "Finance", code: "FIN" },
    { name: "Information Technology", code: "IT" },
    { name: "Operations", code: "OPS" },
  ];

  for (const department of departments) {
    await prisma.department.upsert({
      where: {
        name: department.name,
      },
      update: {
        code: department.code,
        status: "ACTIVE",
      },
      create: {
        name: department.name,
        code: department.code,
        status: "ACTIVE",
      },
    });

    console.log(`OK: department ${department.name}`);
  }

  console.log("");
  console.log("========================================");
  console.log("SEED USER SMARTOPS SELESAI");
  console.log("========================================");
  console.log("Password semua akun: Admin@123");
  console.log("========================================");
}

main()
  .catch((error) => {
    console.error("SEED ERROR:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
