import Link from "next/link";
import { connection } from "next/server";
import { getFinanceOptions } from "@/lib/financeQueries";
import BudgetForm from "../../BudgetForm";

export const instant = false;

export default async function NewBudgetPage() {
  await connection();

  const options = await getFinanceOptions();

  return (
    <main className="doc-page fin-page">
      <div className="doc-dashboard">
        <header className="fin-page-head">
          <div>
            <span className="doc-eyebrow">New Budget</span>
            <h1>Budget Baru</h1>
            <p>Tentukan plafon anggaran dan periode pemakaiannya.</p>
          </div>
          <Link href="/finance/budgets" className="doc-secondary-btn">
            Kembali
          </Link>
        </header>

        <section className="doc-form-card">
          <BudgetForm departments={options.departments} />
        </section>
      </div>
    </main>
  );
}
