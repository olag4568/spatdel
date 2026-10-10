"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Clock3, LoaderCircle, MapPin, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Community = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  country: string | null;
  state: string | null;
  local_government: string | null;
  status: string;
};
type Membership = { community_id: string; status: "active" | "pending" | "suspended" };
type JoinRequest = { id: string; community_id: string; requester_id: string; message: string | null; status: "pending" | "approved" | "rejected"; created_at: string };
type RequestView = JoinRequest & { community_name: string; requester_name: string };

export default function CommunitiesPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [incoming, setIncoming] = useState<RequestView[]>([]);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [requesting, setRequesting] = useState("");
  const [reviewing, setReviewing] = useState("");
  const [messageFor, setMessageFor] = useState<Community | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (uid: string, userRole: string) => {
    setError("");
    const { data: communityRows, error: communityError } = await supabase
      .from("communities")
      .select("id, name, description, address, country, state, local_government, status")
      .eq("status", "active")
      .order("name");
    if (communityError) {
      setError("Could not load communities. Run the SPATDEL community migrations in Supabase SQL Editor.");
      setLoading(false);
      return;
    }
    const rows = (communityRows ?? []) as Community[];
    setCommunities(rows);

    const [membershipResult, requestResult, assignmentResult] = await Promise.all([
      supabase.from("community_memberships").select("community_id, status").eq("member_id", uid),
      supabase.from("community_join_requests").select("id, community_id, requester_id, message, status, created_at").eq("requester_id", uid),
      userRole === "chairman" ? supabase.from("community_chairmen").select("community_id").eq("chairman_id", uid) : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (membershipResult.error || requestResult.error) {
      setError("The community directory migration is missing. Apply the latest SPATDEL community migration, then refresh.");
      setLoading(false);
      return;
    }
    setMemberships((membershipResult.data ?? []) as Membership[]);
    setRequests((requestResult.data ?? []) as JoinRequest[]);

    if (userRole === "admin" || userRole === "chairman") {
      const assignedIds = userRole === "admin"
        ? rows.map((community) => community.id)
        : (assignmentResult.data ?? []).map((item: { community_id: string }) => item.community_id);
      if (assignedIds.length) {
        const { data: requestRows, error: incomingError } = await supabase
          .from("community_join_requests")
          .select("id, community_id, requester_id, message, status, created_at")
          .eq("status", "pending")
          .in("community_id", assignedIds)
          .order("created_at", { ascending: true });
        if (!incomingError && requestRows?.length) {
          const pending = requestRows as JoinRequest[];
          const ids = [...new Set(pending.map((item) => item.requester_id))];
          const communityNames = new Map(rows.map((item) => [item.id, item.name]));
          const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", ids);
          const names = new Map((people ?? []).map((item: { id: string; full_name: string | null }) => [item.id, item.full_name || "SPATDEL member"]));
          setIncoming(pending.map((item) => ({ ...item, community_name: communityNames.get(item.community_id) || "Community", requester_name: names.get(item.requester_id) || "SPATDEL member" })));
        } else setIncoming([]);
      } else setIncoming([]);
    } else setIncoming([]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let active = true;
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;
      if (!auth.user) { router.replace("/login?next=/communities"); return; }
      setUserId(auth.user.id);
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
      if (!active) return;
      if (profileError || !profile) { setError("Your SPATDEL profile could not be loaded."); setLoading(false); return; }
      setRole(profile.role || "tenant");
      await load(auth.user.id, profile.role || "tenant");
    }
    void init();
    return () => { active = false; };
  }, [router, supabase, load]);

  const countries = useMemo(() => [...new Set(communities.map((item) => item.country || "Nigeria"))].sort(), [communities]);
  const filtered = useMemo(() => communities.filter((item) => {
    const haystack = [item.name, item.description, item.address, item.country, item.state, item.local_government].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(search.toLowerCase()) && (country === "all" || (item.country || "Nigeria") === country);
  }), [communities, search, country]);

  function stateFor(id: string) {
    const membership = memberships.find((item) => item.community_id === id);
    if (membership?.status === "active") return "member";
    if (membership?.status === "suspended") return "suspended";
    if (membership?.status === "pending") return "pending";
    const request = requests.find((item) => item.community_id === id && item.status === "pending");
    if (request) return "requested";
    return "join";
  }

  async function submitRequest() {
    if (!messageFor || !userId || requesting) return;
    setRequesting(messageFor.id); setError(""); setNotice("");
    const { error: requestError } = await supabase.from("community_join_requests").insert({
      community_id: messageFor.id,
      requester_id: userId,
      message: requestMessage.trim() || null,
    });
    setRequesting("");
    if (requestError) {
      setError(requestError.code === "23505" ? "You already have a request for this community." : "Your request could not be sent. Please try again.");
      return;
    }
    setMessageFor(null); setRequestMessage("");
    setNotice("Join request sent. A community chairman or SPATDEL admin can review it.");
    await load(userId, role);
  }

  async function reviewRequest(request: RequestView, decision: "approved" | "rejected") {
    if (!["admin", "chairman"].includes(role) || reviewing) return;
    setReviewing(request.id); setError(""); setNotice("");
    const { data, error: reviewError } = await supabase.rpc("spatdel_review_community_join_request", {
      target_request_id: request.id,
      decision,
    });
    setReviewing("");
    if (reviewError || data === false) {
      setError("Could not review this request. Check that the latest community membership migration is applied and that you are assigned to this community.");
      return;
    }
    setNotice(decision === "approved" ? "Member approved and added to the community." : "Join request declined.");
    await load(userId, role);
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#102f46]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-[#f8f7f2]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <button onClick={() => router.push("/")} className="inline-flex items-center gap-2 text-sm font-semibold hover:text-emerald-700"><ArrowLeft size={18} /> SPATDEL home</button>
          <img src="/spatdel.png" alt="SPATDEL" className="h-9 w-auto object-contain" />
          <button onClick={() => router.push(role === "chairman" ? "/chairman" : role === "admin" ? "/admin" : "/account")} className="text-sm font-semibold text-emerald-800">Dashboard <ChevronRight className="inline h-4 w-4" /></button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="rounded-3xl bg-gradient-to-br from-[#102f46] to-emerald-900 p-6 text-white sm:p-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-emerald-200"><Users size={14} /> SPATDEL COMMUNITY DIRECTORY</span>
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">Find your community.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">Discover neighbourhoods, request membership, and connect with the people responsible for local updates and community life.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_220px]">
            <label className="flex items-center gap-2 rounded-xl bg-white px-3 text-slate-500"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search community, town, state..." className="w-full bg-transparent py-3 text-sm text-slate-900 outline-none" /></label>
            <select value={country} onChange={(event) => setCountry(event.target.value)} className="rounded-xl border border-white/20 bg-white px-3 py-3 text-sm text-slate-900 outline-none"><option value="all">All countries</option>{countries.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          </div>
        </section>

        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}

        {["admin", "chairman"].includes(role) && incoming.length > 0 && <section className="mt-8 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-700" /><h2 className="text-lg font-bold">Membership requests</h2><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">{incoming.length} pending</span></div>
          <div className="space-y-3">{incoming.map((request) => <article key={request.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
            <div><p className="font-semibold">{request.requester_name}</p><p className="mt-0.5 text-xs text-slate-500">{request.community_name} · {new Date(request.created_at).toLocaleDateString()}</p>{request.message && <p className="mt-2 text-sm text-slate-700">{request.message}</p>}</div>
            <div className="flex gap-2"><button disabled={reviewing === request.id} onClick={() => void reviewRequest(request, "approved")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check size={16} /> Approve</button><button disabled={reviewing === request.id} onClick={() => void reviewRequest(request, "rejected")} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"><X size={16} /> Decline</button></div>
          </article>)}</div>
        </section>}

        <div className="mt-8 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Communities</h2><p className="mt-1 text-sm text-slate-500">{filtered.length} {filtered.length === 1 ? "community" : "communities"} found</p></div>{role === "admin" && <button onClick={() => router.push("/admin")} className="inline-flex items-center gap-2 rounded-xl bg-[#102f46] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} /> Manage communities</button>}</div>

        {loading ? <div className="flex justify-center py-16"><LoaderCircle className="h-6 w-6 animate-spin" /></div> : filtered.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><MapPin className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-3 font-bold">No communities found</h3><p className="mt-1 text-sm text-slate-500">Try another search or check back when more communities are added.</p></div> : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((community) => {
          const state = stateFor(community.id);
          const place = [community.local_government, community.state, community.country || "Nigeria"].filter(Boolean).join(", ");
          return <article key={community.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><MapPin size={20} /></span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Active community</span></div>
            <h3 className="mt-4 text-lg font-bold">{community.name}</h3>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500"><MapPin size={15} className="mt-0.5 shrink-0" />{place || community.address || "Location not provided"}</p>
            <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">{community.description || "A local community on SPATDEL. Request to join to receive neighbourhood updates and connect with members."}</p>
            <div className="mt-5 border-t border-slate-100 pt-4">{state === "member" ? <button onClick={() => router.push(`/communities/${community.id}`)} className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">Open Community Space</button> : state === "pending" || state === "requested" ? <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800"><Clock3 size={16} /> Request pending</div> : state === "suspended" ? <div className="rounded-xl bg-slate-100 px-3 py-2.5 text-center text-sm font-semibold text-slate-600">Membership suspended</div> : <button onClick={() => { setMessageFor(community); setRequestMessage(""); }} className="w-full rounded-xl border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">Request to join</button>}</div>
          </article>;
        })}</div>}

        <p className="mt-8 text-center text-xs leading-5 text-slate-500">Community membership is reviewed by the assigned chairman or SPATDEL administrators. Only active memberships unlock member-only community services.</p>
      </div>

      {messageFor && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMessageFor(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="join-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-3"><div><h2 id="join-title" className="text-xl font-bold">Request membership</h2><p className="mt-1 text-sm text-slate-500">{messageFor.name}</p></div><button onClick={() => setMessageFor(null)} aria-label="Close" className="rounded-lg p-1 hover:bg-slate-100"><X size={20} /></button></div>
          <label className="mt-5 block text-sm font-semibold">Message (optional)<textarea value={requestMessage} onChange={(event) => setRequestMessage(event.target.value.slice(0, 500))} rows={4} placeholder="Introduce yourself or explain why you want to join..." className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-emerald-600" /></label>
          <p className="mt-1 text-right text-xs text-slate-400">{requestMessage.length}/500</p>
          <div className="mt-5 flex justify-end gap-2"><button onClick={() => setMessageFor(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold">Cancel</button><button disabled={!!requesting} onClick={() => void submitRequest()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{requesting ? <LoaderCircle size={16} className="animate-spin" /> : null}Send request</button></div>
        </section>
      </div>}
    </main>
  );
}
