"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, LoaderCircle, MapPin, Plus, Vote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type EventRow = { id: string; creator_id: string; title: string; description: string; location: string; starts_at: string };
type PollRow = { id: string; creator_id: string; question: string; options: string[]; closes_at: string | null };
type VoteRow = { poll_id: string; voter_id: string; option_index: number };

export default function CommunityActivitiesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);

  const load = useCallback(async () => {
    const [er, pr] = await Promise.all([
      supabase.from("spatdel_community_events").select("id,creator_id,title,description,location,starts_at").order("starts_at").limit(100),
      supabase.from("spatdel_community_polls").select("id,creator_id,question,options,closes_at").order("created_at", { ascending: false }).limit(100),
    ]);
    if (er.error || pr.error) {
      setError("Activities tables are not ready. Apply migration 20261027000000_community_events_and_polls.sql in Supabase SQL Editor.");
      setLoading(false); return;
    }
    const es = (er.data || []) as EventRow[], ps = (pr.data || []) as PollRow[];
    setEvents(es); setPolls(ps);
    if (ps.length) {
      const vr = await supabase.from("spatdel_community_poll_votes").select("poll_id,voter_id,option_index").in("poll_id", ps.map(p => p.id));
      if (!vr.error) setVotes((vr.data || []) as VoteRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) { router.replace("/login?next=/community/activities"); return; }
      setUserId(data.user.id);
    })();
    return () => { active = false; };
  }, [router, supabase]);
  useEffect(() => { if (userId) void load(); }, [userId, load]);

  async function createEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setNotice("");
    if (new Date(eventDate).getTime() <= Date.now()) { setError("Choose a future date and time."); return; }
    setBusy(true);
    const { error: err } = await supabase.from("spatdel_community_events").insert({ creator_id: userId, title: eventTitle.trim(), description: eventDescription.trim(), location: eventLocation.trim(), starts_at: new Date(eventDate).toISOString() });
    setBusy(false);
    if (err) { setError("Event could not be saved. Check the migration is applied."); return; }
    setEventTitle(""); setEventDescription(""); setEventLocation(""); setEventDate(""); setShowEventForm(false); setNotice("Event published."); await load();
  }
  async function createPoll(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setNotice("");
    const options = pollOptions.map(v => v.trim()).filter(Boolean);
    if (options.length < 2 || new Set(options.map(v => v.toLowerCase())).size !== options.length) { setError("Add at least two different options."); return; }
    setBusy(true);
    const { error: err } = await supabase.from("spatdel_community_polls").insert({ creator_id: userId, question: pollQuestion.trim(), options });
    setBusy(false);
    if (err) { setError("Poll could not be saved. Check the migration is applied."); return; }
    setPollQuestion(""); setPollOptions(["", ""]); setShowPollForm(false); setNotice("Poll published."); await load();
  }
  async function vote(poll: PollRow, option_index: number) {
    if (votes.some(v => v.poll_id === poll.id && v.voter_id === userId)) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.from("spatdel_community_poll_votes").insert({ poll_id: poll.id, voter_id: userId, option_index });
    setBusy(false);
    if (err) { setError(err.code === "23505" ? "You have already voted." : "Vote could not be saved."); return; }
    setVotes(v => [...v, { poll_id: poll.id, voter_id: userId, option_index }]); setNotice("Your vote has been counted.");
  }
  const dateLabel = (s: string) => new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return <main className="min-h-screen bg-[#f8f7f2] text-[#102f46]"><header className="sticky top-0 z-20 border-b bg-[#f8f7f2]/95 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3"><button onClick={() => router.push("/community")} className="flex items-center gap-2 text-sm font-bold"><ArrowLeft size={18}/> Community Pulse</button><img src="/spatdel.png" alt="SPATDEL" className="h-9 w-auto"/></div></header>
  <div className="mx-auto max-w-5xl px-4 py-8"><section className="rounded-2xl bg-[#102f46] p-6 text-white sm:p-9"><p className="text-xs font-bold tracking-widest text-[#19e58f]">COMMUNITY HUB</p><h1 className="mt-3 text-3xl font-black">Make things happen together.</h1><p className="mt-3 text-sm text-white/75">Plan meetups, share events, and vote on ideas that matter.</p><div className="mt-5 flex flex-wrap gap-3"><button onClick={() => setShowEventForm(v => !v)} className="flex items-center gap-2 rounded-lg bg-[#19e58f] px-4 py-3 text-sm font-bold text-[#071b18]"><Plus size={16}/> Create event</button><button onClick={() => setShowPollForm(v => !v)} className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 text-sm font-bold"><Vote size={16}/> Create poll</button></div></section>
  {notice && <p role="status" className="mt-4 rounded-lg bg-[#e4f5ee] p-3 text-sm font-bold text-[#087b62]">{notice}</p>}{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
  {showEventForm && <form onSubmit={createEvent} className="mt-5 grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2"><h2 className="text-lg font-black sm:col-span-2">Create event</h2><label className="text-sm font-bold">Title<input required minLength={3} maxLength={120} value={eventTitle} onChange={e=>setEventTitle(e.target.value)} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="text-sm font-bold">Date and time<input required type="datetime-local" value={eventDate} onChange={e=>setEventDate(e.target.value)} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="text-sm font-bold sm:col-span-2">Location / online link<input maxLength={250} value={eventLocation} onChange={e=>setEventLocation(e.target.value)} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="text-sm font-bold sm:col-span-2">Details<textarea maxLength={2000} rows={3} value={eventDescription} onChange={e=>setEventDescription(e.target.value)} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><button disabled={busy} className="rounded-lg bg-[#087b62] p-3 font-bold text-white disabled:opacity-50 sm:col-span-2">{busy?"Saving...":"Publish event"}</button></form>}
  {showPollForm && <form onSubmit={createPoll} className="mt-5 space-y-3 rounded-2xl border bg-white p-5"><h2 className="text-lg font-black">Create poll</h2><label className="block text-sm font-bold">Question<input required minLength={5} maxLength={300} value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>{pollOptions.map((v,i)=><label key={i} className="block text-sm font-bold">Option {i+1}<input maxLength={120} value={v} onChange={e=>setPollOptions(a=>a.map((x,j)=>i===j?e.target.value:x))} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>)}<div className="flex gap-2"><button type="button" disabled={pollOptions.length>=6} onClick={()=>setPollOptions(a=>[...a,""])} className="rounded-lg border px-3 py-2 text-sm font-bold">Add option</button><button type="button" disabled={pollOptions.length<=2} onClick={()=>setPollOptions(a=>a.slice(0,-1))} className="rounded-lg border px-3 py-2 text-sm font-bold">Remove last</button></div><button disabled={busy} className="w-full rounded-lg bg-[#087b62] p-3 font-bold text-white">{busy?"Saving...":"Publish poll"}</button></form>}
  {loading ? <div className="mt-8 flex items-center justify-center gap-3 rounded-xl bg-white p-12"><LoaderCircle className="animate-spin"/> Loading...</div> : <div className="mt-6 grid gap-6 lg:grid-cols-2"><section><h2 className="mb-3 flex items-center gap-2 text-xl font-black"><CalendarDays/> Upcoming events</h2>{events.filter(e=>new Date(e.starts_at).getTime()>=Date.now()).length===0?<p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">No upcoming events yet.</p>:events.filter(e=>new Date(e.starts_at).getTime()>=Date.now()).map(e=><article key={e.id} className="mb-3 rounded-xl border bg-white p-5"><p className="text-xs font-bold text-[#087b62]">{dateLabel(e.starts_at)}</p><h3 className="mt-2 text-lg font-black">{e.title}</h3>{e.location&&<p className="mt-2 flex gap-2 text-sm text-slate-500"><MapPin size={16}/>{e.location}</p>}{e.description&&<p className="mt-3 whitespace-pre-wrap text-sm leading-6">{e.description}</p>}<p className="mt-3 text-[11px] text-slate-500">{e.creator_id===userId?"Created by you":"Community event"}</p></article>)}</section>
  <section><h2 className="mb-3 flex items-center gap-2 text-xl font-black"><Vote/> Community polls</h2>{polls.length===0?<p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">No polls yet. Ask the community what it thinks.</p>:polls.map(p=>{const vs=votes.filter(v=>v.poll_id===p.id);const mine=vs.find(v=>v.voter_id===userId);const closed=!!p.closes_at&&new Date(p.closes_at).getTime()<=Date.now();return <article key={p.id} className="mb-3 rounded-xl border bg-white p-5"><h3 className="font-black">{p.question}</h3><p className="mt-1 text-xs text-slate-500">{vs.length} votes{closed?" · Closed":""}</p><div className="mt-3 space-y-2">{p.options.map((o,i)=>{const n=vs.filter(v=>v.option_index===i).length;const pct=vs.length?Math.round(n/vs.length*100):0;return <button key={i} disabled={busy||!!mine||closed} onClick={()=>void vote(p,i)} className="relative w-full overflow-hidden rounded-lg border p-3 text-left text-sm disabled:cursor-default"><span className="absolute inset-y-0 left-0 bg-[#e4f5ee]" style={{width:mine||closed?pct+"%":"0%"}}/><span className="relative flex justify-between gap-2"><span>{o}{mine?.option_index===i?" ✓ Your vote":""}</span><b>{mine||closed?pct+"%":"Vote"}</b></span></button>})}</div></article>})}</section></div>}
  <p className="mt-8 rounded-xl border bg-white p-4 text-xs leading-5 text-slate-500">Be respectful, avoid sharing private information, and report abusive content in Community Pulse.</p></div></main>;
}
