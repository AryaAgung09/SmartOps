import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getExpenseById, getFinanceOptions } from "@/lib/financeQueries";
import { toNumber } from "@/lib/finance";
import ExpenseForm from "../../../ExpenseForm";

export const instant = false;

export default async function EditExpensePage({ params }) {
  await connection();

  const id = Number((await params).id);
  if (!id) notFound();

  const [expense, options] = await Promise.all([getExpenseById(id), getFinanceOptions()]);
  if (!expense) notFound();
  if (!["DRAFT", "PENDING"].includes(expense.status) || expense.payments.length > 0) {
    redirect(`/finance/expenses/${expense.id}`);
  }

  const editable = {
    ...expense,
    amount: toNumber(expense.amount),
  };

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">Edit Expense</span>
            <h1>Edit Pengeluaran</h1>
            <p>Perbarui detail pengeluaran sebelum disetujui.</p>
          </div>
          <Link href={`/finance/expenses/${expense.id}`} className="doc-secondary-btn">
            Kembali
          </Link>
        </header>

        <section className="doc-form-card">
          <ExpenseForm
            mode="edit"
            expense={editable}
            departments={options.departments}
            vendors={options.vendors}
            budgets={options.budgets.map((budget) => ({ id: budget.id, name: budget.name }))}
          />
        </section>
      </div>
    </main>
  );
}
