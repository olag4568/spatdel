"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Pause, PiggyBank, Plus, RefreshCw, Target, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Goal = {
  id: string;
  user_id: string;
  name: string;
  goal_type: "rent" | "general" | "emergency" | "furniture" | "deposit";
  target_amount_kobo: number;
  saved_amount_kobo: number;
  target_date: string | null;
  notes: string | null;
  status: "active" | "paused" | "completed";
  created_at: string;
};

const supabase = createClient();
const naira = (kobo: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(kobo / 100);
const types = [
  { value: "rent", label: "Rent" },
  { value: "general", label: "General savings" },
  { value: "emergency", label: "Emergency fund" },
  { value: "furniture", label: "Furniture" },
  { value: "deposit", label: "Property deposit" },
];

export default function SavingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("My rent");
  const [goalType, setGoalType] = useState<Goal["goal_type"]>("rent");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [today, setToday] = useState("");
  const [notes, setNotes] = useState("");

  const loadGoals = useCallback(async () => {
    setError("");
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      router.replace("/login?next=/savings");
      return;
    }
    setUserId(authData.user.id);
    const { data, error: queryError } = await supabase
      .from("spatdel_savings_goals")
      .select("id,user_id,name,goal_type,target_amount_kobo,saved_amount_kobo,target_date,notes,status,created_at")
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false });
    if (queryError) {
      setError("Savings goals could not load. Make sure the new SPATDEL migration has been applied in Supabase.");
      setGoals([]);
    } else {
      setGoals((data || []) as Goal[]);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
    void loadGoals();
  }, [loadGoals]);

  const totalTarget = useMemo(() => goals.reduce((sum, goal) => sum + Number(goal.target_amount_kobo), 0), [goals]);
  const totalSaved = useMemo(() => goals.reduce((sum, goal) => sum + Number(goal.saved_amount_kobo), 0), [goals]);
  const activeCount = goals.filter((goal) => goal.status === "active").length;

  async function createGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const amount = Number(targetAmount);
    if (!name.trim() || !Number.isFinite(amount) || amount < 100 || amount > 1000000000) {
      setError("Enter a goal name and an amount between ₦100 and ₦1,000,000,000.");
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from("spatdel_savings_goals").insert({
      user_id: userId,
      name: name.trim(),
      goal_type: goalType,
      target_amount_kobo: Math.round(amount * 100),
      target_date: targetDate || null,
      notes: notes.trim() || null,
      status: "active",
    });
    setSaving(false);
    if (insertError) {
      setError("We could not create this goal. Refresh the page and confirm the SPATDEL savings migration is applied.");
      return;
    }
    setName("");
    setTargetAmount("");
    setTargetDate("");
    setNotes("");
    setNotice("Savings goal created. It will only show money saved after a verified deposit integration is enabled.");
    await loadGoals();
  }

  async function togglePause(goal: Goal) {
    setError("");
    setNotice("");
    const nextStatus = goal.status === "paused" ? "active" : "paused";
    const { error: updateError } = await supabase.from("spatdel_savings_goals").update({ status: nextStatus }).eq("id", goal.id).eq("user_id", userId);
    if (updateError) { setError("Could not update this goal."); return; }
    setNotice(nextStatus === "paused" ? "Goal paused." : "Goal resumed.");
    await loadGoals();
  }

  async function deleteGoal(goal: Goal) {
    if (Number(goal.saved_amount_kobo) !== 0 || !window.confirm("Delete this empty savings goal?")) return;
    const { error: deleteError } = await supabase.from("spatdel_savings_goals").delete().eq("id", goal.id).eq("user_id", userId);
    if (deleteError) { setError("Could not delete this goal."); return; }
    setNotice("Savings goal deleted.");
    await loadGoals();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <Link href="/wallet" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700 dark:text-slate-300"><ArrowLeft size={17} /> Wallet</Link>
          <div className="flex gap-2">
            <Link href="/ratings" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700">Ratings</Link>
            <button onClick={() => void loadGoals()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700"><RefreshCw size={16} /> Refresh</button>
          </div>
        </div>
        <section className="rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-700 p-6 text-white shadow-xl sm:p-8">
          <div className="flex items-center gap-3"><div className="rounded-2xl bg-white/10 p-3"><PiggyBank size={28} /></div><div><p className="text-sm text-emerald-100">SPATDEL Savings</p><h1 className="text-3xl font-bold sm:text-4xl">Plan your next move</h1></div></div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50">Create separate goals for rent, emergencies, furniture and property deposits. Your saved balance only changes after a verified financial integration records a real transaction.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-sm text-emerald-100">Total target</p><p className="mt-1 text-2xl font-bold">{naira(totalTarget)}</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-sm text-emerald-100">Verified saved amount</p><p className="mt-1 text-2xl font-bold">{naira(totalSaved)}</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-sm text-emerald-100">Active goals</p><p className="mt-1 text-2xl font-bold">{activeCount}</p></div>
          </div>
        </section>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <strong>Funding is not live yet.</strong> This page creates savings plans only. It does not accept deposits, move money, promise interest, or enable withdrawals. Do not send money to a personal account to fund a goal.
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <form onSubmit={createGoal} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Plus size={19} /> Create a savings goal</h2>
            <label className="mt-4 block text-sm font-semibold">Goal name<input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 font-normal" placeholder="e.g. December rent" /></label>
            <label className="mt-4 block text-sm font-semibold">Goal type<select value={goalType} onChange={(e) => setGoalType(e.target.value as Goal["goal_type"])} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 font-normal">{types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="mt-4 block text-sm font-semibold">Target amount (₦)<input required type="number" min="100" max="1000000000" step="100" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 font-normal" placeholder="300000" /></label>
            <label className="mt-4 block text-sm font-semibold">Target date (optional)<input type="date" min={today} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 font-normal" /></label>
            <label className="mt-4 block text-sm font-semibold">Note (optional)<textarea maxLength={300} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 font-normal" placeholder="What are you saving for?" /></label>
            {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
            {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}
            <button disabled={saving || !userId} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-60">{saving ? "Creating…" : "Create goal"}</button>
          </form>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold">Your savings goals</h2>
            <p className="mt-1 text-sm text-slate-500">Track targets and deadlines in one place.</p>
            {loading ? <p className="py-10 text-center text-slate-500">Loading your goals…</p> : goals.length === 0 ? <div className="py-10 text-center"><Target size={32} className="mx-auto text-slate-400" /><p className="mt-3 font-semibold">No goals yet</p><p className="mt-1 text-sm text-slate-500">Create your first savings target using the form.</p></div> : <div className="mt-4 space-y-3">{goals.map((goal) => { const percent = Math.min(100, Math.round((Number(goal.saved_amount_kobo) / Math.max(1, Number(goal.target_amount_kobo))) * 100)); return <article key={goal.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{goal.name}</p><p className="mt-1 text-xs capitalize text-slate-500">{goal.goal_type} · {goal.status}</p></div><p className="font-bold">{naira(Number(goal.target_amount_kobo))}</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${percent}%` }} /></div><div className="mt-2 flex justify-between gap-3 text-xs text-slate-500"><span>{naira(Number(goal.saved_amount_kobo))} saved</span><span>{percent}%</span></div>{goal.target_date && <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} /> Target {new Date(goal.target_date + "T12:00:00").toLocaleDateString("en-NG", { dateStyle: "medium" })}</p>}{goal.notes && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{goal.notes}</p>}<div className="mt-3 flex gap-2">{goal.status !== "completed" && <button onClick={() => void togglePause(goal)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">{goal.status === "paused" ? <CheckCircle2 size={14} /> : <Pause size={14} />}{goal.status === "paused" ? "Resume" : "Pause"}</button>}{Number(goal.saved_amount_kobo) === 0 && <button onClick={() => void deleteGoal(goal)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700"><Trash2 size={14} /> Delete</button>}</div></article>; })}</div>}
          </section>
        </div>
        <div className="mt-6 flex flex-wrap gap-3"><Link href="/wallet" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-900"><Wallet size={16} /> Wallet & transactions</Link><Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold dark:border-slate-700"><ArrowLeft size={16} /> Back to SPATDEL</Link></div>
      </div>
    </main>
  );
}
