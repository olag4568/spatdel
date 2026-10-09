"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CircleUserRound,
  LoaderCircle,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "tenant" | "agent" | "landlord" | "admin" | string;
type Profile = { id: string; full_name: string | null; username?: string | null; bio?: string | null; avatar_url?: string | null; role: Role };
type ConversationRow = {
  id: string;
  title: string | null;
  property_id: string | null;
  created_at: string;
  updated_at: string;
};
type ParticipantRow = { conversation_id: string; user_id: string };
type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};
type ConversationView = ConversationRow & {
  otherUserId: string;
  otherName: string;
  otherRole: Role;
};

function roleLabel(role: Role) {
  if (role === "admin") return "Admin";
  if (role === "agent") return "Agent";
  if (role === "landlord") return "Landlord";
  if (role === "tenant") return "Tenant";
  return "SPATDEL member";
}

function displayName(profile: Profile | undefined) {
  return profile?.full_name?.trim() || roleLabel(profile?.role ?? "member");
}

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Keep one browser client for this page; recreating it each render restarts effects.
  const [supabase] = useState(() => createClient());

  const [currentUserId, setCurrentUserId] = useState("");
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [directoryPeople, setDirectoryPeople] = useState<Profile[]>([]);
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [newChatTargetId, setNewChatTargetId] = useState("");
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [handledProfileTarget, setHandledProfileTarget] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadConversations = useCallback(async (userId: string) => {
    const { data: memberships, error: membershipError } = await supabase
      .from("spatdel_chat_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    if (membershipError) {
      setError("Chat database is not ready yet. Run the SPATDEL chat migration in Supabase SQL Editor.");
      setConversations([]);
      return;
    }

    const ids = Array.from(new Set((memberships ?? []).map((row) => row.conversation_id as string)));
    if (ids.length === 0) {
      setConversations([]);
      return;
    }

    const [chatResult, participantResult] = await Promise.all([
      supabase
        .from("spatdel_chat_conversations")
        .select("id, title, property_id, created_at, updated_at")
        .in("id", ids)
        .order("updated_at", { ascending: false }),
      supabase
        .from("spatdel_chat_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", ids),
    ]);

    if (chatResult.error || participantResult.error) {
      setError(chatResult.error?.message ?? participantResult.error?.message ?? "Could not load conversations.");
      return;
    }

    const profileMap = new Map(people.map((person) => [person.id, person]));
    const participantRows = (participantResult.data ?? []) as ParticipantRow[];
    const view: ConversationView[] = ((chatResult.data ?? []) as ConversationRow[]).map((chat) => {
      const otherId = participantRows.find((p) => p.conversation_id === chat.id && p.user_id !== userId)?.user_id ?? "";
      const otherProfile = profileMap.get(otherId);
      return {
        ...chat,
        otherUserId: otherId,
        otherName: displayName(otherProfile),
        otherRole: otherProfile?.role ?? "member",
      };
    });

    setConversations(view);
  }, [people, supabase]);

  useEffect(() => {
    let active = true;

    async function initialise() {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(authData.user.id);

      const [myResult, peopleResult] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role").eq("id", authData.user.id).single(),
        supabase.rpc("spatdel_search_profiles", { search_text: "", role_filter: "all" }),
      ]);

      if (!active) return;

      if (myResult.error || !myResult.data) {
        setError("Could not load your SPATDEL profile.");
        setLoading(false);
        return;
      }

      setMyProfile(myResult.data as Profile);
      const loadedPeople = (peopleResult.data ?? []) as Profile[];
      setPeople(loadedPeople);
      setDirectoryPeople(loadedPeople);
      setLoading(false);

      // loadConversations uses the latest profile directory, so load after setting it too.
      const { data: memberships, error: membershipError } = await supabase
        .from("spatdel_chat_participants")
        .select("conversation_id")
        .eq("user_id", authData.user.id);

      if (!active) return;

      if (membershipError) {
        setError("Chat database is not ready yet. Run the SPATDEL chat migration in Supabase SQL Editor.");
        return;
      }

      const ids = Array.from(new Set((memberships ?? []).map((row) => row.conversation_id as string)));
      if (ids.length === 0) {
        setConversations([]);
        return;
      }

      const [chatResult, participantResult] = await Promise.all([
        supabase.from("spatdel_chat_conversations").select("id, title, property_id, created_at, updated_at").in("id", ids).order("updated_at", { ascending: false }),
        supabase.from("spatdel_chat_participants").select("conversation_id, user_id").in("conversation_id", ids),
      ]);

      if (!active) return;

      if (chatResult.error || participantResult.error) {
        setError(chatResult.error?.message ?? participantResult.error?.message ?? "Could not load conversations.");
        return;
      }

      const profileMap = new Map(((peopleResult.data ?? []) as Profile[]).map((person) => [person.id, person]));
      const participantRows = (participantResult.data ?? []) as ParticipantRow[];
      const view: ConversationView[] = ((chatResult.data ?? []) as ConversationRow[]).map((chat) => {
        const otherId = participantRows.find((p) => p.conversation_id === chat.id && p.user_id !== authData.user.id)?.user_id ?? "";
        const otherProfile = profileMap.get(otherId);
        return { ...chat, otherUserId: otherId, otherName: displayName(otherProfile), otherRole: otherProfile?.role ?? "member" };
      });

      setConversations(view);
    }

    initialise();
    return () => { active = false; };
  }, [router, supabase]);

  // Allow a profile's Message button to open this page with a target user.
  useEffect(() => {
    const targetId = searchParams.get("user");
    if (!targetId || !currentUserId || handledProfileTarget === targetId) return;

    let active = true;
    async function openTarget() {
      const existing = people.find((person) => person.id === targetId);
      if (existing) {
        setHandledProfileTarget(targetId);
        choosePerson(existing);
        router.replace("/messages");
        return;
      }

      // A member can have a profile link even when they are beyond the directory's initial page.
      const { data, error: targetError } = await supabase.rpc(
        "spatdel_get_public_profile",
        { target_profile_id: targetId }
      );
      if (!active) return;
      const target = (data ?? [])[0] as Profile | undefined;
      if (targetError || !target) {
        setError("Could not open this member for messaging. Please try searching for them in the directory.");
        router.replace("/messages");
        return;
      }

      setPeople((current) => current.some((person) => person.id === target.id) ? current : [...current, target]);
      setDirectoryPeople((current) => current.some((person) => person.id === target.id) ? current : [...current, target]);
      setHandledProfileTarget(targetId);
      choosePerson(target);
      router.replace("/messages");
    }

    void openTarget();
    return () => { active = false; };
  }, [currentUserId, handledProfileTarget, people, router, searchParams, supabase]);

  // Search the secure server-side directory so results do not depend on direct
  // SELECT permissions for the profiles table.
  useEffect(() => {
    if (!currentUserId || !directoryOpen) return;

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      const { data, error: directoryError } = await supabase.rpc(
        "spatdel_search_profiles",
        { search_text: search.trim(), role_filter: roleFilter }
      );

      if (!active) return;

      if (directoryError) {
        setError("Could not search SPATDEL members. Please run the chat profile directory migration in Supabase.");
        return;
      }

      setDirectoryPeople((data ?? []) as Profile[]);
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [currentUserId, directoryOpen, roleFilter, search, supabase]);

  useEffect(() => {
    let active = true;

    async function loadMessages() {
      if (!activeConversationId || !currentUserId) {
        setMessages([]);
        setLoadingMessages(false);
        return;
      }

      setLoadingMessages(true);
      const { data, error: messageError } = await supabase
        .from("spatdel_chat_messages")
        .select("id, conversation_id, sender_id, body, created_at, read_at")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (messageError) {
        setError(messageError.message);
      } else {
        setMessages((data ?? []) as MessageRow[]);
        await supabase
          .from("spatdel_chat_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("conversation_id", activeConversationId)
          .neq("sender_id", currentUserId)
          .is("read_at", null);
      }

      setLoadingMessages(false);
    }

    loadMessages();
    return () => { active = false; };
  }, [activeConversationId, currentUserId, supabase]);


  // Keep incoming messages and the conversation list fresh without requiring a page reload.
  useEffect(() => {
    if (!currentUserId) return;

    const intervalId = window.setInterval(() => {
      void loadConversations(currentUserId);
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [currentUserId, loadConversations]);

  // Poll the open conversation for incoming messages and read receipts.
  // This works even if Supabase Realtime has not been enabled for these tables.
  useEffect(() => {
    if (!activeConversationId || !currentUserId) return;

    let active = true;

    async function pollOpenConversation() {
      const { data, error: pollError } = await supabase
        .from("spatdel_chat_messages")
        .select("id, conversation_id, sender_id, body, created_at, read_at")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (pollError) {
        setError(pollError.message);
        return;
      }

      const latestMessages = (data ?? []) as MessageRow[];
      setMessages((current) => {
        if (
          current.length === latestMessages.length &&
          current.every((message, index) =>
            message.id === latestMessages[index]?.id &&
            message.read_at === latestMessages[index]?.read_at
          )
        ) {
          return current;
        }
        return latestMessages;
      });

      const { error: readError } = await supabase
        .from("spatdel_chat_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", activeConversationId)
        .neq("sender_id", currentUserId)
        .is("read_at", null);

      if (active && readError) setError(readError.message);
    }

    const intervalId = window.setInterval(() => {
      void pollOpenConversation();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [activeConversationId, currentUserId, supabase]);

  async function refresh() {
    if (!currentUserId) return;
    setError("");
    await loadConversations(currentUserId);
  }

  function choosePerson(person: Profile) {
    const existing = conversations.find((chat) => chat.otherUserId === person.id && !chat.property_id);
    setDirectoryOpen(false);
    setSearch("");
    setError("");
    if (existing) {
      setNewChatTargetId("");
      setActiveConversationId(existing.id);
      return;
    }
    setMessages([]);
    setActiveConversationId("");
    setNewChatTargetId(person.id);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending || !currentUserId) return;

    setError("");
    setNotice("");
    setSending(true);

    try {
      let conversationId = activeConversationId;

      if (!conversationId) {
        if (!newChatTargetId) {
          setError("Choose a person to start a new chat.");
          setSending(false);
          return;
        }

        const { data, error: startError } = await supabase.rpc("spatdel_start_chat", {
          target_user_id: newChatTargetId,
          related_property_id: null,
          first_message: body,
        });

        if (startError) throw new Error(startError.message);
        conversationId = data as string;
        setActiveConversationId(conversationId);
        setNewChatTargetId("");
      } else {
        const { data, error: insertError } = await supabase
          .from("spatdel_chat_messages")
          .insert({ conversation_id: conversationId, sender_id: currentUserId, body })
          .select("id, conversation_id, sender_id, body, created_at, read_at")
          .single();

        if (insertError) throw new Error(insertError.message);
        setMessages((current) => [...current, data as MessageRow]);
      }

      setDraft("");
      await loadConversations(currentUserId);
      if (!activeConversationId && conversationId) {
        const { data: latestMessages } = await supabase
          .from("spatdel_chat_messages")
          .select("id, conversation_id, sender_id, body, created_at, read_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });
        setMessages((latestMessages ?? []) as MessageRow[]);
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  const activeChat = conversations.find((chat) => chat.id === activeConversationId);
  const newChatPerson = people.find((person) => person.id === newChatTargetId);
  const activeOther = activeChat
    ? people.find((person) => person.id === activeChat.otherUserId)
    : newChatPerson;
  const filteredPeople = directoryPeople.filter((person) => {
    const query = search.trim().toLowerCase();
    const cleanQuery = query.replace(/^@/, "");
    const matchesName = !query || displayName(person).toLowerCase().includes(query) || (person.username ?? "").toLowerCase().includes(cleanQuery);
    const matchesRole = roleFilter === "all" || person.role.toLowerCase() === roleFilter;
    return matchesName && matchesRole;
  });

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f8f7f2] text-[#102f46]"><LoaderCircle className="animate-spin" size={30} /></main>;
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#102f46]">
      <header className="border-b border-[#102f46]/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <img src="/spatdel.png" alt="SPATDEL" className="h-11 w-auto object-contain" />
            <div><p className="font-bold">SPATDEL Messages</p><p className="text-xs text-[#687987]">Signed in as {roleLabel(myProfile?.role ?? "member")}</p></div>
          </div>
          <button onClick={() => router.push("/")} className="inline-flex items-center gap-2 rounded-full border border-[#d5dde2] px-4 py-2 text-sm font-semibold hover:bg-[#f5f7f8]"><ArrowLeft size={16} /> Home</button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-7">
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</div>}

        <div className="grid min-h-[72vh] overflow-hidden rounded-3xl border border-[#dce3e7] bg-white shadow-sm md:grid-cols-[320px_minmax(0,1fr)]">
          <aside className={`border-b border-[#dce3e7] md:border-b-0 md:border-r ${directoryOpen ? "block" : "hidden md:block"}`}>
            <div className="flex items-center justify-between border-b border-[#edf0f2] p-4">
              <div><h1 className="text-lg font-bold">Your chats</h1><p className="text-xs text-[#687987]">{conversations.length} conversation{conversations.length === 1 ? "" : "s"}</p></div>
              <button onClick={() => { setDirectoryOpen((open) => !open); setNewChatTargetId(""); setSearch(""); }} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#102f46] text-white hover:bg-[#183d57]" aria-label="Start new chat"><Plus size={20} /></button>
            </div>

            {directoryOpen ? (
              <div className="p-3">
                <div className="relative"><Search size={16} className="absolute left-3 top-3 text-[#8a969f]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by profile name" className="w-full rounded-xl border border-[#d5dde2] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#087b62]" /></div>
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter SPATDEL members by role" className="mt-2 w-full rounded-xl border border-[#d5dde2] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#087b62]">
                  <option value="all">Everyone on SPATDEL</option>
                  <option value="tenant">Tenants</option>
                  <option value="agent">Agents</option>
                  <option value="landlord">Landlords</option>
                  <option value="admin">Admins</option>
                </select>
                <p className="px-1 pb-2 pt-4 text-xs font-bold uppercase tracking-wide text-[#8a969f]">SPATDEL member profiles</p>
                <div className="max-h-[55vh] space-y-1 overflow-y-auto">
                  {filteredPeople.map((person) => (
                    <div key={person.id} className="flex items-center gap-2 rounded-xl p-2 transition hover:bg-[#f5f7f8]">
                      <button onClick={() => router.push(`/profile/${person.id}`)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left" aria-label={`View ${displayName(person)}'s profile`}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8f0f4] text-[#102f46]">{person.avatar_url ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover" /> : <CircleUserRound size={20} />}</div>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{displayName(person)}</p><p className="mt-0.5 truncate text-xs text-[#687987]">{person.username ? `@${person.username}` : roleLabel(person.role)}</p><p className="mt-0.5 text-xs text-[#087b62]">{roleLabel(person.role)} · View profile</p></div>
                      </button>
                      <button onClick={() => choosePerson(person)} className="shrink-0 rounded-full bg-[#102f46] px-3 py-2 text-xs font-bold text-white hover:bg-[#183d57]">Message</button>
                    </div>
                  ))}
                  {filteredPeople.length === 0 && <p className="p-4 text-sm text-[#687987]">No matching users found.</p>}
                </div>
              </div>
            ) : (
              <div className="max-h-[65vh] overflow-y-auto p-2">
                {conversations.map((chat) => (
                  <button key={chat.id} onClick={() => { setNewChatTargetId(""); setActiveConversationId(chat.id); setDirectoryOpen(false); setError(""); }} className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${activeConversationId === chat.id ? "bg-[#e8f4ed]" : "hover:bg-[#f5f7f8]"}`}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8f0f4]">{people.find((person) => person.id === chat.otherUserId)?.avatar_url ? <img src={people.find((person) => person.id === chat.otherUserId)?.avatar_url ?? ""} alt="" className="h-full w-full object-cover" /> : <CircleUserRound size={21} />}</div>
                    <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold">{chat.otherName}</p><span className="text-[10px] text-[#8a969f]">{new Date(chat.updated_at).toLocaleDateString("en-NG")}</span></div><p className="mt-1 text-xs font-semibold text-[#087b62]">{roleLabel(chat.otherRole)}</p><p className="mt-1 truncate text-xs text-[#8a969f]">{chat.title || "Direct message"}</p></div>
                  </button>
                ))}
                {conversations.length === 0 && <div className="p-6 text-center"><MessageCircle className="mx-auto text-[#9aa7af]" size={26} /><p className="mt-3 text-sm font-bold">No chats yet</p><p className="mt-1 text-xs leading-5 text-[#687987]">Start a conversation with a tenant, agent, landlord, or admin.</p><button onClick={() => setDirectoryOpen(true)} className="mt-4 rounded-full bg-[#102f46] px-4 py-2 text-xs font-bold text-white">Start a chat</button></div>}
                <button onClick={refresh} className="mx-2 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#687987] hover:bg-[#f5f7f8]"><RefreshCw size={13} /> Refresh chats</button>
              </div>
            )}
          </aside>

          <div className={`flex min-h-[68vh] flex-col ${directoryOpen ? "hidden md:flex" : "flex"}`}>
            {(activeChat || newChatPerson) ? (
              <>
                <div className="flex items-center gap-3 border-b border-[#edf0f2] px-4 py-4 sm:px-6">
                  <button onClick={() => { setActiveConversationId(""); setNewChatTargetId(""); setDirectoryOpen(true); }} className="rounded-lg p-2 hover:bg-[#f5f7f8] md:hidden" aria-label="Back to chats"><ArrowLeft size={17} /></button>
                  <button onClick={() => { const targetId = activeChat?.otherUserId ?? newChatPerson?.id; if (targetId) router.push(`/profile/${targetId}`); }} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8f0f4] hover:ring-2 hover:ring-[#087b62]" aria-label="Open this person's profile">{activeOther?.avatar_url ? <img src={activeOther.avatar_url} alt="" className="h-full w-full object-cover" /> : <CircleUserRound size={22} />}</button>
                  <button onClick={() => { const targetId = activeChat?.otherUserId ?? newChatPerson?.id; if (targetId) router.push(`/profile/${targetId}`); }} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-bold hover:underline">{activeChat?.otherName ?? displayName(newChatPerson)}</p><p className="mt-0.5 truncate text-xs text-[#687987]">{activeOther?.username ? `@${activeOther.username}` : roleLabel(activeChat?.otherRole ?? newChatPerson?.role ?? "member")}</p><p className="mt-0.5 text-xs font-semibold text-[#087b62]">{roleLabel(activeChat?.otherRole ?? newChatPerson?.role ?? "member")} · View profile</p>
                  </button>
                  <span className="hidden items-center gap-1 rounded-full bg-[#f5f7f8] px-3 py-1.5 text-[10px] font-bold text-[#687987] sm:inline-flex"><ShieldCheck size={13} /> Role verified from profile</span>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto bg-[#fafbfb] p-4 sm:p-6">
                  {loadingMessages ? <div className="flex justify-center py-10"><LoaderCircle className="animate-spin text-[#087b62]" size={24} /></div> : messages.length === 0 ? <div className="flex h-full min-h-48 flex-col items-center justify-center text-center"><MessageCircle size={32} className="text-[#9aa7af]" /><p className="mt-3 font-bold">Start the conversation</p><p className="mt-1 max-w-xs text-xs leading-5 text-[#687987]">Be respectful and confirm property details before making payments.</p></div> : messages.map((message) => {
                    const own = message.sender_id === currentUserId;
                    const sender = own ? myProfile : people.find((person) => person.id === message.sender_id);
                    return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%] ${own ? "rounded-br-md bg-[#102f46] text-white" : "rounded-bl-md border border-[#e1e7ea] bg-white text-[#102f46]"}`}><div className="mb-2 flex items-center gap-2"><span className={`text-[10px] font-bold ${own ? "text-[#c5d3dc]" : "text-[#087b62]"}`}>{own ? "You" : displayName(sender)}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${own ? "bg-white/10 text-[#d4dfe5]" : "bg-[#f0f4f5] text-[#687987]"}`}>{roleLabel(sender?.role ?? "member")}</span></div><p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p><div className={`mt-2 flex items-center justify-end gap-1 text-[10px] ${own ? "text-[#c5d3dc]" : "text-[#8a969f]"}`}>{new Date(message.created_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}{own && message.read_at && <Check size={12} />}</div></div></div>;
                  })}
                </div>

                <form onSubmit={sendMessage} className="border-t border-[#edf0f2] bg-white p-3 sm:p-5">
                  <div className="flex items-end gap-2 rounded-2xl border border-[#d5dde2] bg-[#fafbfb] p-2 focus-within:border-[#087b62]">
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={4000} rows={2} placeholder="Write a message..." className="max-h-36 min-h-11 flex-1 resize-y bg-transparent px-2 py-2 text-sm outline-none" />
                    <button type="submit" disabled={!draft.trim() || sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#087b62] text-white transition hover:bg-[#066b55] disabled:cursor-not-allowed disabled:opacity-50" aria-label="Send message">{sending ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}</button>
                  </div>
                  <p className="mt-2 text-[10px] text-[#8a969f]">Maximum 4,000 characters. Never share passwords or verification codes.</p>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f4ed] text-[#087b62]"><Users size={29} /></div>
                <h2 className="mt-5 text-xl font-bold">Chat with anyone on SPATDEL</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#687987]">Tenants, agents, landlords, and admins can message each other. Each message shows the sender's profile role.</p>
                <button onClick={() => setDirectoryOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#102f46] px-5 py-3 text-sm font-bold text-white"><Plus size={16} /> New chat</button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}


export default function MessagesPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#f8f7f2] text-[#102f46]">Loading messages...</main>}>
      <MessagesContent />
    </Suspense>
  );
}
