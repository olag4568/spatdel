"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, LoaderCircle, MapPin, MessageCircle, Send, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Community = {
  id: string; name: string; description: string | null; address: string | null;
  country: string | null; state: string | null; local_government: string | null;
};
type ChatMessage = { id: string; community_id: string; author_id: string; body: string; created_at: string };
type Announcement = { id: string; title: string; body: string; published_at: string | null; created_at: string };
type Meeting = { id: string; title: string; details: string | null; starts_at: string; location: string | null; status: string };
type Complaint = { id: string; title: string; description: string; status: string; created_at: string };

type MemberProfile = { id: string; full_name: string | null; username: string | null; role: string | null };

export default function CommunitySpacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const communityId = params.id;
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [community, setCommunity] = useState<Community | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [tab, setTab] = useState<"chat" | "notices" | "meetings" | "complaints">("chat");
  const [draft, setDraft] = useState("");
  const [complaintTitle, setComplaintTitle] = useState("");
  const [complaintDescription, setComplaintDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRoom = useCallback(async () => {
    if (!communityId) return;
    const [chatResult, noticeResult, meetingResult, complaintResult] = await Promise.all([
      supabase.from("community_chat_messages").select("id, community_id, author_id, body, created_at").eq("community_id", communityId).order("created_at", { ascending: true }).limit(150),
      supabase.from("community_announcements").select("id, title, body, published_at, created_at").eq("community_id", communityId).eq("published", true).order("published_at", { ascending: false }).limit(50),
      supabase.from("community_meetings").select("id, title, details, starts_at, location, status").eq("community_id", communityId).order("starts_at", { ascending: true }).limit(50),
      supabase.from("community_complaints").select("id, title, description, status, created_at").eq("community_id", communityId).eq("submitted_by", userId).order("created_at", { ascending: false }).limit(30),
    ]);
    if (chatResult.error) setError("Could not load this community's private chat. Apply the latest SPATDEL community migrations first.");
    else setMessages((chatResult.data ?? []) as ChatMessage[]);
    if (noticeResult.error) console.warn("Community announcements:", noticeResult.error.message);
    else setAnnouncements((noticeResult.data ?? []) as Announcement[]);
    if (meetingResult.error) console.warn("Community meetings:", meetingResult.error.message);
    else setMeetings((meetingResult.data ?? []) as Meeting[]);
    if (!complaintResult.error) setComplaints((complaintResult.data ?? []) as Complaint[]);

    const ids = [...new Set([
      ...((chatResult.data ?? []) as ChatMessage[]).map((item) => item.author_id),
      userId,
    ].filter(Boolean))];
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("id, full_name, username, role").in("id", ids);
      if (data) {
        setNames((current) => ({ ...current, ...Object.fromEntries((data as MemberProfile[]).map((profile) => [
          profile.id, profile.username ? "@" + profile.username.replace(/^@/, "") : profile.full_name || (profile.role === "chairman" ? "Community Chairman" : "SPATDEL member"),
        ])) }));
      }
    }
  }, [communityId, supabase, userId]);

  useEffect(() => {
    let active = true;
    async function start() {
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;
      if (!auth.user) { router.replace("/login?next=" + encodeURIComponent("/communities/" + communityId)); return; }
      setUserId(auth.user.id);
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
      if (!active) return;
      setRole(profile?.role ?? "");
      const { data: communityData, error: communityError } = await supabase.from("communities").select("id, name, description, address, country, state, local_government").eq("id", communityId).maybeSingle();
      if (!active) return;
      if (communityError || !communityData) {
        setError("Community not found, or you do not have permission to view it.");
        setLoading(false);
        return;
      }
      setCommunity(communityData as Community);
      setLoading(false);
    }
    void start();
    return () => { active = false; };
  }, [communityId, router, supabase]);

  useEffect(() => {
    if (!userId || !communityId) return;
    void loadRoom();
    const interval = window.setInterval(() => { void loadRoom(); }, 6000);
    return () => window.clearInterval(interval);
  }, [userId, communityId, loadRoom]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !userId || sending) return;
    setSending(true); setError(""); setNotice("");
    const { error: sendError } = await supabase.from("community_chat_messages").insert({
      community_id: communityId, author_id: userId, body,
    });
    setSending(false);
    if (sendError) { setError("Message could not be sent. You must be an active member or an assigned chairman of this community."); return; }
    setDraft("");
    await loadRoom();
  }

  async function submitComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = complaintTitle.trim();
    const description = complaintDescription.trim();
    if (!title || !description || sending) return;
    setSending(true); setError(""); setNotice("");
    const { error: complaintError } = await supabase.from("community_complaints").insert({
      community_id: communityId, submitted_by: userId, title, description, category: "general",
    });
    setSending(false);
    if (complaintError) { setError("Complaint could not be submitted. You must be an active member of this community."); return; }
    setComplaintTitle(""); setComplaintDescription("");
    setNotice("Your complaint was submitted privately to the community officials.");
    await loadRoom();
  }

  const location = community ? [community.local_government, community.state, community.country].filter(Boolean).join(" · ") : "";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button onClick={() => router.push("/communities")} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-emerald-700"><ArrowLeft size={18} /> Communities</button>
          <button onClick={() => router.push(role === "chairman" ? "/chairman" : role === "admin" ? "/admin" : "/account")} className="text-sm font-semibold text-emerald-800">My dashboard</button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {loading ? <div className="flex min-h-64 items-center justify-center"><LoaderCircle className="animate-spin text-emerald-700" size={28} /></div> : community ? <>
          <section className="rounded-3xl bg-[#102f46] p-6 text-white sm:p-8">
            <div className="flex items-start gap-4"><div className="rounded-2xl bg-white/10 p-3"><Users size={28} /></div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">SPATDEL Community Space</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">{community.name}</h1>{location && <p className="mt-2 flex items-center gap-2 text-sm text-white/75"><MapPin size={15} />{location}</p>}<p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">{community.description || "Connect with residents, read official updates, and keep up with local events."}</p></div></div>
          </section>
          <nav className="mt-6 flex flex-wrap gap-2">{([
            ["chat", "Community chat"], ["notices", "Announcements"], ["meetings", "Meetings"], ["complaints", "My complaints"],
          ] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={"rounded-full px-4 py-2 text-sm font-semibold " + (tab === key ? "bg-emerald-700 text-white" : "border border-slate-300 bg-white text-slate-700")}>{label}</button>)}</nav>
          {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
          {tab === "chat" && <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><MessageCircle className="text-emerald-700" size={20} /><h2 className="font-bold">Private community room</h2><span className="ml-auto text-xs text-slate-500">Updates every few seconds</span></div><div className="max-h-[55vh] min-h-56 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3 sm:p-4">{messages.length ? messages.map((message) => <article key={message.id} className={"max-w-[90%] rounded-xl p-3 " + (message.author_id === userId ? "ml-auto bg-emerald-100" : "bg-white border border-slate-200")}><p className="text-xs font-semibold text-slate-500">{names[message.author_id] || "SPATDEL member"} · {new Date(message.created_at).toLocaleString()}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body}</p></article>) : <p className="py-12 text-center text-sm text-slate-500">No messages yet. Start the conversation for this community.</p>}</div><form onSubmit={sendMessage} className="mt-3 flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 2000))} placeholder="Message your community…" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-emerald-600" /><button disabled={!draft.trim() || sending} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><Send size={16} /> Send</button></form></section>}
          {tab === "notices" && <section className="mt-5 space-y-3">{announcements.length ? announcements.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-bold">{item.title}</h2><ShieldCheck size={18} className="shrink-0 text-emerald-700" /></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.body}</p><p className="mt-3 text-xs text-slate-500">{new Date(item.published_at || item.created_at).toLocaleString()}</p></article>) : <p className="rounded-xl bg-white p-6 text-sm text-slate-500">No announcements have been published yet.</p>}</section>}
          {tab === "meetings" && <section className="mt-5 space-y-3">{meetings.length ? meetings.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold">{item.title}</h2><p className="mt-2 text-sm text-slate-600">{new Date(item.starts_at).toLocaleString()} {item.location ? "· " + item.location : ""}</p>{item.details && <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.details}</p>}<span className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{item.status}</span></article>) : <p className="rounded-xl bg-white p-6 text-sm text-slate-500">No meetings have been scheduled.</p>}</section>}
          {tab === "complaints" && <section className="mt-5 grid gap-5 lg:grid-cols-2"><form onSubmit={submitComplaint} className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Send a private complaint</h2><p className="mt-1 text-sm text-slate-500">Only you and the authorised community officials can view it.</p><label className="mt-4 block text-sm font-semibold">Title<input required value={complaintTitle} onChange={(event) => setComplaintTitle(event.target.value.slice(0, 150))} className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-normal" placeholder="e.g. Streetlight not working" /></label><label className="mt-3 block text-sm font-semibold">Details<textarea required value={complaintDescription} onChange={(event) => setComplaintDescription(event.target.value.slice(0, 3000))} rows={4} className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-normal" placeholder="Describe the issue and where it happened…" /></label><button disabled={sending || !complaintTitle.trim() || !complaintDescription.trim()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{sending ? <LoaderCircle className="animate-spin" size={16} /> : <Send size={16} />}Submit complaint</button></form><div className="space-y-3">{complaints.length ? complaints.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{item.title}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize">{item.status.replace("_", " ")}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.description}</p><p className="mt-3 text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</p></article>) : <p className="rounded-xl bg-white p-5 text-sm text-slate-500">Your submitted complaints will appear here.</p>}</div></section>}
          <p className="mt-8 flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} /> Chat and updates here belong only to {community.name}.</p>
        </> : <section className="rounded-2xl bg-white p-6"><h1 className="text-xl font-bold">Community unavailable</h1><p className="mt-2 text-sm text-slate-600">Return to the directory and choose a community you belong to.</p><button onClick={() => router.push("/communities")} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Back to communities</button></section>}
      </div>
    </main>
  );
}
