"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Home,
  LoaderCircle,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ChairmanProfile = {
  id: string;
  full_name: string | null;
  role: string;
};
type Community = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  local_government: string | null;
  state: string | null;
  status: string;
};

const modules = [
  {
    title: "Residents",
    description: "View and manage residents in your assigned community.",
    icon: Users,
    href: "#residents",
  },
  {
    title: "Announcements",
    description: "Share verified notices and important community updates.",
    icon: Bell,
    href: "#announcements",
  },
  {
    title: "Complaints & reports",
    description: "Review community issues and track their progress.",
    icon: ClipboardList,
    href: "#complaints",
  },
  {
    title: "Meetings",
    description: "Organise meetings and publish minutes for residents.",
    icon: CalendarDays,
    href: "#meetings",
  },
  {
    title: "Community information",
    description: "Keep community contacts, rules and public information updated.",
    icon: Building2,
    href: "#community",
  },
  {
    title: "Community services",
    description: "Manage approved local services and useful contacts.",
    icon: ShieldCheck,
    href: "#services",
  },
];

export default function ChairmanDashboard() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [profile, setProfile] = useState<ChairmanProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communityNotice, setCommunityNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", authData.user.id)
        .single();

      if (!active) return;

      if (profileError || !data) {
        setError("We couldn't load your SPATDEL profile. Please try again.");
        setLoading(false);
        return;
      }

      if (data.role !== "chairman") {
        router.replace(data.role === "admin" ? "/admin" : data.role === "agent" || data.role === "landlord" ? "/agent" : "/");
        return;
      }

      setProfile(data as ChairmanProfile);

      const { data: assignments, error: assignmentsError } = await supabase
        .from("community_chairmen")
        .select("community_id")
        .eq("chairman_id", authData.user.id);

      if (!active) return;

      if (assignmentsError) {
        setCommunityNotice("Community assignments are not available yet. Apply the SPATDEL community migration in Supabase.");
      } else if (!assignments?.length) {
        setCommunityNotice("No community has been assigned to your account yet. Ask the SPATDEL admin to assign your community.");
      } else {
        const communityIds = assignments.map((assignment) => assignment.community_id);
        const { data: communityRows, error: communitiesError } = await supabase
          .from("communities")
          .select("id, name, description, address, local_government, state, status")
          .in("id", communityIds);

        if (!active) return;
        if (communitiesError) {
          setCommunityNotice("We could not load your assigned communities.");
        } else {
          setCommunities((communityRows || []) as Community[]);
          setCommunityNotice("");
        }
      }

      setLoading(false);
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
        Loading chairman dashboard…
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="font-semibold text-red-700">{error}</p>
          <button onClick={() => router.refresh()} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-white">Try again</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={() => router.push("/")} className="flex items-center gap-3 text-left">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-700 text-white"><Building2 className="h-6 w-6" /></span>
            <span><span className="block text-xl font-bold tracking-tight">SPATDEL</span><span className="block text-xs text-slate-500">Community chairman portal</span></span>
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold">{profile?.full_name || "Chairman"}</p><p className="text-xs text-slate-500">Community chairman</p></div>
            <button onClick={() => router.push("/community")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><MessageSquare className="h-4 w-4" /><span className="hidden sm:inline">Community chat</span></button>
            <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900 to-emerald-700 p-6 text-white sm:p-8">
          <p className="text-sm font-medium text-emerald-100">CHAIRMAN DASHBOARD</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Welcome, {profile?.full_name?.trim() || "Chairman"}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">Manage your assigned community, communicate with residents and keep local information organised from one place.</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-white/10 px-3 py-1.5 text-xs text-emerald-50"><ShieldCheck className="h-4 w-4" /> Access is limited to your assigned community</div>
        </section>

        <section className="mt-8">
          <div className="mb-4"><h2 className="text-lg font-bold">Community workspace</h2><p className="mt-1 text-sm text-slate-500">Your main tools for community administration.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map(({ title, description, icon: Icon, href }) => (
              <a key={title} href={href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-semibold group-hover:text-emerald-800">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">Open section <span aria-hidden="true">→</span></span>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800" />
              <div><h2 className="font-semibold text-emerald-950">Community Pulse</h2><p className="mt-1 text-sm leading-6 text-emerald-900">Open community discussions and the live room to communicate with SPATDEL members. Your access still depends on your account and the database permissions.</p></div>
            </div>
            <button onClick={() => router.push("/community")} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">Open community chat</button>
          </div>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-5 text-xs text-slate-500">
          <span>SPATDEL · Community management</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-700" /> Community-scoped access design</span>
        </footer>
      </div>
    </main>
  );
}
