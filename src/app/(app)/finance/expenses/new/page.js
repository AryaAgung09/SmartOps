import Link from "next/link";
import { connection } from "next/server";
import { getFinanceOptions } from "@/lib/financeQueries";
import ExpenseForm from "../../ExpenseForm";

export const instant = false;

export default async function NewExpensePage() {
  await connection();

  const options = await getFinanceOptions();

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">New Expense</span>
            <h1>Catat Pengeluaran</h1>
            <p>Lengkapi detail biaya sebelum mengajukannya ke alur approval.</p>
          </div>
          <Link href="/finance/expenses" className="doc-secondary-btn">
            Kembali
          </Link>
        </header>

        <section className="doc-form-card">
          <ExpenseForm
            departments={options.departments}
            vendors={options.vendors}
            budgets={options.budgets.map((budget) => ({ id: budget.id, name: budget.name }))}
          />
        </section>
      </div>
    </main>
  );
}
