"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const rewards = [5000, 10000, 25000, 50000, 75000, 100000];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function nairaFromPoints(points: number) {
  return (points / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 });
}

export default function SpinEarn() {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [spunAt, setSpunAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [turn, setTurn] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;
    async function loadReward() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (active) { setError("Please sign in to earn SPATDEL points."); setLoading(false); }
        return;
      }
      const { data, error: queryError } = await supabase
        .from("tenant_rewards")
        .select("reward_amount, spun_at, points_balance")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (!active) return;
      if (queryError) setError("We couldn't load your points status. Please refresh.");
      else {
        setReward(data?.reward_amount ?? null);
        setSpunAt(data?.spun_at ?? null);
        setPointsBalance(Number(data?.points_balance ?? data?.reward_amount ?? 0));
      }
      setLoading(false);
    }
    loadReward();
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const nextSpinAt = spunAt ? new Date(spunAt).getTime() + WEEK_MS : 0;
  const canSpin = !loading && !spinning && (!spunAt || now >= nextSpinAt);
  const remainingMs = Math.max(0, nextSpinAt - now);
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  const remainingHours = Math.ceil((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  async function spin() {
    if (!canSpin) return;
    setError("");
    setSpinning(true);
    const { data, error: spinError } = await supabase.rpc("claim_tenant_spin_reward");
    if (spinError) {
      setSpinning(false);
      setError(spinError.message?.includes("7 days")
        ? "You have already spun this week. Come back after your 7-day cooldown."
        : spinError.message || "The spin could not be claimed. Please try again.");
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    const wonReward = Number(result?.reward_amount ?? 0);
    const rewardIndex = rewards.indexOf(wonReward);
    if (rewardIndex < 0) {
      setSpinning(false);
      setError("We couldn't confirm the prize selected by the wheel. Please refresh and check your points.");
      return;
    }

    // The fixed pointer is at 12 o'clock. Each prize label's centre is
    // index * 60 degrees clockwise from the top, so rotate that exact
    // segment to the pointer, including the wheel's existing rotation.
    setTurn((current) => {
      const currentMod = ((current % 360) + 360) % 360;
      const extraRotation = (360 - ((currentMod + rewardIndex * 60) % 360)) % 360;
      return current + 1440 + extraRotation;
    });

    window.setTimeout(() => {
      setSpinning(false);
      setReward(wonReward);
      setSpunAt(result?.spun_at ?? new Date().toISOString());
      setPointsBalance(Number(result?.points_balance ?? pointsBalance + wonReward));
    }, 2250);
  }

  return (
    <section className="mt-8 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="grid items-center gap-6 sm:grid-cols-[260px_1fr]">
        <div className="flex flex-col items-center">
          <div className="relative h-56 w-56">
            <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 border-x-[12px] border-t-[25px] border-x-transparent border-t-slate-900" />
            <div className="h-full w-full rounded-full border-4 border-slate-900 p-2"
              style={{ transform: `rotate(${turn}deg)`, transition: spinning ? "transform 2.2s cubic-bezier(.12,.8,.18,1)" : "none" }}>
              <div className="relative h-full w-full rounded-full" style={{ background: "conic-gradient(#087b62 0deg 60deg,#f05a00 60deg 120deg,#102f46 120deg 180deg,#19b87a 180deg 240deg,#f05a00 240deg 300deg,#155e75 300deg 360deg)" }}>
                {rewards.map((amount, index) => <span key={amount} className="absolute left-1/2 top-1/2 text-xs font-black text-white" style={{ transform: `translate(-50%,-50%) rotate(${index * 60}deg) translateY(-78px) rotate(-${index * 60}deg)` }}>{amount / 1000}K</span>)}
                <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-slate-950 text-[10px] font-black text-emerald-300">SPIN</div>
              </div>
            </div>
          </div>
          <button onClick={spin} disabled={!canSpin} className="mt-4 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Checking..." : spinning ? "Spinning..." : !spunAt || now >= nextSpinAt ? "Spin & Earn" : "Come back soon"}
          </button>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-orange-600">SPATDEL Rewards</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Spin & Earn Points</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Eligible SPATDEL Users, Agents and Chairmen can spin once every 7 days. Points can be redeemed only on eligible SPATDEL purchases.</p>
          <p className="mt-4 text-3xl font-black text-orange-600">{pointsBalance.toLocaleString("en-NG")} points</p>
          <p className="mt-1 text-sm font-semibold text-emerald-700">Worth about ₦{nairaFromPoints(pointsBalance)} at 100 points = ₦1</p>
          {reward !== null && <p className="mt-2 text-sm text-slate-600">Last spin: +{reward.toLocaleString("en-NG")} points (about ₦{nairaFromPoints(reward)}).</p>}
          {spunAt && now < nextSpinAt && <p className="mt-2 text-sm font-semibold text-slate-600">Next spin in {remainingDays > 1 ? `${remainingDays} days` : `${Math.max(1, remainingHours)} hours`}. </p>}
          <p className="mt-2 text-xs text-slate-500">Points are not cash and cannot be withdrawn. Redeem them on eligible purchases when checkout support is available.</p>
          {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        </div>
      </div>
    </section>
  );
}
