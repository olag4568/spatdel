"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Wallet as WalletIcon,
  AlertTriangle,
} from "lucide-react";

type WalletRow = {
  id: string;
  user_id: string;
  currency: string;
  status: "active" | "frozen" | "closed";
  created_at: string;
};

type LedgerRow = {
  id: string;
  wallet_id: string;
  transaction_id: string | null;
  entry_type: string;
  direction: "credit" | "debit";
  amount_kobo: number;
  currency: string;
  provider_reference: string | null;
  note: string | null;
  created_at: string;
};

type TransactionRow = {
  id: string;
  property_id: string;
  buyer_id: string;
  seller_id: string;
  purpose: "rent" | "sale";
  gross_amount_kobo: number;
  service_fee_kobo: number;
  seller_net_kobo: number;
  status: string;
  created_at: string;
};

type KycRow = {
  status: "not_started" | "pending" | "verified" | "rejected" | "needs_review";
  updated_at: string;
};

const supabase = createClient();
const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format((Number(kobo) || 0) / 100);

const dateLabel = (value: string) =>
  new Date(value).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [kyc, setKyc] = useState<KycRow | null>(null);

  const loadWallet = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        window.location.href = "/login?next=/wallet";
        return;
      }
      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      const admin = profile?.role === "admin";
      setIsAdmin(admin);

      const walletQuery = supabase
        .from("spatdel_wallets")
        .select("id,user_id,currency,status,created_at")
        .order("created_at", { ascending: false });
      if (!admin) walletQuery.eq("user_id", user.id);

      const [{ data: walletData, error: walletError }, { data: kycData, error: kycError }, { data: transactionData, error: transactionError }] =
        await Promise.all([
          walletQuery,
          supabase
            .from("spatdel_kyc_profiles")
            .select("status,updated_at")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("spatdel_property_transactions")
            .select("id,property_id,buyer_id,seller_id,purpose,gross_amount_kobo,service_fee_kobo,seller_net_kobo,status,created_at")
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

      if (walletError) throw walletError;
      if (kycError) throw kycError;
      if (transactionError) throw transactionError;

      const walletRows = (walletData || []) as WalletRow[];
      setWallets(walletRows);
      setKyc((kycData as KycRow | null) ?? null);
      setTransactions((transactionData || []) as TransactionRow[]);

      const walletIds = walletRows.map((wallet) => wallet.id);
      if (walletIds.length) {
        const { data: ledgerData, error: ledgerError } = await supabase
          .from("spatdel_wallet_ledger")
          .select("id,wallet_id,transaction_id,entry_type,direction,amount_kobo,currency,provider_reference,note,created_at")
          .in("wallet_id", walletIds)
          .order("created_at", { ascending: false })
          .limit(100);
        if (ledgerError) throw ledgerError;
        setLedger((ledgerData || []) as LedgerRow[]);
      } else {
        setLedger([]);
      }
    } catch (caught) {
      console.error("Failed to load SPATDEL wallet:", caught);
      setError("We could not load your wallet. Confirm the SPATDEL wallet migration has been applied, then refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const balances = useMemo(() => {
    const result = new Map<string, number>();
    for (const entry of ledger) {
      const amount = Number(entry.amount_kobo) || 0;
      result.set(
        entry.wallet_id,
        (result.get(entry.wallet_id) || 0) + (entry.direction === "credit" ? amount : -amount)
      );
    }
    return result;
  }, [ledger]);

  const ownWallet = wallets.find((wallet) => wallet.user_id === userId);

  async function requestKycReview() {
    if (!userId || !kyc || kyc.status === "verified" || kyc.status === "pending") return;
    setSubmittingKyc(true);
    setError("");
    setNotice("");
    try {
      const { error: updateError } = await supabase
        .from("spatdel_kyc_profiles")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (updateError) throw updateError;
      setNotice("KYC review requested. Identity verification must be completed through SPATDEL's approved verification provider before money movement is enabled.");
      await loadWallet(true);
    } catch (caught) {
      console.error("Could not request KYC review:", caught);
      setError("Could not submit the KYC request. Apply the latest SPATDEL wallet migration and try again.");
    } finally {
      setSubmittingKyc(false);
    }
  }

  const kycLabel = kyc?.status ? kyc.status.replaceAll("_", " ") : "not started";
  const canRequestKyc = !!kyc && !["verified", "pending"].includes(kyc.status);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
            <ArrowLeft size={17} /> Back to SPATDEL
          </Link>
          <button onClick={() => void loadWallet(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <section className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-300">{isAdmin ? "Admin wallet oversight" : "My SPATDEL wallet"}</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Wallet & transactions</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                SPATDEL currently serves Ijegun, Ikotun, Lagos State. Your balance is calculated from confirmed ledger entries; pending payments are not treated as completed funds.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3"><WalletIcon size={28} /></div>
          </div>
          {error && <div role="alert" className="mt-5 rounded-xl border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div>}
          {notice && <div role="status" className="mt-5 rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{notice}</div>}
        </section>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">Loading wallet…</div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(isAdmin ? wallets : wallets.filter((wallet) => wallet.user_id === userId)).map((wallet) => (
                <article key={wallet.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{wallet.user_id === userId ? "Your available ledger balance" : "User wallet"}</span>
                    <WalletIcon size={19} className="text-indigo-600" />
                  </div>
                  <p className="mt-3 text-2xl font-bold">{naira(balances.get(wallet.id) || 0)}</p>
                  <p className="mt-2 break-all text-xs text-slate-500">Wallet ID: {wallet.id}</p>
                  <p className="mt-2 text-xs capitalize text-slate-500">Status: {wallet.status} · {wallet.currency}</p>
                </article>
              ))}
              {!isAdmin && !ownWallet && (
                <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  <AlertTriangle className="mb-2" size={20} />
                  Your wallet record has not appeared yet. An admin should check that the wallet migration ran successfully.
                </article>
              )}
            </section>

            <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-indigo-600" size={23} />
                  <div>
                    <h2 className="font-bold">Identity verification (KYC)</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Required before deposits or withdrawals.</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-2">
                  {kyc?.status === "verified" ? <BadgeCheck className="text-emerald-600" size={20} /> : <Clock3 className="text-amber-600" size={20} />}
                  <span className="text-sm font-semibold capitalize">{kycLabel}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  This page only records your request for review. It does not collect identity documents or approve KYC by itself; verification must be completed by an approved provider and trusted server process.
                </p>
                {kyc?.status === "pending" && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Your request is pending review.</p>}
                {kyc?.status === "verified" && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">Your identity status is verified. Payment actions will still remain disabled until SPATDEL's payment provider is configured.</p>}
                {canRequestKyc && <button onClick={() => void requestKycReview()} disabled={submittingKyc} className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{submittingKyc ? "Submitting…" : "Request KYC review"}</button>}
                {!kyc && <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">KYC status is unavailable. Apply the database migration first.</p>}
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <h2 className="font-bold">Recent ledger activity</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Only confirmed entries affect the displayed balance.</p>
                <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {ledger.length === 0 && <p className="py-6 text-sm text-slate-500">No ledger activity yet. Deposits and withdrawals will be enabled after payment-provider setup.</p>}
                  {ledger.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold capitalize">{entry.entry_type.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-xs text-slate-500">{dateLabel(entry.created_at)}{entry.provider_reference ? ` · Ref: ${entry.provider_reference}` : ""}</p>
                      </div>
                      <p className={`shrink-0 text-sm font-bold ${entry.direction === "credit" ? "text-emerald-600" : "text-rose-600"}`}>{entry.direction === "credit" ? "+" : "−"}{naira(entry.amount_kobo)}</p>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-bold">{isAdmin ? "All property transactions" : "My property transactions"}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Rent and sale transactions, including service-fee records and review status.</p>
                </div>
                {isAdmin && <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">Admin monitoring</span>}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800"><th className="px-3 py-3">Reference</th><th className="px-3 py-3">Purpose</th><th className="px-3 py-3">Gross amount</th><th className="px-3 py-3">SPATDEL fee</th><th className="px-3 py-3">Seller net</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Date</th></tr></thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="px-3 py-3 font-mono text-xs">{transaction.id.slice(0, 8).toUpperCase()}</td>
                        <td className="px-3 py-3 capitalize">{transaction.purpose}</td>
                        <td className="px-3 py-3">{naira(transaction.gross_amount_kobo)}</td>
                        <td className="px-3 py-3">{naira(transaction.service_fee_kobo)}</td>
                        <td className="px-3 py-3">{naira(transaction.seller_net_kobo)}</td>
                        <td className="px-3 py-3"><span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs capitalize dark:bg-slate-800">{transaction.status.replaceAll("_", " ")}</span></td>
                        <td className="px-3 py-3 whitespace-nowrap text-xs text-slate-500">{dateLabel(transaction.created_at)}</td>
                      </tr>
                    ))}
                    {transactions.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No transactions to display yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="flex items-start gap-2"><AlertTriangle size={18} className="mt-1 shrink-0" /><p><strong>Payments are not live yet.</strong> Do not send money to an admin's personal account. Deposits, escrow/collection, refunds and seller payouts must be processed and reconciled through an approved provider and trusted server-side webhooks. This dashboard is the first UI layer, not a live-money transfer system.</p></div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
