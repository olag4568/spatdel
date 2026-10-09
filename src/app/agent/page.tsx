"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "tenant" | "agent" | "landlord" | "admin";
type Profile = { id: string; full_name: string | null; role: Role };
type Listing = {
  id: string;
  title: string;
  price: string;
  location: string | null;
  approval_status: "pending" | "approved" | "rejected" | "changes_requested" | null;
  created_at: string;
  review_note?: string | null;
};

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function AgentDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [pricePeriod, setPricePeriod] = useState("per year");
  const [location, setLocation] = useState("");
  const [propertyType, setPropertyType] = useState("Apartment");
  const [beds, setBeds] = useState("2");
  const [baths, setBaths] = useState("1");
  const [sqm, setSqm] = useState("");
  const [description, setDescription] = useState("");
  const [floodRisk, setFloodRisk] = useState("Not sure");
  const [powerHours, setPowerHours] = useState("Not sure");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
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
        setError("We could not load your SPATDEL profile.");
        setLoading(false);
        return;
      }

      if (data.role !== "agent" && data.role !== "landlord") {
        router.replace(data.role === "admin" ? "/admin" : "/");
        return;
      }

      setProfile(data as Profile);

      const { data: ownListings, error: listingsError } = await supabase
        .from("properties")
        .select("id, title, price, location, approval_status, created_at, review_note")
        .eq("submitted_by", authData.user.id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (listingsError) {
        setError("Your listing history could not load. Apply the latest SPATDEL database migration if you have not done so.");
      } else {
        setListings((ownListings ?? []) as Listing[]);
      }

      setLoading(false);
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    const selected = Array.from(event.target.files ?? []);

    if (selected.length > MAX_PHOTOS) {
      setError(`Choose up to ${MAX_PHOTOS} photos.`);
      event.target.value = "";
      return;
    }

    const invalid = selected.find((file) => {
      return !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > MAX_FILE_SIZE;
    });

    if (invalid) {
      setError("Use JPG, PNG, or WebP images under 10 MB each.");
      event.target.value = "";
      return;
    }

    setPhotos(selected);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!profile) {
      setError("Sign in with an agent or landlord account first.");
      return;
    }

    if (photos.length === 0) {
      setError("Add at least one property photo before submitting.");
      return;
    }

    const numericPrice = Number(price);
    const numericBeds = Number(beds);
    const numericBaths = Number(baths);
    const numericSqm = Number(sqm);

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError("Enter a valid price greater than zero.");
      return;
    }

    if (!Number.isFinite(numericBeds) || numericBeds < 0 ||
        !Number.isFinite(numericBaths) || numericBaths < 0 ||
        !Number.isFinite(numericSqm) || numericSqm <= 0) {
      setError("Enter valid bedroom, bathroom, and floor-area values.");
      return;
    }

    setSubmitting(true);

    try {
      const imageUrls: string[] = [];

      for (const photo of photos) {
        const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const objectPath = `${profile.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("property-images")
          .upload(objectPath, photo, {
            cacheControl: "3600",
            upsert: false,
            contentType: photo.type,
          });

        if (uploadError) {
          throw new Error(`Photo upload failed: ${uploadError.message}`);
        }

        const { data: publicUrl } = supabase.storage
          .from("property-images")
          .getPublicUrl(objectPath);

        imageUrls.push(publicUrl.publicUrl);
      }

      const formattedPrice = `₦${numericPrice.toLocaleString("en-NG")} ${pricePeriod}`;

      const { data: inserted, error: insertError } = await supabase
        .from("properties")
        .insert({
          title: title.trim(),
          price: formattedPrice,
          beds: numericBeds,
          baths: numericBaths,
          sqm: `${numericSqm.toLocaleString("en-NG")} m²`,
          image: imageUrls[0],
          images: imageUrls,
          flood: floodRisk,
          flood_risk: floodRisk,
          power: powerHours,
          power_hours: powerHours,
          location: location.trim(),
          type: propertyType,
          description: description.trim(),
          verified: false,
          approval_status: "pending",
          submitted_by: profile.id,
        })
        .select("id, title, price, location, approval_status, created_at, review_note")
        .single();

      if (insertError) {
        throw new Error(`Listing could not be saved: ${insertError.message}`);
      }

      if (inserted) {
        setListings((current) => [inserted as Listing, ...current]);
      }

      setTitle("");
      setPrice("");
      setLocation("");
      setBeds("2");
      setBaths("1");
      setSqm("");
      setDescription("");
      setPhotos([]);
      setFloodRisk("Not sure");
      setPowerHours("Not sure");
      setNotice("Property submitted. It will appear publicly only after admin approval.");
      const input = document.getElementById("property-photos") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Something went wrong while submitting your property.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f7f2] text-[#102f46]">
        <div className="text-center">
          <LoaderCircle className="mx-auto animate-spin" size={30} />
          <p className="mt-3 text-sm text-[#687987]">Loading your dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#102f46]">
      <header className="border-b border-[#102f46]/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <img src="/spatdel.png" alt="SPATDEL" className="h-12 w-auto object-contain" />
            <div className="hidden border-l border-[#dce3e7] pl-3 sm:block">
              <p className="font-bold">Property Dashboard</p>
              <p className="text-xs capitalize text-[#687987]">{profile?.role} account</p>
            </div>
          </div>
          <button onClick={() => router.push("/")} className="inline-flex items-center gap-2 rounded-full border border-[#d5dde2] px-4 py-2 text-sm font-semibold hover:bg-[#f5f7f8]">
            <ArrowLeft size={16} /> Home
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-7 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div>
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#087b62]">SPATDEL listings</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Submit a property</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#687987]">
              Add the property details and real photos. Your listing stays hidden until an admin reviews and approves it.
            </p>
          </div>

          {error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
          {notice && <div role="status" className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><CheckCircle2 className="mr-2 inline" size={17} />{notice}</div>}

          <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-[#dce3e7] bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3 border-b border-[#edf0f2] pb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f0f4]"><Building2 size={21} /></div>
              <div><h2 className="font-bold">Property details</h2><p className="text-xs text-[#687987]">Fields marked required must be completed.</p></div>
            </div>

            <div>
              <label htmlFor="title" className="text-sm font-semibold">Property title *</label>
              <input id="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 2-bedroom apartment in Lekki" className="mt-2 w-full rounded-xl border border-[#d5dde2] bg-white px-4 py-3 text-sm outline-none focus:border-[#087b62]" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="price" className="text-sm font-semibold">Price in naira *</label>
                <input id="price" required type="number" min="1" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 1200000" className="mt-2 w-full rounded-xl border border-[#d5dde2] px-4 py-3 text-sm outline-none focus:border-[#087b62]" />
              </div>
              <div>
                <label htmlFor="pricePeriod" className="text-sm font-semibold">Price period *</label>
                <select id="pricePeriod" value={pricePeriod} onChange={(e) => setPricePeriod(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d5dde2] bg-white px-4 py-3 text-sm outline-none focus:border-[#087b62]">
                  <option value="per year">Per year</option>
                  <option value="per month">Per month</option>
                  <option value="total price">Total price</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="location" className="text-sm font-semibold">Full location *</label>
              <div className="relative mt-2">
                <MapPin size={17} className="absolute left-4 top-3.5 text-[#8a969f]" />
                <input id="location" required maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Area, city, state" className="w-full rounded-xl border border-[#d5dde2] py-3 pl-11 pr-4 text-sm outline-none focus:border-[#087b62]" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="propertyType" className="text-sm font-semibold">Property type *</label>
                <select id="propertyType" value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d5dde2] bg-white px-4 py-3 text-sm outline-none focus:border-[#087b62]">
                  <option>Apartment</option><option>Flat</option><option>Duplex</option><option>House</option><option>Self-contain</option><option>Land</option><option>Commercial</option><option>Short-let</option>
                </select>
              </div>
              <div>
                <label htmlFor="sqm" className="text-sm font-semibold">Floor area (m²) *</label>
                <input id="sqm" required type="number" min="1" step="0.1" value={sqm} onChange={(e) => setSqm(e.target.value)} placeholder="e.g. 95" className="mt-2 w-full rounded-xl border border-[#d5dde2] px-4 py-3 text-sm outline-none focus:border-[#087b62]" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="beds" className="text-sm font-semibold">Bedrooms *</label><input id="beds" required type="number" min="0" max="100" value={beds} onChange={(e) => setBeds(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d5dde2] px-4 py-3 text-sm outline-none focus:border-[#087b62]" /></div>
              <div><label htmlFor="baths" className="text-sm font-semibold">Bathrooms *</label><input id="baths" required type="number" min="0" max="100" value={baths} onChange={(e) => setBaths(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d5dde2] px-4 py-3 text-sm outline-none focus:border-[#087b62]" /></div>
            </div>

            <div>
              <label htmlFor="description" className="text-sm font-semibold">Description *</label>
              <textarea id="description" required minLength={20} maxLength={3000} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the property, nearby facilities, and important details." className="mt-2 w-full resize-y rounded-xl border border-[#d5dde2] px-4 py-3 text-sm leading-6 outline-none focus:border-[#087b62]" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="floodRisk" className="text-sm font-semibold">Flood risk</label><select id="floodRisk" value={floodRisk} onChange={(e) => setFloodRisk(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d5dde2] bg-white px-4 py-3 text-sm"><option>Not sure</option><option>Low</option><option>Moderate</option><option>High</option></select></div>
              <div><label htmlFor="powerHours" className="text-sm font-semibold">Typical electricity supply</label><select id="powerHours" value={powerHours} onChange={(e) => setPowerHours(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d5dde2] bg-white px-4 py-3 text-sm"><option>Not sure</option><option>Less than 6 hours/day</option><option>6–12 hours/day</option><option>12–18 hours/day</option><option>18+ hours/day</option></select></div>
            </div>

            <div>
              <label htmlFor="property-photos" className="text-sm font-semibold">Property photos * (up to {MAX_PHOTOS})</label>
              <label htmlFor="property-photos" className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cbd7dd] bg-[#fafbfb] px-5 py-7 text-center transition hover:border-[#087b62] hover:bg-[#f5faf8]">
                <ImagePlus size={28} className="text-[#087b62]" />
                <span className="mt-3 text-sm font-bold">Choose property photos</span>
                <span className="mt-1 text-xs text-[#687987]">JPG, PNG or WebP · 10 MB maximum each</span>
                <input id="property-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotoChange} className="sr-only" />
              </label>
              {photos.length > 0 && <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f5f7f8] p-3 text-sm"><span>{photos.length} photo{photos.length === 1 ? "" : "s"} selected</span><button type="button" onClick={() => { setPhotos([]); const input = document.getElementById("property-photos") as HTMLInputElement | null; if (input) input.value = ""; }} className="inline-flex items-center gap-1 text-red-600"><Trash2 size={14} /> Remove</button></div>}
            </div>

            <div className="rounded-2xl bg-[#f5f7f8] p-4 text-sm leading-6 text-[#687987]">
              <p className="font-bold text-[#102f46]">Admin review is required</p>
              <p className="mt-1">Your property will be saved as pending and will not appear in public search until an admin approves it.</p>
            </div>

            <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#102f46] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#183d57] disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}
              {submitting ? "Submitting property..." : "Submit for admin approval"}
            </button>
          </form>
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-[#dce3e7] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold">My submissions</h2>
            <p className="mt-1 text-sm text-[#687987]">Track each property's review status.</p>
            <div className="mt-5 space-y-3">
              {listings.length === 0 ? (
                <div className="rounded-2xl bg-[#f5f7f8] p-4 text-sm text-[#687987]">No properties submitted yet.</div>
              ) : listings.map((listing) => {
                const status = listing.approval_status ?? "pending";
                const statusClass = status === "approved" ? "bg-emerald-50 text-emerald-700" : status === "rejected" ? "bg-red-50 text-red-700" : status === "changes_requested" ? "bg-amber-50 text-amber-800" : "bg-[#eef2f5] text-[#536776]";
                const statusLabel = status === "changes_requested" ? "Changes requested" : status.charAt(0).toUpperCase() + status.slice(1);
                return (
                  <div key={listing.id} className="rounded-2xl border border-[#e3e8eb] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="font-bold">{listing.title}</p><p className="mt-1 text-sm text-[#687987]">{listing.price}</p>{listing.location && <p className="mt-1 truncate text-xs text-[#8a969f]">{listing.location}</p>}</div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>{statusLabel}</span>
                    </div>
                    {listing.review_note && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Admin note: {listing.review_note}</p>}
                    <p className="mt-3 text-[11px] text-[#8a969f]">Submitted {new Date(listing.created_at).toLocaleDateString("en-NG")}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl bg-[#102f46] p-6 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><Upload size={21} /></div>
            <h2 className="mt-4 text-lg font-bold">Helpful reminder</h2>
            <p className="mt-2 text-sm leading-6 text-[#c5d3dc]">Upload genuine photos and provide accurate rent, location, flood-risk, and electricity information. Admins can reject misleading listings.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
