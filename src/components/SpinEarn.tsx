"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const rewards = [5000, 10000, 15000, 20000, 25000, 30000];

export default function SpinEarn() {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadReward() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (active) { setError("Please sign in to check your reward."); setLoading(false); }
        return;
      }
      const { data, error: queryError } = await supabase
        .from("tenant_rewards")
        .select("reward_amount")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (!active) return;
      if (queryError) setError("We couldn't load your reward status. Please refresh.");
      else setReward(data?.reward_amount ?? null);
      setLoading(false);
    }
    loadReward();
    return () => { active = false; };
  }, [supabase]);

  async function spin() {
    if (spinning || loading || reward !== null) return;
    setError("");
    setSpinning(true);
    setTurn((current) => current + 1440 + Math.floor(Math.random() * 360));
    const { data, error: spinError } = await supabase.rpc("claim_tenant_spin_reward");
    window.setTimeout(() => setSpinning(false), 2200);
    if (spinError) {
      window.setTimeout(() => setError(spinError.message || "The spin could not be claimed. Please try again."), 2200);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    window.setTimeout(() => setReward(result?.reward_amount ?? null), 2200);
  }

  return (
    <section className="mt-8 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="grid items-center gap-6 sm:grid-cols-[220px_1fr]">
        <div className="flex flex-col items-center">
          <div className="relative h-48 w-48">
            <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 border-x-[12px] border-t-[25px] border-x-transparent border-t-slate-900" />
            <div className="h-full w-full rounded-full border-4 border-slate-900 p-2"
              style={{ transform: `rotate(${turn}deg)`, transition: spinning ? "transform 2.2s cubic-bezier(.12,.8,.18,1)" : "none" }}>
              <div className="relative h-full w-full rounded-full" style={{ background: "conic-gradient(#087b62 0deg 60deg,#f05a00 60deg 120deg,#102f46 120deg 180deg,#19b87a 180deg 240deg,#f05a00 240deg 300deg,#155e75 300deg 360deg)" }}>
                {rewards.map((amount, index) => <span key={amount} className="absolute left-1/2 top-1/2 text-xs font-black text-white" style={{ transform: `translate(-50%,-50%) rotate(${index * 60}deg) translateY(-66px) rotate(-${index * 60}deg)` }}>₦{amount / 1000}K</span>)}
                <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-slate-950 text-[9px] font-black text-emerald-300">SPIN</div>
              </div>
            </div>
          </div>
          <button onClick={spin} disabled={loading || spinning || reward !== null} className="mt-4 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Checking..." : spinning ? "Spinning..." : reward !== null ? "Already claimed" : "Spin & Earn"}</button>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-orange-600">SPATDEL Rewards</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Spin & Earn</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Eligible SPATDEL Users, Agents and Chairmen can claim one lifetime reward.</p>
          <p className="mt-4 text-3xl font-black text-orange-600">{reward !== null ? `₦${reward.toLocaleString("en-NG")}` : "₦5,000–₦30,000"}</p>
          <p className="mt-1 text-xs text-slate-500">{reward !== null ? "Your reward has been recorded on your account." : "One claim per account. Admin accounts are not eligible."}</p>
          {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        </div>
      </div>
    </section>
  );
}
