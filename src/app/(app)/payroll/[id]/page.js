import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

export default async function PayrollDetailPage({ params }) {
  await connection();

  let actor;
  try {
    actor = await requireRole(ROLES);
  } catch (error) {
    if (error.message === "UNAUTHORIZED") redirect("/login");
    redirect("/payroll");
  }

  const { id } = await params;
  const payrollId = Number(id);
  if (Number.isNaN(payrollId)) redirect("/payroll");

  const payroll = await prisma.payroll.findFirst({
    where: {
      id: payrollId,
      ...(actor.role === "STAFF" ? { userId: Number(actor.id) } : {}),
    },
    include: {
      user: { select: { name: true, email: true, employeeId: true } },
      payrollPeriod: true,
      items: true,
      expense: { select: { id: true, status: true, amount: true } },
    },
  });

  if (!payroll) redirect("/payroll");

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Payroll Detail</h1>
          <p>{payroll.payrollPeriod.name}</p>
        </div>
        <Link href="/payroll" className="btn">Kembali</Link>
      </div>
      <section>
        <p><strong>Karyawan:</strong> {payroll.user.name} ({payroll.user.employeeId || payroll.user.email})</p>
        <p><strong>Status:</strong> {payroll.status}</p>
        <p><strong>Periode:</strong> {new Date(payroll.payrollPeriod.periodStart).toLocaleDateString("id-ID")} - {new Date(payroll.payrollPeriod.periodEnd).toLocaleDateString("id-ID")}</p>
        <table>
          <tbody>
            <tr><th>Basic Salary</th><td>{Number(payroll.basicSalary).toLocaleString("id-ID")}</td></tr>
            <tr><th>Total Allowance</th><td>{Number(payroll.totalAllowance).toLocaleString("id-ID")}</td></tr>
            <tr><th>Total Deduction</th><td>{Number(payroll.totalDeduction).toLocaleString("id-ID")}</td></tr>
            <tr><th>Gross Salary</th><td>{Number(payroll.grossSalary).toLocaleString("id-ID")}</td></tr>
            <tr><th>Net Salary</th><td>{Number(payroll.netSalary).toLocaleString("id-ID")}</td></tr>
          </tbody>
        </table>
      </section>
      {payroll.expense && (
        <section style={{ marginTop: "24px" }}>
          <h2>Pencatatan Finance</h2>
          <p>
            Pengeluaran payroll ini tercatat di Finance sebesar{" "}
            {Number(payroll.expense.amount).toLocaleString("id-ID")} dengan status {payroll.expense.status}.
          </p>
          <Link href={`/finance/expenses/${payroll.expense.id}`} className="btn">
            Lihat Pengeluaran Finance
          </Link>
        </section>
      )}
      {payroll.items.length > 0 && (
        <section style={{ marginTop: "24px" }}>
          <h2>Payroll Items</h2>
          <table>
            <thead><tr><th>Nama</th><th>Tipe</th><th>Jumlah</th><th>Catatan</th></tr></thead>
            <tbody>{payroll.items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.type}</td><td>{Number(item.amount).toLocaleString("id-ID")}</td><td>{item.notes || "-"}</td></tr>)}</tbody>
          </table>
        </section>
      )}
    </main>
  );
}
