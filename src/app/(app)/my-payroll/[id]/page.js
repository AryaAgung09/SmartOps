import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/roles";
import PrintPayslipButton from "./PrintPayslipButton";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const statusLabels = {
  DRAFT: "Draft",
  CALCULATED: "Dihitung",
  FINALIZED: "Final",
  PAID: "Dibayar",
  CANCELLED: "Dibatalkan",
};

function formatMoney(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

export default async function MyPayslipDetailPage({ params }) {
  await connection();

  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const { id } = await params;
  const payrollId = Number(id);
  if (!Number.isInteger(payrollId) || payrollId < 1) redirect("/my-payroll");

  const payroll = await prisma.payroll.findFirst({
    where: {
      id: payrollId,
      userId: Number(actor.id),
    },
    include: {
      payrollPeriod: true,
      items: true,
      user: {
        select: {
          name: true,
          email: true,
          employeeId: true,
          role: true,
          department: { select: { name: true } },
        },
      },
    },
  });

  if (!payroll) redirect("/my-payroll");

  const items = [...payroll.items].sort((left, right) => {
    if (left.type !== right.type) return left.type === "ALLOWANCE" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
  const allowances = items.filter((item) => item.type === "ALLOWANCE");
  const deductions = items.filter((item) => item.type === "DEDUCTION");
  const statusLabel = statusLabels[payroll.status] || payroll.status;
  const reference = `PAY-${String(payroll.id).padStart(5, "0")}`;
  const notice =
    payroll.status === "DRAFT"
      ? "Slip ini masih berstatus draft dan nilainya dapat berubah sebelum difinalisasi."
      : payroll.status === "CANCELLED"
        ? "Payroll ini dibatalkan dan tidak menjadi dasar pembayaran."
        : "";

  return (
    <main className="payslip-page">
      <div className="payslip-toolbar">
        <Link href="/my-payroll" className="payslip-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Kembali ke My Payroll
        </Link>
        <div className="payslip-actions">
          <span className={`ui-status ${String(payroll.status).toLowerCase()}`}>{statusLabel}</span>
          <PrintPayslipButton />
        </div>
      </div>

      <article className="payslip-sheet">
        <header className="payslip-head">
          <div className="payslip-brand">
            <span className="payslip-brand-mark">S</span>
            <span>
              <strong>SmartOps</strong>
              <small>Operations workspace</small>
            </span>
          </div>
          <div className="payslip-head-copy">
            <span>PAYROLL STATEMENT</span>
            <h1>Slip Gaji</h1>
            <p>{payroll.payrollPeriod.name}</p>
          </div>
          <div className="payslip-reference">
            <span>Referensi</span>
            <strong>{reference}</strong>
          </div>
        </header>

        {notice && <div className="payslip-notice">{notice}</div>}

        <section className="payslip-net-card">
          <div>
            <span>Take home pay</span>
            <strong>{formatMoney(payroll.netSalary)}</strong>
            <small>
              {formatDate(payroll.payrollPeriod.periodStart)} - {formatDate(payroll.payrollPeriod.periodEnd)}
            </small>
          </div>
          <div className="payslip-net-meta">
            <div>
              <span>Status payroll</span>
              <strong className={`ui-status ${String(payroll.status).toLowerCase()}`}>{statusLabel}</strong>
            </div>
            <div>
              <span>Tanggal bayar</span>
              <strong>{formatDate(payroll.payrollPeriod.payDate)}</strong>
            </div>
          </div>
        </section>

        <section className="payslip-meta-grid">
          <article className="payslip-meta-card">
            <h2>Informasi Karyawan</h2>
            <dl>
              <div><dt>Nama</dt><dd>{payroll.user.name}</dd></div>
              <div><dt>Employee ID</dt><dd>{payroll.user.employeeId || "-"}</dd></div>
              <div><dt>Department</dt><dd>{payroll.user.department?.name || "-"}</dd></div>
              <div><dt>Role</dt><dd>{roleLabel(payroll.user.role)}</dd></div>
              <div><dt>Email</dt><dd>{payroll.user.email || "Belum ada akun"}</dd></div>
            </dl>
          </article>

          <article className="payslip-meta-card">
            <h2>Informasi Periode</h2>
            <dl>
              <div><dt>Periode</dt><dd>{payroll.payrollPeriod.name}</dd></div>
              <div><dt>Mulai</dt><dd>{formatDate(payroll.payrollPeriod.periodStart)}</dd></div>
              <div><dt>Selesai</dt><dd>{formatDate(payroll.payrollPeriod.periodEnd)}</dd></div>
              <div><dt>Tanggal bayar</dt><dd>{formatDate(payroll.payrollPeriod.payDate)}</dd></div>
              <div><dt>Referensi</dt><dd>{reference}</dd></div>
            </dl>
          </article>
        </section>

        <section className="payslip-breakdown-grid">
          <article className="payslip-breakdown-card">
            <div className="payslip-card-heading">
              <div>
                <span>EARNINGS</span>
                <h2>Rincian Pendapatan</h2>
              </div>
              <strong>{formatMoney(payroll.grossSalary)}</strong>
            </div>
            <div className="payslip-lines">
              <div className="payslip-line">
                <div><strong>Gaji pokok</strong><small>Basic salary</small></div>
                <span>{formatMoney(payroll.basicSalary)}</span>
              </div>
              {allowances.map((item) => (
                <div className="payslip-line" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.notes || "Tunjangan"}</small>
                  </div>
                  <span>{formatMoney(item.amount)}</span>
                </div>
              ))}
              {!allowances.length && (
                <div className="payslip-empty-line">Tidak ada tunjangan tambahan pada periode ini.</div>
              )}
              <div className="payslip-line payslip-line-total">
                <div><strong>Total pendapatan</strong><small>Gross salary</small></div>
                <span>{formatMoney(payroll.grossSalary)}</span>
              </div>
            </div>
          </article>

          <article className="payslip-breakdown-card">
            <div className="payslip-card-heading">
              <div>
                <span>DEDUCTIONS</span>
                <h2>Rincian Potongan</h2>
              </div>
              <strong>{formatMoney(payroll.totalDeduction)}</strong>
            </div>
            <div className="payslip-lines">
              {deductions.map((item) => (
                <div className="payslip-line" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.notes || "Potongan"}</small>
                  </div>
                  <span>{formatMoney(item.amount)}</span>
                </div>
              ))}
              {!deductions.length && (
                <div className="payslip-empty-line">Tidak ada potongan pada periode ini.</div>
              )}
              <div className="payslip-line payslip-line-total">
                <div><strong>Total potongan</strong><small>Total deduction</small></div>
                <span>{formatMoney(payroll.totalDeduction)}</span>
              </div>
            </div>
          </article>
        </section>

        <section className="payslip-summary-card">
          <div className="payslip-summary-copy">
            <span>PAYMENT SUMMARY</span>
            <h2>Ringkasan Pembayaran</h2>
            <p>Nilai bersih yang tercatat pada payroll periode ini.</p>
          </div>
          <div className="payslip-summary-lines">
            <div><span>Gross salary</span><strong>{formatMoney(payroll.grossSalary)}</strong></div>
            <div><span>Total potongan</span><strong>-{formatMoney(payroll.totalDeduction)}</strong></div>
            <div className="payslip-summary-net"><span>Net salary</span><strong>{formatMoney(payroll.netSalary)}</strong></div>
          </div>
        </section>

        {payroll.notes && (
          <section className="payslip-notes">
            <span>CATATAN PAYROLL</span>
            <p>{payroll.notes}</p>
          </section>
        )}

        <footer className="payslip-footer">
          <div>
            <strong>SmartOps Payroll</strong>
            <span>Dibuat pada {formatDateTime(payroll.createdAt)}</span>
          </div>
          <p>Dokumen ini bersifat rahasia dan hanya untuk karyawan yang bersangkutan.</p>
        </footer>
      </article>
    </main>
  );
}
