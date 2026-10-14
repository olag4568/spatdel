import Link from "next/link";
import { ArrowLeft, PiggyBank } from "lucide-react";
import SavingsGoalsPanel from "@/components/SavingsGoalsPanel";

export default function SavingsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-emerald-700 dark:text-slate-300">
          <ArrowLeft size={16} /> Back to SPATDEL
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><PiggyBank size={24} /></span>
          <div><p className="text-sm text-slate-500 dark:text-slate-400">SPATDEL</p><h1 className="text-2xl font-bold">Savings Goals</h1></div>
        </div>
        <SavingsGoalsPanel />
      </div>
    </main>
  );
}
