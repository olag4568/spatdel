"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  XCircle,
  Wallet,
  AlertTriangle,
} from "lucide-react";

type PayoutAccount = {
  id: string;
  user_id: string;
  provider: string;
  bank_name: string | null;
  account_name: string | null;
  account_number_last4: string | null;
  status: "pending" | "verified" | "rejected" | "disabled";
  is_default: boolean;
  created_at: string;
  verified_at: string | null;
  owner: { id: string; full_name: string | null; email: string | null } | null;
};

function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminPaymentsPage() {
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAccounts = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/payout-accounts", { cache: "no-store" });
      const result = await response.json();
      if (response.status === 401) {
        window.location.href = "/login?next=/admin/payments";
        return;
      }
      if (!response.ok) throw new Error(result?.error || "Could not load payout accounts.");
      setConfigured(result.configured === true);
      setAccounts(Array.isArray(result.accounts) ? result.accounts : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load payout accounts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function reviewAccount(id: string, status: "verified" | "rejected") {
    const account = accounts.find((item) => item.id === id);
    if (!account || account.status !== "pending") return;

    const action = status === "verified" ? "approve this bank account" : "reject this bank account";
    if (!window.confirm(`Are you sure you want to ${action}? This will not move money or enable withdrawals.`)) return;

    setReviewingId(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/payout-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Could not save review decision.");
      setNotice(result.message || "Review saved.");
      await loadAccounts(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save review decision.");
    } finally {
      setReviewingId(null);
    }
  }

  const pendingCount = accounts.filter((account) => account.status === "pending").length;
  const verifiedCount = accounts.filter((account) => account.status === "verified").length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
            <ArrowLeft size={17} /> Back to admin dashboard
          </Link>
          <button onClick={() => void loadAccounts(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <section className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-300">SPATDEL · Admin only</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Payment & payout review</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Review users&apos; registered payout destinations. The payment provider belongs to SPATDEL administration; users only submit their own bank details. This page does not initiate transfers.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3"><Wallet size={28} /></div>
          </div>
          {error && <div role="alert" className="mt-5 rounded-xl border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div>}
          {notice && <div role="status" className="mt-5 rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{notice}</div>}
        </section>

        {!configured && (
          <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Paystack is not connected yet</p>
              <p>No Paystack account or secret key is required to build this review screen. When SPATDEL is ready, the admin can create the provider account and configure the secret key securely in the deployment environment. Do not paste secret keys into this page or commit them to GitHub.</p>
            </div>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">All payout accounts</p>
            <p className="mt-2 text-3xl font-bold">{accounts.length}</p>
          </article>
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-sm text-amber-800 dark:text-amber-200">Awaiting review</p>
            <p className="mt-2 text-3xl font-bold text-amber-950 dark:text-amber-100">{pendingCount}</p>
          </article>
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
            <p className="text-sm text-emerald-800 dark:text-emerald-200">Verified accounts</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950 dark:text-emerald-100">{verifiedCount}</p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck size={22} className="text-indigo-600" />
            <div>
              <h2 className="font-bold">User payout bank accounts</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Only masked account numbers are displayed. Review decisions apply only to pending records.</p>
            </div>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading payout accounts…</p>
          ) : accounts.length === 0 ? (
            <div className="mt-5 rounded-xl bg-slate-50 p-8 text-center dark:bg-slate-950">
              <Wallet className="mx-auto text-slate-400" size={28} />
              <p className="mt-3 font-semibold">No payout accounts yet</p>
              <p className="mt-1 text-sm text-slate-500">User-submitted bank accounts will appear here after provider setup and account registration.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {accounts.map((account) => (
                <article key={account.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{account.bank_name || "Bank name unavailable"}{account.account_number_last4 ? ` ···· ${account.account_number_last4}` : ""}</h3>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${account.status === "verified" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" : account.status === "rejected" || account.status === "disabled" ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200" : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>
                          {account.status === "verified" ? <CheckCircle2 size={13} /> : account.status === "pending" ? <Clock3 size={13} /> : <XCircle size={13} />}
                          {account.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium">{account.account_name || "Account name pending"}</p>
                      <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">{account.owner?.full_name || "User"}{account.owner?.email ? ` · ${account.owner.email}` : ""}</p>
                      <p className="mt-1 break-all text-xs text-slate-400">User ID: {account.user_id}</p>
                      <p className="mt-1 text-xs text-slate-500">Added {dateLabel(account.created_at)} · Provider: {account.provider}</p>
                    </div>
                    {account.status === "pending" && (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => void reviewAccount(account.id, "verified")} disabled={reviewingId === account.id} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                          {reviewingId === account.id ? "Saving…" : "Approve account"}
                        </button>
                        <button onClick={() => void reviewAccount(account.id, "rejected")} disabled={reviewingId === account.id} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900 dark:text-rose-200 dark:hover:bg-rose-950/40">
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle size={19} className="mt-0.5 shrink-0" />
          <p><strong>Money movement remains disabled.</strong> Marking a bank account verified is an administrative review only. It does not set it as a default payout destination, debit a wallet, pay a seller, or enable withdrawals. Those flows must be implemented and tested separately after the provider and compliance setup are complete.</p>
        </section>
      </div>
    </main>
  );
}
