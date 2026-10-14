"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, RefreshCw, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PropertyOption = { id: string; title: string; location?: string | null; owner_id?: string | null; submitted_by?: string | null };
type MemberOption = { id: string; full_name: string | null; username?: string | null; role: string };
type RatingRow = { id: string; reviewer_id: string; property_id: string | null; reviewed_user_id: string | null; rating: number; comment: string | null; created_at: string };
const supabase = createClient();

export default function RatingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [target, setTarget] = useState("");
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { router.replace("/login?next=/ratings"); return; }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError || profile?.role !== "admin") {
      router.replace("/");
      return;
    }
    setUserId(authData.user.id);
    const [propertyResult, memberResult, ratingResult] = await Promise.all([
      supabase.from("properties").select("id,title,location,owner_id,submitted_by").limit(100),
      supabase.rpc("spatdel_search_profiles", { search_text: "", role_filter: "all" }),
      supabase.from("spatdel_ratings").select("id,reviewer_id,property_id,reviewed_user_id,rating,comment,created_at").order("created_at", { ascending: false }).limit(150),
    ]);
    if (!propertyResult.error) setProperties((propertyResult.data || []) as PropertyOption[]);
    if (!memberResult.error) setMembers(((memberResult.data || []) as MemberOption[]).filter((member) => member.id !== authData.user?.id && ["agent", "landlord", "chairman"].includes(member.role)));
    if (ratingResult.error) setError("Ratings could not load. Apply the SPATDEL savings and ratings migration first.");
    else setRatings((ratingResult.data || []) as RatingRow[]);
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const targetLabels = useMemo(() => {
    const labels = new Map<string, string>();
    properties.forEach((p) => labels.set("property:" + p.id, p.title + (p.location ? " · " + p.location : "")));
    members.forEach((m) => labels.set("member:" + m.id, (m.full_name || m.username || "SPATDEL member") + " · " + m.role));
    return labels;
  }, [properties, members]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice("");
    if (!target) { setError("Choose a property or member to rate."); return; }
    const [kind, id] = target.split(":");
    const property = kind === "property";
    const chosenProperty = properties.find((p) => p.id === id);
    if (property && chosenProperty && (chosenProperty.owner_id === userId || chosenProperty.submitted_by === userId)) {
      setError("You cannot rate a property you own or submitted."); return;
    }
    const prior = ratings.find((r) => r.reviewer_id === userId && (property ? r.property_id === id : r.reviewed_user_id === id));
    setSending(true);
    const payload = { reviewer_id: userId, property_id: property ? id : null, reviewed_user_id: property ? null : id, rating: score, comment: comment.trim() || null };
    const result = prior
      ? await supabase.from("spatdel_ratings").update({ rating: score, comment: payload.comment }).eq("id", prior.id).eq("reviewer_id", userId)
      : await supabase.from("spatdel_ratings").insert(payload);
    setSending(false);
    if (result.error) { setError(result.error.message.includes("duplicate") ? "You already rated this item. Choose it again to update your rating." : "Could not save the rating. Check the database migration and try again."); return; }
    setNotice(prior ? "Your rating was updated." : "Thanks — your rating was submitted.");
    setComment("");
    await load();
  }

  const average = (key: string) => {
    const [kind, id] = key.split(":");
    const matching = ratings.filter((r) => kind === "property" ? r.property_id === id : r.reviewed_user_id === id);
    return matching.length ? matching.reduce((sum, r) => sum + r.rating, 0) / matching.length : null;
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"><ArrowLeft size={17} /> SPATDEL home</Link><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700"><RefreshCw size={16} /> Refresh</button></div>
        <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 p-7 text-white"><div className="flex items-center gap-3"><Star size={28} /><div><p className="text-sm text-emerald-100">Community trust</p><h1 className="text-3xl font-bold">Ratings & reviews</h1></div></div><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">Share helpful feedback about properties, landlords and agents. Rate honestly and keep comments respectful.</p></section>
        <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <form onSubmit={submit} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold">Leave a rating</h2>
            <label className="mt-4 block text-sm font-semibold">Property or member<select required value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-3 font-normal"><option value="">Choose what to rate</option><optgroup label="Properties">{properties.map((p) => <option key={p.id} value={"property:" + p.id}>{p.title}{p.location ? " — " + p.location : ""}</option>)}</optgroup><optgroup label="Agents, landlords and community chairmen">{members.map((m) => <option key={m.id} value={"member:" + m.id}>{m.full_name || m.username || "SPATDEL member"} ({m.role})</option>)}</optgroup></select></label>
            {target && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">{average(target) === null ? "No ratings yet" : "Current rating: " + average(target)?.toFixed(1) + " / 5"}</div>}
            <p className="mt-4 text-sm font-semibold">Your score</p><div className="mt-2 flex gap-2" role="radiogroup" aria-label="Rating score">{[1,2,3,4,5].map((n) => <button type="button" key={n} onClick={() => setScore(n)} aria-pressed={score === n} aria-label={n + " stars"} className={"rounded-xl border p-2 " + (score >= n ? "border-amber-300 bg-amber-50 text-amber-500" : "border-slate-200 text-slate-400")}><Star size={22} fill={score >= n ? "currentColor" : "none"} /></button>)}</div>
            <label className="mt-4 block text-sm font-semibold">Comment (optional)<textarea maxLength={1000} rows={4} value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 font-normal" placeholder="What should other members know?" /></label>
            {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
            {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}
            <button disabled={sending || !target} className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50">{sending ? "Submitting…" : "Submit rating"}</button>
          </form>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-bold">Recent reviews</h2><p className="mt-1 text-sm text-slate-500">Recent community feedback. Be respectful and factual.</p>{loading ? <p className="py-8 text-center text-slate-500">Loading ratings…</p> : ratings.length === 0 ? <div className="py-10 text-center"><MessageSquare size={30} className="mx-auto text-slate-400" /><p className="mt-3 font-semibold">No reviews yet</p><p className="mt-1 text-sm text-slate-500">Be the first to leave a helpful rating.</p></div> : <div className="mt-4 space-y-3">{ratings.map((r) => { const key = r.property_id ? "property:" + r.property_id : "member:" + r.reviewed_user_id; return <article key={r.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{targetLabels.get(key) || "SPATDEL listing or member"}</p><p className="mt-1 text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</p></div><div className="flex items-center gap-1 text-amber-500"><Star size={16} fill="currentColor" /><strong>{r.rating}/5</strong></div></div>{r.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{r.comment}</p>}</article>; })}</div>}</section>
        </div>
      </div>
    </main>
  );
}
