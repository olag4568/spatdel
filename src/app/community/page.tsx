"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Clock3, ImagePlus, LoaderCircle, MessageCircle, MessagesSquare, Send, ShieldAlert, Users, X } from "lucide-react";

type Profile = { id: string; full_name?: string | null; username?: string | null; role?: string | null; avatar_url?: string | null };
type Post = { id: string; author_id: string; body: string; image_url?: string | null; created_at: string };
type Comment = { id: string; post_id: string; author_id: string; body: string; created_at: string };
type ChatMessage = { id: string; author_id: string; body: string; created_at: string };

export default function CommunityPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [expandedPost, setExpandedPost] = useState("");
  const [postDraft, setPostDraft] = useState("");
  const [postImage, setPostImage] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [chatDraft, setChatDraft] = useState("");
  const [tab, setTab] = useState<"posts" | "chat">("posts");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadProfiles = useCallback(async (ids: string[]) => {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return;
    const { data } = await supabase.from("profiles").select("id, full_name, username, role, avatar_url").in("id", unique);
    if (data) setProfiles((current) => ({ ...current, ...Object.fromEntries(data.map((p) => [p.id, p as Profile])) }));
  }, []);

  const loadPosts = useCallback(async () => {
    const { data, error: loadError } = await supabase.from("spatdel_community_posts").select("id, author_id, body, image_url, created_at").order("created_at", { ascending: false }).limit(50);
    if (loadError) { setError("Could not load community posts. Check that the Community Pulse SQL migration has been run."); return; }
    const rows = (data || []) as Post[];
    setPosts(rows);
    await loadProfiles(rows.map((p) => p.author_id));
  }, [loadProfiles]);

  const loadMessages = useCallback(async () => {
    const { data, error: loadError } = await supabase.from("spatdel_community_messages").select("id, author_id, body, created_at").order("created_at", { ascending: false }).limit(100);
    if (loadError) { setError("Could not load the live room. Check the Community Pulse SQL migration."); return; }
    const rows = ((data || []) as ChatMessage[]).reverse();
    setMessages(rows);
    await loadProfiles(rows.map((m) => m.author_id));
  }, [loadProfiles]);

  useEffect(() => {
    let active = true;
    async function start() {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) { router.replace("/login?next=/community"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      if (!active) return;
      if (profileError || !profile || !["admin", "chairman"].includes(profile.role || "")) {
        router.replace(profile?.role === "tenant" ? "/" : profile?.role === "agent" || profile?.role === "landlord" ? "/agent" : "/");
        return;
      }
      setUserId(data.user.id);
      await Promise.all([loadPosts(), loadMessages()]);
      if (active) setLoading(false);
    }
    void start();
    const timer = setInterval(() => { void loadPosts(); void loadMessages(); }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [router, loadPosts, loadMessages]);

  async function loadComments(postId: string) {
    setExpandedPost((current) => current === postId ? "" : postId);
    const { data, error: loadError } = await supabase.from("spatdel_community_comments").select("id, post_id, author_id, body, created_at").eq("post_id", postId).order("created_at", { ascending: true });
    if (loadError) { setError("Could not load replies."); return; }
    const rows = (data || []) as Comment[];
    setComments((current) => ({ ...current, [postId]: rows }));
    await loadProfiles(rows.map((c) => c.author_id));
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    const body = postDraft.trim();
    if ((!body && !postImage) || !userId || sending) return;
    setSending(true);
    let imageUrl: string | null = null;
    if (postImage) {
      const safeName = postImage.name.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
      const path = `${userId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("community-post-images").upload(path, postImage, { upsert: false, contentType: postImage.type });
      if (uploadError) { setSending(false); setError("Picture upload failed. Make sure the Community Post SQL migration has been run."); return; }
      imageUrl = supabase.storage.from("community-post-images").getPublicUrl(path).data.publicUrl;
    }
    const { error: insertError } = await supabase.from("spatdel_community_posts").insert({ author_id: userId, body, image_url: imageUrl });
    setSending(false);
    if (insertError) { setError("Your post could not be published. Please try again."); return; }
    setPostDraft(""); setPostImage(null); setPostImagePreview("");
    if (imageInputRef.current) imageInputRef.current.value = "";
    setNotice("Your community post is live."); await loadPosts();
  }

  async function submitComment(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault(); setError(""); setNotice("");
    const body = (commentDrafts[postId] || "").trim();
    if (!body || !userId || sending) return;
    setSending(true);
    const { error: insertError } = await supabase.from("spatdel_community_comments").insert({ post_id: postId, author_id: userId, body });
    setSending(false);
    if (insertError) { setError("Your reply could not be sent."); return; }
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
    const { data } = await supabase.from("spatdel_community_comments").select("id, post_id, author_id, body, created_at").eq("post_id", postId).order("created_at", { ascending: true });
    const rows = (data || []) as Comment[];
    setComments((current) => ({ ...current, [postId]: rows }));
    await loadProfiles(rows.map((c) => c.author_id));
  }

  async function submitChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const body = chatDraft.trim();
    if (!body || !userId || sending) return;
    setSending(true);
    const { error: insertError } = await supabase.from("spatdel_community_messages").insert({ author_id: userId, body });
    setSending(false);
    if (insertError) { setError("Message could not be sent. Please try again."); return; }
    setChatDraft(""); await loadMessages();
  }

  async function reportContent(targetType: "post" | "comment" | "message", targetId: string) {
    const reason = window.prompt("Why are you reporting this content? (At least 3 characters)");
    if (!reason?.trim()) return;
    const { error: reportError } = await supabase.from("spatdel_community_reports").insert({ reporter_id: userId, target_type: targetType, target_id: targetId, reason: reason.trim().slice(0, 500) });
    if (reportError) setError(reportError.code === "23505" ? "You have already reported this content." : "Could not submit the report.");
    else setNotice("Report sent to the SPATDEL moderation team.");
  }

  function displayName(id: string) {
    const p = profiles[id];
    return p?.full_name || (p?.username ? "@" + p.username : "SPATDEL member");
  }

  function roleLabel(id: string) {
    const role = profiles[id]?.role;
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : "Member";
  }

  function memberLink(id: string) {
    router.push("/profile/" + id);
  }

  function timeLabel(value: string) {
    return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#102f46]">
      <header className="sticky top-0 z-20 border-b border-[#102f46]/10 bg-[#f8f7f2]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <button onClick={() => router.push("/")} className="flex items-center gap-2 text-sm font-bold hover:text-[#087b62]"><ArrowLeft size={18} /> Back to SPATDEL</button>
          <img src="/spatdel.png" alt="SPATDEL" className="h-10 w-auto object-contain" />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-2xl bg-[#102f46] p-6 text-white sm:p-9">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#19e58f]"><Users size={14} /> COMMUNITY PULSE</span>
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">Your neighbourhood. Your voice.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">Share local updates, ask housing questions, and connect with tenants, agents, and landlords. Keep personal contact details private and treat members respectfully.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => setTab("posts")} className={`rounded-lg px-4 py-3 text-sm font-bold ${tab === "posts" ? "bg-[#19e58f] text-[#071b18]" : "bg-white/10 text-white"}`}><MessagesSquare className="mr-2 inline" size={17} /> Community posts</button>
            <button onClick={() => setTab("chat")} className={`rounded-lg px-4 py-3 text-sm font-bold ${tab === "chat" ? "bg-[#19e58f] text-[#071b18]" : "bg-white/10 text-white"}`}><MessageCircle className="mr-2 inline" size={17} /> Live community chat</button>
          </div>
        </div>

        {notice && <p role="status" className="mt-4 rounded-lg border border-[#087b62]/20 bg-[#e4f5ee] px-4 py-3 text-sm font-semibold text-[#087b62]">{notice}</p>}
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

        {loading ? <div className="mt-8 flex items-center justify-center gap-3 rounded-xl bg-white p-12"><LoaderCircle className="animate-spin" /> Loading Community Pulse...</div> : tab === "posts" ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <form onSubmit={submitPost} className="h-fit rounded-2xl border border-[#102f46]/10 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black">Start a conversation</h2>
              <p className="mt-1 text-xs leading-5 text-[#71808a]">Ask a question, share a local update, or give housing advice.</p>
              <textarea value={postDraft} onChange={(e) => setPostDraft(e.target.value.slice(0, 3000))} maxLength={3000} rows={4} placeholder="Add a caption or community update..." className="mt-4 w-full resize-y rounded-xl border border-[#102f46]/15 bg-[#f8f7f2] p-3 text-sm outline-none focus:border-[#087b62]" />
              <div className="mt-2 flex items-center justify-between text-[11px] text-[#71808a]"><span>Only admins and chairmen can post here.</span><span>{postDraft.length}/3000</span></div>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; } if (file.size > 5 * 1024 * 1024) { setError("Choose an image under 5 MB."); e.target.value = ""; return; } setPostImage(file); setPostImagePreview(URL.createObjectURL(file)); setError(""); }} />
              <button type="button" onClick={() => imageInputRef.current?.click()} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#102f46]/15 px-3 py-2 text-sm font-bold hover:border-[#087b62]"><ImagePlus size={17} /> {postImage ? "Change picture" : "Add picture"}</button>
              {postImagePreview && <div className="mt-3 overflow-hidden rounded-xl border border-[#102f46]/10"><div className="flex items-center justify-between bg-[#f8f7f2] px-3 py-2 text-xs font-bold"><span>Picture preview</span><button type="button" onClick={() => { setPostImage(null); setPostImagePreview(""); if (imageInputRef.current) imageInputRef.current.value = ""; }} aria-label="Remove selected picture" className="rounded p-1 hover:bg-white"><X size={15} /></button></div><img src={postImagePreview} alt="Preview of community post" className="max-h-64 w-full object-contain bg-black/5" /><p className="px-3 py-2 text-xs text-[#71808a]">Your caption above will appear with this picture.</p></div>}
              <button disabled={(!postDraft.trim() && !postImage) || sending} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#087b62] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Send size={16} /> {sending ? "Publishing..." : "Publish post"}</button>
            </form>
            <section>
              <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">Community discussions</h2><span className="text-xs text-[#71808a]">{posts.length} recent posts</span></div>
              {posts.length === 0 ? <div className="rounded-xl border border-dashed border-[#102f46]/20 bg-white p-8 text-center"><MessagesSquare className="mx-auto text-[#087b62]" size={28} /><p className="mt-3 font-bold">Be the first to start a discussion.</p><p className="mt-1 text-sm text-[#71808a]">Your post will appear here for other members.</p></div> : <div className="space-y-4">{posts.map((post) => <article key={post.id} className="rounded-2xl border border-[#102f46]/10 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3"><button onClick={() => memberLink(post.author_id)} className="flex items-center gap-3 text-left"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e4f5ee] text-sm font-black text-[#087b62]">{profiles[post.author_id]?.avatar_url ? <img src={profiles[post.author_id].avatar_url!} alt="" className="h-full w-full object-cover" /> : displayName(post.author_id).slice(0,1).toUpperCase()}</span><span><b className="block text-sm">{displayName(post.author_id)}</b><span className="text-xs text-[#71808a]">{roleLabel(post.author_id)} · {timeLabel(post.created_at)}</span></span></button><button title="Report post" onClick={() => void reportContent("post", post.id)} className="rounded-lg p-2 text-[#71808a] hover:bg-red-50 hover:text-red-600"><ShieldAlert size={17} /></button></div>
                {post.body && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6">{post.body}</p>}
                {post.image_url && <div className="mt-4 overflow-hidden rounded-xl border border-[#102f46]/10 bg-[#f8f7f2]"><img src={post.image_url} alt={post.body || "Community post picture"} className="max-h-[520px] w-full object-contain" /></div>}
                <div className="mt-4 border-t border-[#102f46]/10 pt-3"><button onClick={() => void loadComments(post.id)} className="inline-flex items-center gap-2 text-sm font-bold text-[#087b62]"><MessageCircle size={16} /> {expandedPost === post.id ? "Hide replies" : "View / reply to comments"} <span className="text-xs font-normal text-[#71808a]">{comments[post.id]?.length ? `(${comments[post.id].length})` : ""}</span></button></div>
                {expandedPost === post.id && <div className="mt-4 space-y-3">{(comments[post.id] || []).map((comment) => <div key={comment.id} className="rounded-lg bg-[#f8f7f2] p-3"><div className="flex items-start justify-between gap-2"><button onClick={() => memberLink(comment.author_id)} className="text-xs font-black hover:text-[#087b62]">{displayName(comment.author_id)}</button><button title="Report comment" onClick={() => void reportContent("comment", comment.id)} className="text-[#71808a] hover:text-red-600"><ShieldAlert size={14} /></button></div><p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.body}</p><p className="mt-2 text-[10px] text-[#71808a]">{timeLabel(comment.created_at)}</p></div>)}
                  <form onSubmit={(e) => void submitComment(e, post.id)} className="flex gap-2"><input value={commentDrafts[post.id] || ""} onChange={(e) => setCommentDrafts((current) => ({ ...current, [post.id]: e.target.value.slice(0, 1500) }))} maxLength={1500} placeholder="Write a helpful reply..." className="min-w-0 flex-1 rounded-lg border border-[#102f46]/15 px-3 py-2 text-sm outline-none focus:border-[#087b62]" /><button disabled={!(commentDrafts[post.id] || "").trim() || sending} className="rounded-lg bg-[#087b62] px-3 text-white disabled:opacity-50"><Send size={16} /></button></form>
                </div>}
              </article>)}</div>}
            </section>
          </div>
        ) : (
          <section className="mt-6 overflow-hidden rounded-2xl border border-[#102f46]/10 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#102f46]/10 bg-[#e4f5ee] px-5 py-4"><div><h2 className="font-black">SPATDEL Live Room</h2><p className="mt-1 text-xs text-[#71808a]">Messages refresh automatically every 5 seconds.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#087b62]"><span className="h-2 w-2 rounded-full bg-[#087b62]" /> Members only</span></div>
            <div className="flex h-[55vh] min-h-[340px] flex-col gap-3 overflow-y-auto bg-[#f8f7f2] p-4 sm:p-6">
              {messages.length === 0 ? <p className="m-auto text-center text-sm text-[#71808a]">No messages yet. Start the conversation 👋</p> : messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl p-3 shadow-sm sm:max-w-[70%] ${message.author_id === userId ? "ml-auto bg-[#087b62] text-white" : "mr-auto bg-white text-[#102f46]"}`}>
                <button onClick={() => memberLink(message.author_id)} className={`mb-1 block text-xs font-black underline-offset-2 hover:underline ${message.author_id === userId ? "text-[#c9ffe8]" : "text-[#087b62]"}`}>{message.author_id === userId ? "You" : displayName(message.author_id)} <span className="font-normal opacity-70">· {roleLabel(message.author_id)}</span></button>
                <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                <div className="mt-2 flex items-center justify-between gap-4 text-[10px] opacity-65"><span className="inline-flex items-center gap-1"><Clock3 size={11} />{timeLabel(message.created_at)}</span><button onClick={() => void reportContent("message", message.id)} title="Report message"><ShieldAlert size={13} /></button></div>
              </div>)}
            </div>
            <form onSubmit={submitChat} className="flex gap-2 border-t border-[#102f46]/10 p-3 sm:p-4"><input value={chatDraft} onChange={(e) => setChatDraft(e.target.value.slice(0, 1000))} maxLength={1000} placeholder="Send a message to the community..." className="min-w-0 flex-1 rounded-xl border border-[#102f46]/15 px-4 py-3 text-sm outline-none focus:border-[#087b62]" /><button disabled={!chatDraft.trim() || sending} aria-label="Send community message" className="flex items-center justify-center rounded-xl bg-[#087b62] px-5 text-white disabled:opacity-50"><Send size={18} /></button></form>
          </section>
        )}
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#102f46]/10 bg-white p-4 text-xs leading-5 text-[#71808a]"><ShieldAlert className="mt-0.5 shrink-0 text-[#087b62]" size={18} /><p>Keep your exact home address, passwords, bank details, and private contact information out of public discussions. Report abusive or suspicious content. Reports are stored for moderation; an admin review dashboard still needs to be connected.</p></div>
      </div>
    </main>
  );
}
