"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ChooseLocationPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) {
        router.replace("/login?next=/choose-location");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, selected_community, selected_location, onboarding_completed")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (!active) return;
      if (profileError) {
        setError("Could not load your profile. Make sure the latest SPATDEL location migration has been run in Supabase.");
        setLoading(false);
        return;
      }
      if (profile?.role === "admin") {
        router.replace("/admin");
        return;
      }
      if (profile?.onboarding_completed && profile.selected_location) {
        router.replace("/");
        return;
      }
      setLocation(profile?.selected_location || "");
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router, supabase]);

  async function saveLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanLocation = location.trim();
    if (!cleanLocation) {
      setError("Enter your street or area in Ijegun.");
      return;
    }
    if (cleanLocation.length < 2 || cleanLocation.length > 120) {
      setError("Location must be between 2 and 120 characters.");
      return;
    }
    setSaving(true);
    setError("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setSaving(false);
      router.replace("/login?next=/choose-location");
      return;
    }
    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        selected_community: "Ijegun",
        selected_location: cleanLocation,
        onboarding_completed: true,
      })
      .eq("id", authData.user.id);
    setSaving(false);
    if (saveError) {
      setError("We couldn't save your location. Check that the latest SPATDEL location migration is applied, then try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f8f7f2] text-[#102f46]"><div className="flex items-center gap-3 text-sm font-semibold"><LoaderCircle className="animate-spin" size={20} /> Loading your SPATDEL setup...</div></main>;
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] px-4 py-10 text-[#102f46] sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center justify-between">
          <button onClick={() => router.push("/")} aria-label="SPATDEL home"><img src="/spatdel.png" alt="SPATDEL" className="h-12 w-auto object-contain" /></button>
          <span className="rounded-full bg-[#e4f5ee] px-3 py-1.5 text-xs font-bold text-[#087b62]">Account setup · 1 of 1</span>
        </header>
        <section className="mt-10 overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="bg-[#102f46] px-6 py-8 text-white sm:px-10 sm:py-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#19e58f] text-[#102f46]"><MapPin size={25} /></div>
            <h1 className="mt-5 text-3xl font-black sm:text-4xl">Choose your community</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/75">Tell SPATDEL where you want to find homes and community updates. We are launching in Ijegun first.</p>
          </div>
          <form onSubmit={saveLocation} className="space-y-6 px-6 py-8 sm:px-10 sm:py-10">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#71808a]">Community</label>
              <div className="flex items-center justify-between rounded-xl border border-[#087b62]/30 bg-[#e4f5ee]/60 px-4 py-4">
                <div><p className="font-bold">Ijegun</p><p className="mt-1 text-xs text-[#52636d]">Ikotun axis, Lagos State, Nigeria</p></div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#087b62]">Available now</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#71808a]">SPATDEL will open more communities as the service expands.</p>
            </div>
            <div>
              <label htmlFor="selected-location" className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#71808a]">Street or location within Ijegun</label>
              <input id="selected-location" value={location} onChange={(event) => setLocation(event.target.value)} maxLength={120} required placeholder="Enter your street or area" className="w-full rounded-xl border border-[#102f46]/15 bg-white px-4 py-4 text-sm outline-none transition focus:border-[#087b62] focus:ring-2 focus:ring-[#087b62]/10" />
              <p className="mt-2 text-xs leading-5 text-[#71808a]">Use the street or area you want SPATDEL to prioritise. You can update this later.</p>
            </div>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#087b62] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#06664f] disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? <><LoaderCircle className="animate-spin" size={18} /> Saving location...</> : <>Save and continue <ArrowRight size={18} /></>}
            </button>
            <div className="flex items-start gap-3 rounded-xl bg-[#f8f7f2] p-4"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#087b62]" /><p className="text-xs leading-5 text-[#52636d]">Your selection is saved to your SPATDEL profile. It does not change your account role or grant agent, chairman, or admin permissions.</p></div>
          </form>
        </section>
      </div>
    </main>
  );
}
