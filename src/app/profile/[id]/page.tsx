"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CircleUserRound,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "tenant" | "agent" | "landlord" | "admin" | string;
type Profile = { id: string; full_name: string | null; username: string | null; bio: string | null; avatar_url: string | null; contact_phone: string | null; location: string | null; role: Role };
type Property = {
  id: string;
  title: string | null;
  price: string | null;
  location: string | null;
  image: string | null;
  listing_purpose: "rent" | "sale" | null;
  beds: number | null;
  baths: number | null;
};

function roleLabel(role: Role) {
  if (role === "admin") return "Admin";
  if (role === "agent") return "Agent";
  if (role === "landlord") return "Landlord";
  if (role === "tenant") return "Tenant";
  return "SPATDEL member";
}

function PublicProfileContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const { data: authData } = await supabase.auth.getUser();
      if (!active) return;
      if (!authData.user) {
        router.replace("/login");
        return;
      }
      setCurrentUserId(authData.user.id);

      const profileId = params.id;
      if (!profileId) {
        setError("This profile link is not valid.");
        setLoading(false);
        return;
      }

      const { data: profileRows, error: profileError } = await supabase.rpc(
        "spatdel_get_public_profile",
        { target_profile_id: profileId }
      );

      if (!active) return;

      if (profileError) {
        setError("Could not load this profile. Make sure the latest SPATDEL profile migration has been run in Supabase.");
        setLoading(false);
        return;
      }

      const profileData = (profileRows ?? [])[0] as Profile | undefined;
      if (!profileData) {
        setError("This SPATDEL profile could not be found.");
        setLoading(false);
        return;
      }

      setProfile(profileData);

      if (profileData.role === "agent" || profileData.role === "landlord") {
        const { data: listings, error: listingError } = await supabase
          .from("properties")
          .select("id, title, price, location, image, listing_purpose, beds, baths")
          .eq("approval_status", "approved")
          .or(`submitted_by.eq.${profileId},owner_id.eq.${profileId}`)
          .order("created_at", { ascending: false });

        if (!active) return;
        if (listingError) {
          setError("Profile loaded, but approved property listings could not be loaded.");
        } else {
          setProperties((listings ?? []) as Property[]);
        }
      }

      setLoading(false);
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [params.id, router, supabase]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f7f2] text-[#102f46]">
        <LoaderCircle className="animate-spin" size={30} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#102f46]">
      <header className="border-b border-[#102f46]/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-7">
          <button onClick={() => router.push("/")} className="flex items-center gap-3">
            <img src="/spatdel.png" alt="SPATDEL" className="h-10 w-auto object-contain" />
            <span className="font-bold">SPATDEL Profile</span>
          </button>
          <button onClick={() => router.push("/messages")} className="inline-flex items-center gap-2 rounded-full border border-[#d5dde2] px-4 py-2 text-sm font-semibold hover:bg-[#f5f7f8]">
            <ArrowLeft size={16} /> Messages
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-7 sm:py-12">
        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {error}
          </div>
        )}

        {profile && (
          <>
            <div className="rounded-3xl border border-[#dce3e7] bg-white p-6 shadow-sm sm:p-9">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8f0f4] text-[#102f46]">
                  {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name || "Member"} className="h-full w-full object-cover" /> : <CircleUserRound size={54} strokeWidth={1.5} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="break-words text-2xl font-black sm:text-3xl">
                      {profile.full_name?.trim() || "SPATDEL member"}
                    </h1>
                  </div>
                  {profile.username && <p className="mt-1 text-sm font-semibold text-[#687987]">@{profile.username}</p>}
                  <span className="mt-3 inline-flex rounded-full bg-[#e8f4ed] px-3 py-1.5 text-sm font-bold text-[#087b62]">
                    {roleLabel(profile.role)}
                  </span>
                  <p className="mt-4 max-w-xl whitespace-pre-wrap text-sm leading-6 text-[#687987]">
                    {profile.bio?.trim() || "This member hasn't added a bio yet."}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {currentUserId === profile.id ? (
                    <button onClick={() => router.push("/profile/edit")} className="rounded-full border border-[#d5dde2] px-5 py-3 text-sm font-bold hover:bg-[#f5f7f8]">Edit profile</button>
                  ) : (
                    <button onClick={() => router.push(`/messages?user=${profile.id}`)} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#087b62] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#066b55]">
                      <MessageCircle size={17} /> Message
                    </button>
                  )}
                </div>
              </div>
            </div>

            <section className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-[#dce3e7] bg-white p-6 shadow-sm sm:p-7">
                <div className="mb-3 flex items-center gap-2">
                  <CircleUserRound size={20} className="text-[#087b62]" />
                  <h2 className="text-lg font-black">About {profile.full_name?.trim() || "this member"}</h2>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-[#687987]">
                  {profile.bio?.trim() || "This member hasn't added a bio yet."}
                </p>
              </div>
              <div className="rounded-3xl border border-[#dce3e7] bg-white p-6 shadow-sm sm:p-7">
                <h2 className="mb-4 text-lg font-black">Profile details</h2>
                <dl className="space-y-4 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#687987]">Member type</dt>
                    <dd className="text-right font-bold">{roleLabel(profile.role)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#687987]">Username</dt>
                    <dd className="break-all text-right font-bold">{profile.username ? `@${profile.username}` : "Not set"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#687987]">Profile photo</dt>
                    <dd className="text-right font-bold">{profile.avatar_url ? "Added" : "Not added"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="flex items-center gap-1.5 text-[#687987]"><MapPin size={15} /> Location</dt>
                    <dd className="max-w-[60%] text-right font-bold">{profile.location?.trim() || "Not added"}</dd>
                  </div>
                  {profile.contact_phone?.trim() && (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="flex items-center gap-1.5 text-[#687987]"><Phone size={15} /> Contact</dt>
                      <dd className="text-right font-bold"><a className="text-[#087b62] underline" href={"tel:" + profile.contact_phone}>{profile.contact_phone}</a></dd>
                    </div>
                  )}
                </dl>
                {currentUserId !== profile.id && (
                  <button
                    onClick={() => router.push(`/messages?user=${profile.id}`)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#087b62] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#066b55]"
                  >
                    <MessageCircle size={17} /> Message this member
                  </button>
                )}
              </div>
            </section>

            {(profile.role === "agent" || profile.role === "landlord") && (
              <section className="mt-8">
                <div className="mb-4 flex items-center gap-2">
                  <Building2 size={21} />
                  <h2 className="text-xl font-black">Approved properties</h2>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#687987]">{properties.length}</span>
                </div>
                {properties.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#cfd9de] bg-white p-7 text-center">
                    <Building2 className="mx-auto text-[#8a969f]" size={28} />
                    <p className="mt-3 font-bold">No approved properties yet</p>
                    <p className="mt-1 text-sm text-[#687987]">Approved listings from this agent or landlord will appear here.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {properties.map((property) => (
                      <article key={property.id} className="overflow-hidden rounded-2xl border border-[#dce3e7] bg-white shadow-sm">
                        {property.image ? (
                          <img src={property.image} alt={property.title || "Property"} className="h-48 w-full object-cover" />
                        ) : (
                          <div className="flex h-48 items-center justify-center bg-[#e8f0f4] text-[#687987]"><Building2 size={36} /></div>
                        )}
                        <div className="p-5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#087b62]">
                            {property.listing_purpose === "sale" ? "For sale" : "For rent"}
                          </span>
                          <h3 className="mt-1 text-lg font-bold">{property.title || "Property listing"}</h3>
                          <p className="mt-2 font-black">{property.price || "Contact for price"}</p>
                          {property.location && <p className="mt-2 flex items-center gap-1.5 text-sm text-[#687987]"><MapPin size={15} />{property.location}</p>}
                          <p className="mt-2 text-xs text-[#687987]">{property.beds ?? "—"} beds · {property.baths ?? "—"} baths</p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}


export default function PublicProfilePage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#f8f7f2] text-[#102f46]">Loading profile...</main>}>
      <PublicProfileContent />
    </Suspense>
  );
}
