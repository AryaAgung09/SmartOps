import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getExpenseById } from "@/lib/financeQueries";
import {
  categoryLabel,
  expenseStatusLabel,
  formatCurrency,
  formatDate,
  paidAmount,
  statusClass,
  toNumber,
} from "@/lib/finance";
import FinanceActionButton from "../../FinanceActionButton";

export const instant = false;

export default async function ExpenseDetailPage({ params }) {
  await connection();

  const id = Number((await params).id);
  if (!id) notFound();

  const expense = await getExpenseById(id);
  if (!expense) notFound();

  const paid = paidAmount(expense.payments);
  const outstanding = Math.max(toNumber(expense.amount) - paid, 0);
  const canEdit = ["DRAFT", "PENDING"].includes(expense.status) && expense.payments.length === 0;

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="doc-detail-head fin-detail-head">
          <div>
            <Link href="/finance/expenses" className="fin-back-link">
              ← Pengeluaran
            </Link>
            <span className="doc-eyebrow">{categoryLabel(expense.category)}</span>
            <h1>{expense.title}</h1>
            <p>
              {expense.vendor?.name || "Tanpa vendor"} ·{" "}
              {expense.department?.name || "Umum"} · {formatDate(expense.expenseDate)}
            </p>
          </div>
          <div className="doc-detail-actions">
            <span className={`fin-status ${statusClass(expense.status)}`}>
              {expenseStatusLabel(expense.status)}
            </span>
            {canEdit && (
              <Link href={`/finance/expenses/${expense.id}/edit`} className="doc-secondary-btn">
                Edit
              </Link>
            )}
            {expense.status === "DRAFT" && (
              <FinanceActionButton
                endpoint={`/api/finance/expenses/${expense.id}`}
                body={{ status: "PENDING" }}
                label="Ajukan"
              />
            )}
            {expense.status === "PENDING" && (
              <>
                <FinanceActionButton
                  endpoint={`/api/finance/expenses/${expense.id}`}
                  body={{ status: "APPROVED" }}
                  label="Setujui"
                  className="fin-action-btn success"
                />
                <FinanceActionButton
                  endpoint={`/api/finance/expenses/${expense.id}`}
                  body={{ status: "REJECTED" }}
                  label="Tolak"
                  className="fin-action-btn danger"
                />
              </>
            )}
            {expense.status === "APPROVED" && outstanding > 0 && (
              <Link href={`/finance/payments?expenseId=${expense.id}`} className="doc-primary-btn">
                Bayar
              </Link>
            )}
          </div>
        </header>

        <section className="doc-kpi-grid" aria-label="Expense amounts">
          <article className="doc-kpi doc-kpi-blue">
            <span className="doc-kpi-label">Nilai Pengeluaran</span>
            <strong>{formatCurrency(expense.amount)}</strong>
            <small>{categoryLabel(expense.category)}</small>
          </article>
          <article className="doc-kpi doc-kpi-green">
            <span className="doc-kpi-label">Sudah Dibayar</span>
            <strong>{formatCurrency(paid)}</strong>
            <small>{expense.payments.length} pembayaran</small>
          </article>
          <article className="doc-kpi doc-kpi-amber">
            <span className="doc-kpi-label">Sisa Pembayaran</span>
            <strong>{formatCurrency(outstanding)}</strong>
            <small>{outstanding > 0 ? "Belum diselesaikan" : "Selesai"}</small>
          </article>
          <article className="doc-kpi doc-kpi-rose">
            <span className="doc-kpi-label">Budget</span>
            <strong className="fin-kpi-text">{expense.budget?.name || "Tanpa budget"}</strong>
            <small>
              {expense.budget
                ? `${formatDate(expense.budget.periodStart)} - ${formatDate(expense.budget.periodEnd)}`
                : "Tidak dibebankan ke budget"}
            </small>
          </article>
        </section>

        <section className="doc-detail-grid">
          <article className="doc-card">
            <div className="doc-card-head">
              <div>
                <h2>Detail Pengeluaran</h2>
                <p>Informasi pencatatan dan approval.</p>
              </div>
            </div>
            <dl className="fin-detail-list">
              <div>
                <dt>Judul</dt>
                <dd>{expense.title}</dd>
              </div>
              <div>
                <dt>Kategori</dt>
                <dd>{categoryLabel(expense.category)}</dd>
              </div>
              {expense.payroll && (
                <div>
                  <dt>Sumber</dt>
                  <dd>
                    <Link href={`/payroll/${expense.payroll.id}`} className="fin-text-link">
                      Payroll {expense.payroll.user?.name || "-"} · {expense.payroll.payrollPeriod?.name || "-"}
                    </Link>
                  </dd>
                </div>
              )}
              <div>
                <dt>Tanggal</dt>
                <dd>{formatDate(expense.expenseDate)}</dd>
              </div>
              <div>
                <dt>Vendor</dt>
                <dd>{expense.vendor?.name || "-"}</dd>
              </div>
              <div>
                <dt>Departemen</dt>
                <dd>{expense.department?.name || "-"}</dd>
              </div>
              <div>
                <dt>Dibuat oleh</dt>
                <dd>{expense.createdBy?.name || "-"}</dd>
              </div>
              <div>
                <dt>Disetujui oleh</dt>
                <dd>{expense.approvedBy?.name || "-"}</dd>
              </div>
              <div>
                <dt>Tanggal approval</dt>
                <dd>{formatDate(expense.approvedAt)}</dd>
              </div>
              <div className="wide">
                <dt>Catatan</dt>
                <dd>{expense.notes || "Tidak ada catatan."}</dd>
              </div>
            </dl>
          </article>

          <article className="doc-card">
            <div className="doc-card-head">
              <div>
                <h2>Riwayat Pembayaran</h2>
                <p>Pembayaran yang terhubung ke pengeluaran ini.</p>
              </div>
            </div>
            <div className="fin-timeline">
              {expense.payments.length === 0 && (
                <div className="fin-empty">Belum ada pembayaran.</div>
              )}
              {expense.payments.map((payment) => (
                <div className="fin-timeline-item" key={payment.id}>
                  <div>
                    <strong>{formatCurrency(payment.amount)}</strong>
                    <small>
                      {formatDate(payment.paymentDate)} · {payment.reference || "Tanpa referensi"}
                    </small>
                  </div>
                  <span>{payment.createdBy?.name || "-"}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
