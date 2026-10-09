"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, LoaderCircle, Save, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MemberProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  role: string;
};

export default function EditProfilePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;
      if (!auth.user) {
        router.replace("/login");
        return;
      }
      setUserId(auth.user.id);
      const { data, error: profileError } = await supabase.rpc("spatdel_get_my_profile");
      if (!active) return;
      if (profileError) {
        setError("Could not load your profile. Run the latest member profile migration in Supabase first.");
      } else {
        const profile = ((data ?? [])[0] ?? null) as MemberProfile | null;
        if (profile) {
          setFullName(profile.full_name ?? "");
          setUsername(profile.username ?? "");
          setBio(profile.bio ?? "");
          setAvatarUrl(profile.avatar_url ?? "");
        } else {
          setError("Your SPATDEL profile could not be found.");
        }
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router, supabase]);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setNotice("");
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("Your photo must be 3 MB or smaller.");
      event.target.value = "";
      return;
    }
    setSelectedPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const cleanName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
    if (cleanName.length < 2 || cleanName.length > 80) {
      setError("Your display name must be between 2 and 80 characters.");
      return;
    }
    if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(cleanUsername)) {
      setError("Username must be 3–24 characters using letters, numbers, underscores, or hyphens.");
      return;
    }
    if (bio.trim().length > 280) {
      setError("Your bio must be 280 characters or fewer.");
      return;
    }

    setSaving(true);
    let finalAvatarUrl = avatarUrl;

    try {
      if (selectedPhoto) {
        setUploading(true);
        const extension = selectedPhoto.type === "image/png" ? "png" : selectedPhoto.type === "image/webp" ? "webp" : "jpg";
        const filePath = `${userId}/avatar-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(filePath, selectedPhoto, { upsert: true, contentType: selectedPhoto.type });
        setUploading(false);
        if (uploadError) throw new Error(uploadError.message);
        finalAvatarUrl = supabase.storage.from("profile-photos").getPublicUrl(filePath).data.publicUrl;
      }

      const { data, error: saveError } = await supabase.rpc("spatdel_update_my_profile", {
        p_full_name: cleanName,
        p_username: cleanUsername,
        p_bio: bio.trim() || null,
        p_avatar_url: finalAvatarUrl || null,
      });
      if (saveError) throw new Error(saveError.message);
      const saved = ((data ?? [])[0] ?? null) as MemberProfile | null;
      if (saved) {
        setFullName(saved.full_name ?? cleanName);
        setUsername(saved.username ?? cleanUsername);
        setBio(saved.bio ?? "");
        setAvatarUrl(saved.avatar_url ?? "");
        setSelectedPhoto(null);
        setPhotoPreview("");
      }
      setNotice("Your SPATDEL profile has been updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your profile.");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  const shownPhoto = photoPreview || avatarUrl;

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f8f7f2] text-[#102f46]"><LoaderCircle className="animate-spin" size={30} /></main>;
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#102f46]">
      <header className="border-b border-[#102f46]/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-7">
          <div className="flex items-center gap-3"><img src="/spatdel.png" alt="SPATDEL" className="h-10 w-auto object-contain" /><span className="font-bold">Edit profile</span></div>
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-full border border-[#d5dde2] px-4 py-2 text-sm font-semibold hover:bg-[#f5f7f8]"><ArrowLeft size={16} /> Back</button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-8 sm:px-7 sm:py-12">
        <div className="rounded-3xl border border-[#dce3e7] bg-white p-5 shadow-sm sm:p-8">
          <h1 className="text-2xl font-black">Make your profile yours</h1>
          <p className="mt-2 text-sm leading-6 text-[#687987]">Choose a username people can search, add a photo, and introduce yourself.</p>

          {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {notice && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

          <form onSubmit={handleSave} className="mt-7 space-y-6">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#f8f7f2] p-6">
              {shownPhoto ? <img src={shownPhoto} alt="Profile preview" className="h-28 w-28 rounded-full border-4 border-white object-cover shadow-sm" /> : <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white bg-[#e8f0f4] text-[#102f46] shadow-sm"><UserRound size={52} /></div>}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#d5dde2] bg-white px-4 py-2.5 text-sm font-bold hover:bg-[#f5f7f8]">
                <Camera size={17} /> Choose photo
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="sr-only" />
              </label>
              <p className="text-xs text-[#687987]">JPG, PNG, or WebP · max 3 MB</p>
            </div>

            <div>
              <label htmlFor="fullName" className="mb-2 block text-sm font-bold">Display name</label>
              <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} required className="w-full rounded-xl border border-[#d5dde2] px-4 py-3 text-sm outline-none focus:border-[#087b62]" placeholder="Your name" />
            </div>
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-bold">Username</label>
              <div className="flex items-center rounded-xl border border-[#d5dde2] px-4 focus-within:border-[#087b62]"><span className="text-sm text-[#687987]">@</span><input id="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} maxLength={24} minLength={3} required className="w-full border-0 px-2 py-3 text-sm outline-none" placeholder="yourname" /></div>
              <p className="mt-1.5 text-xs text-[#687987]">3–24 characters. Letters, numbers, underscores, and hyphens. Must be unique.</p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><label htmlFor="bio" className="text-sm font-bold">Bio</label><span className="text-xs text-[#687987]">{bio.length}/280</span></div>
              <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={4} className="w-full resize-y rounded-xl border border-[#d5dde2] px-4 py-3 text-sm leading-6 outline-none focus:border-[#087b62]" placeholder="Tell the SPATDEL community a little about yourself..." />
            </div>
            <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#087b62] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#066b55] disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}
              {uploading ? "Uploading photo..." : saving ? "Saving profile..." : "Save profile"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
