
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  LogOut,
  Mail,
  ShieldCheck,
  User,
  Trophy,
  Home,
  Settings,
  ChevronRight,
  Save,
  Pencil,
  Lock,
  Heart,
  Trash2,
  MapPin,
  BedDouble,
  Bath,
  Maximize,
  MessageSquare,
  FileText,
  Wallet,
  Search,
  Bell,
  CheckCircle2,
  Clock3,
  Eye,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type UserRole = "tenant" | "agent" | "landlord" | "admin";

type Property = {
  id: string;
  title: string;
  price: string;
  beds: number;
  baths: number;
  sqm: string;
  image: string;
  flood: string;
  power: string;
  verified?: boolean;
  location?: string;
  type?: string;
  flood_risk?: string;
  power_hours?: string;
  description?: string;
};

type EnquiryStatus =
  | "pending"
  | "viewed"
  | "responded"
  | "closed";

type Enquiry = {
  id: string;
  property_id: string;
  tenant_id: string;
  subject: string;
  message: string;
  status: EnquiryStatus;
  created_at: string;
  property?: Property;
};

export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  // USER ROLE
  const [userRole, setUserRole] =
    useState<UserRole>("tenant");
  const [rewardAmount, setRewardAmount] = useState<number | null>(null);
  const [rewardSpunAt, setRewardSpunAt] = useState<string | null>(null);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [spinningReward, setSpinningReward] = useState(false);
  const [rewardWheelRotation, setRewardWheelRotation] = useState(0);
  const [rewardActionError, setRewardActionError] = useState("");
  const [rewardActionNotice, setRewardActionNotice] = useState("");

  // SAVED PROPERTIES
  const [savedProperties, setSavedProperties] = useState<
    Property[]
  >([]);
  const [loadingSavedProperties, setLoadingSavedProperties] =
    useState(true);
  const [removingPropertyId, setRemovingPropertyId] =
    useState<string | null>(null);
  const [savedPropertyError, setSavedPropertyError] =
    useState("");

  // ENQUIRIES
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loadingEnquiries, setLoadingEnquiries] =
    useState(true);
  const [enquiryError, setEnquiryError] = useState("");

  // PROFILE EDITING
  const [editingProfile, setEditingProfile] =
    useState(false);
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] =
    useState(false);
  const [profileMessage, setProfileMessage] =
    useState("");
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      setUser(user);

      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        "";

      setFullName(name);

      // Load the user's actual role from profiles
      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

      if (!profileError && profile?.role) {
        setUserRole(profile.role as UserRole);
      }

      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        if (!session?.user) {
          router.replace("/login");
          return;
        }

        setUser(session.user);

        const name =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          "";

        setFullName(name);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  // LOAD THE TENANT'S LIFETIME SPIN REWARD
  useEffect(() => {
    if (!user?.id || userRole !== "tenant") {
      setRewardAmount(null);
      setRewardSpunAt(null);
      setRewardLoading(false);
      return;
    }

    let mounted = true;

    async function loadTenantReward() {
      setRewardLoading(true);
      const { data, error } = await supabase
        .from("tenant_rewards")
        .select("reward_amount, spun_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;
      if (error) {
        console.error("Failed to load tenant reward:", error);
      } else {
        setRewardAmount(data?.reward_amount ?? null);
        setRewardSpunAt(data?.spun_at ?? null);
      }
      setRewardLoading(false);
    }

    loadTenantReward();

    return () => {
      mounted = false;
    };
  }, [user, userRole, supabase]);

  // LOAD SAVED PROPERTIES
  useEffect(() => {
    if (!user?.id) {
      setSavedProperties([]);
      setLoadingSavedProperties(false);
      return;
    }

    let mounted = true;

    async function loadSavedProperties() {
      setLoadingSavedProperties(true);
      setSavedPropertyError("");

      const { data: savedRows, error: savedError } =
        await supabase
          .from("saved_properties")
          .select("property_id")
          .eq("user_id", user.id);

      if (!mounted) return;

      if (savedError) {
        console.error(
          "Failed to load saved properties:",
          savedError
        );

        setSavedPropertyError(
          "We couldn't load your saved properties."
        );
        setSavedProperties([]);
        setLoadingSavedProperties(false);
        return;
      }

      const propertyIds = (savedRows ?? []).map(
        (row) => row.property_id
      );

      if (propertyIds.length === 0) {
        setSavedProperties([]);
        setLoadingSavedProperties(false);
        return;
      }

      const {
        data: properties,
        error: propertiesError,
      } = await supabase
        .from("properties")
        .select("*")
        .in("id", propertyIds);

      if (!mounted) return;

      if (propertiesError) {
        console.error(
          "Failed to load property details:",
          propertiesError
        );

        setSavedPropertyError(
          "We couldn't load your saved property details."
        );
        setSavedProperties([]);
        setLoadingSavedProperties(false);
        return;
      }

      const propertyMap = new Map(
        (properties ?? []).map((property) => [
          property.id,
          property as Property,
        ])
      );

      const orderedProperties = propertyIds
        .map((id) => propertyMap.get(id))
        .filter(Boolean) as Property[];

      setSavedProperties(orderedProperties);
      setLoadingSavedProperties(false);
    }

    loadSavedProperties();

    return () => {
      mounted = false;
    };
  }, [user, supabase]);

  // LOAD TENANT ENQUIRIES
  useEffect(() => {
    if (!user?.id) {
      setEnquiries([]);
      setLoadingEnquiries(false);
      return;
    }

    let mounted = true;

    async function loadEnquiries() {
      setLoadingEnquiries(true);
      setEnquiryError("");

      const {
        data: enquiryRows,
        error: enquiriesError,
      } = await supabase
        .from("property_enquiries")
        .select(
          "id, property_id, tenant_id, subject, message, status, created_at"
        )
        .eq("tenant_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (!mounted) return;

      if (enquiriesError) {
        console.error(
          "Failed to load enquiries:",
          enquiriesError
        );

        setEnquiryError(
          "We couldn't load your enquiries."
        );
        setEnquiries([]);
        setLoadingEnquiries(false);
        return;
      }

      const rows = (enquiryRows ?? []) as Enquiry[];

      if (rows.length === 0) {
        setEnquiries([]);
        setLoadingEnquiries(false);
        return;
      }

      // Get the property IDs connected to the enquiries
      const propertyIds = [
        ...new Set(
          rows.map((enquiry) => enquiry.property_id)
        ),
      ];

      // Load the related properties separately
      const {
        data: properties,
        error: propertiesError,
      } = await supabase
        .from("properties")
        .select("*")
        .in("id", propertyIds);

      if (!mounted) return;

      if (propertiesError) {
        console.error(
          "Failed to load enquiry properties:",
          propertiesError
        );

        setEnquiryError(
          "Your enquiries loaded, but some property details could not be loaded."
        );

        setEnquiries(rows);
        setLoadingEnquiries(false);
        return;
      }

      const propertyMap = new Map(
        (properties ?? []).map((property) => [
          property.id,
          property as Property,
        ])
      );

      const enquiriesWithProperties = rows.map(
        (enquiry) => ({
          ...enquiry,
          property: propertyMap.get(
            enquiry.property_id
          ),
        })
      );

      setEnquiries(enquiriesWithProperties);
      setLoadingEnquiries(false);
    }

    loadEnquiries();

    return () => {
      mounted = false;
    };
  }, [user, supabase]);

  async function handleSignOut() {
    setSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out error:", error);
      setSigningOut(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleSaveProfile() {
    setProfileMessage("");
    setProfileError("");

    const cleanName = fullName.trim();

    if (!cleanName) {
      setProfileError("Please enter your name.");
      return;
    }

    if (cleanName.length < 2) {
      setProfileError(
        "Your name must be at least 2 characters."
      );
      return;
    }

    setSavingProfile(true);

    const { data, error } =
      await supabase.auth.updateUser({
        data: {
          full_name: cleanName,
        },
      });

    setSavingProfile(false);

    if (error) {
      setProfileError(error.message);
      return;
    }

    if (data.user) {
      setUser(data.user);
    }

    setEditingProfile(false);
    setProfileMessage(
      "Profile updated successfully."
    );
  }

  async function removeSavedProperty(propertyId: string) {
    if (!user?.id) return;

    if (removingPropertyId === propertyId) return;

    setRemovingPropertyId(propertyId);
    setSavedPropertyError("");

    const { error } = await supabase
      .from("saved_properties")
      .delete()
      .eq("user_id", user.id)
      .eq("property_id", propertyId);

    if (error) {
      console.error(
        "Failed to remove saved property:",
        error
      );

      setSavedPropertyError(
        "We couldn't remove that property. Please try again."
      );

      setRemovingPropertyId(null);
      return;
    }

    setSavedProperties((current) =>
      current.filter(
        (property) => property.id !== propertyId
      )
    );

    setRemovingPropertyId(null);
  }

  function getUserName() {
    return (
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split("@")[0] ||
      "User"
    );
  }

  function getUserInitials() {
    const name = getUserName();

    const initials = name
      .split(" ")
      .filter(Boolean)
      .map((word: string) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return initials || "U";
  }

  function getRoleLabel() {
    switch (userRole) {
      case "admin":
        return "Administrator";
      case "agent":
        return "Property Agent";
      case "landlord":
        return "Landlord";
      default:
        return "Tenant";
    }
  }

  function getStatusLabel(status: EnquiryStatus) {
    switch (status) {
      case "pending":
        return "Pending";
      case "viewed":
        return "Viewed";
      case "responded":
        return "Responded";
      case "closed":
        return "Closed";
      default:
        return status;
    }
  }

  function getStatusIcon(status: EnquiryStatus) {
    switch (status) {
      case "pending":
        return <Clock3 size={14} />;
      case "viewed":
        return <Eye size={14} />;
      case "responded":
        return <CheckCircle2 size={14} />;
      case "closed":
        return <XCircle size={14} />;
      default:
        return <Clock3 size={14} />;
    }
  }

  function getStatusClasses(status: EnquiryStatus) {
    switch (status) {
      case "pending":
        return "bg-[#fff4d6] text-[#9a7010]";
      case "viewed":
        return "bg-[#e8f0f4] text-[#102f46]";
      case "responded":
        return "bg-[#e8f4ed] text-[#28734b]";
      case "closed":
        return "bg-[#f1f1f1] text-[#687987]";
      default:
        return "bg-[#f5f7f8] text-[#607080]";
    }
  }

  function formatEnquiryDate(date: string) {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return parsedDate.toLocaleDateString(
      undefined,
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  }

  async function spinTenantReward() {
    if (spinningReward || rewardLoading || rewardAmount !== null || rewardSpunAt) return;

    setRewardActionError("");
    setRewardActionNotice("");

    const { data, error } = await supabase.rpc("claim_tenant_spin_reward");

    if (error) {
      console.error("Failed to claim lifetime spin reward:", error);
      setRewardActionError(
        error.message?.includes("Only tenant")
          ? "Only tenant accounts can claim this reward."
          : "Your spin could not be saved. Please try again."
      );
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    const reward = Number(result?.reward_amount);
    const spunAt = result?.spun_at ?? null;

    if (![5000, 10000, 15000, 20000, 25000, 30000].includes(reward) || !spunAt) {
      setRewardActionError("We couldn't confirm your reward. Refresh and check your reward status.");
      return;
    }

    setRewardAmount(reward);
    setRewardSpunAt(spunAt);

    if (result?.already_spun) {
      setRewardActionNotice("Your lifetime spin was already used. Your saved discount has been restored.");
      return;
    }

    setSpinningReward(true);
    const rewardIndex = [5000, 10000, 15000, 20000, 25000, 30000].indexOf(reward);
    setRewardWheelRotation((current) => current + 1440 + ((360 - rewardIndex * 60) % 360));

    window.setTimeout(() => {
      setSpinningReward(false);
      setRewardActionNotice(
        "You won ₦" + reward.toLocaleString("en-NG") +
        " off every available house's displayed price."
      );
    }, 1900);
  }

  function getDisplayedPrice(price: string) {
    if (userRole !== "tenant" || !rewardAmount) return price;
    const match = price.match(/(?:₦|NGN\\s*)?\\s*([\\d,]+(?:\\.\\d+)?)/i);
    if (!match) return price;
    const originalAmount = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(originalAmount)) return price;
    const discountedAmount = Math.max(0, originalAmount - rewardAmount);
    return price.replace(match[0], "₦" + discountedAmount.toLocaleString("en-NG"));
  }

  function getOriginalPrice(price: string) {
    if (userRole !== "tenant" || !rewardAmount) return null;
    const match = price.match(/(?:₦|NGN\\s*)?\\s*([\\d,]+(?:\\.\\d+)?)/i);
    if (!match) return null;
    const originalAmount = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(originalAmount)) return null;
    return "₦" + originalAmount.toLocaleString("en-NG");
  }

  function goHome() {
    router.push("/");
  }

  function startEditingProfile() {
    setProfileError("");
    setProfileMessage("");
    setFullName(getUserName());
    setEditingProfile(true);
  }

  function cancelEditingProfile() {
    setEditingProfile(false);
    setProfileError("");
    setProfileMessage("");
    setFullName(getUserName());
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f7f2]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#d9e0e5] border-t-[#102f46]" />

          <p className="text-sm text-[#607080]">
            Loading your dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#102f46]">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-[#dfe4e7] bg-[#f8f7f2]/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <button
            onClick={goHome}
            className="flex items-center"
          >
            <img
              src="/spatdel.png"
              alt="SPATDEL"
              className="h-14 w-auto object-contain"
            />
          </button>

          <button
            onClick={goHome}
            className="flex items-center gap-2 rounded-full border border-[#d5dde2] bg-white px-4 py-2.5 text-sm font-semibold transition hover:border-[#102f46] hover:bg-[#f1f4f5]"
          >
            <ArrowLeft size={17} />
            Back Home
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
        {/* DASHBOARD HEADER */}
        <div className="mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-[#738391]">
                Tenant Dashboard
              </p>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Welcome back, {getUserName()}.
              </h1>

              <p className="mt-3 max-w-2xl text-[#607080]">
                Find your next home, manage saved properties
                and keep track of your SPATDEL activity.
              </p>
            </div>

            <button
              onClick={goHome}
              className="inline-flex w-fit items-center gap-2 rounded-full bg-[#102f46] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#183d57]"
            >
              <Search size={17} />
              Find a Home
            </button>
          </div>
        </div>

        {/* PROFILE CARD */}
        <div className="mb-6 overflow-hidden rounded-3xl border border-[#dce3e7] bg-white shadow-sm">
          <div className="bg-[#102f46] px-6 py-7 sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e9b949] text-xl font-bold text-[#102f46]">
                  {getUserInitials()}
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white">
                    {getUserName()}
                  </h2>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#c7d4dc]">
                    <Mail size={15} />
                    {user?.email}
                  </div>
                </div>
              </div>

              <div className="flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                <User size={17} />
                {getRoleLabel()}
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* SAVED HOMES */}
            <div className="rounded-2xl bg-[#f5f7f8] p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#102f46] text-white">
                <Heart size={19} />
              </div>

              <p className="text-sm text-[#738391]">
                Saved Homes
              </p>

              <p className="mt-1 text-2xl font-bold">
                {savedProperties.length}
              </p>
            </div>

            {/* ENQUIRIES */}
            <div className="rounded-2xl bg-[#f5f7f8] p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#102f46] text-white">
                <FileText size={19} />
              </div>

              <p className="text-sm text-[#738391]">
                Enquiries
              </p>

              <p className="mt-1 text-2xl font-bold">
                {enquiries.length}
              </p>
            </div>

            {/* MESSAGES */}
            <div className="rounded-2xl bg-[#f5f7f8] p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#102f46] text-white">
                <MessageSquare size={19} />
              </div>

              <p className="text-sm text-[#738391]">
                Messages
              </p>

              <p className="mt-1 text-2xl font-bold">
                0
              </p>
            </div>

            {/* LIFETIME RENT DISCOUNT — TENANTS ONLY */}
            {userRole === "tenant" && (
              <div className="rounded-2xl bg-[#f5f7f8] p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#102f46] text-white">
                  <Trophy size={19} />
                </div>
                <p className="text-sm text-[#738391]">Lifetime Rent Discount</p>
                <p className="mt-1 text-2xl font-bold">
                  {rewardAmount !== null
                    ? "₦" + rewardAmount.toLocaleString("en-NG")
                    : rewardLoading ? "Loading..." : "Not claimed"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="mb-6">
          <h2 className="mb-4 text-xl font-bold">
            Quick Actions
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* FIND HOMES */}
            <button
              onClick={goHome}
              className="group rounded-3xl border border-[#dce3e7] bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f0f4] text-[#102f46]">
                <Search size={21} />
              </div>

              <h3 className="font-bold">
                Find Homes
              </h3>

              <p className="mt-1 text-sm text-[#738391]">
                Browse verified properties.
              </p>

              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#102f46]">
                Explore
                <ChevronRight size={14} />
              </div>
            </button>

            {/* SAVED HOMES */}
            <button
              onClick={() =>
                document
                  .getElementById("saved-homes")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
              className="group rounded-3xl border border-[#dce3e7] bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff4d6] text-[#9a7010]">
                <Heart size={21} />
              </div>

              <h3 className="font-bold">
                Saved Homes
              </h3>

              <p className="mt-1 text-sm text-[#738391]">
                View properties you saved.
              </p>

              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#102f46]">
                View Saved
                <ChevronRight size={14} />
              </div>
            </button>

            {/* MESSAGES */}
            <button
              onClick={() => {
                alert(
                  "The SPATDEL chat system will be connected here next."
                );
              }}
              className="group rounded-3xl border border-[#dce3e7] bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f4ed] text-[#28734b]">
                <MessageSquare size={21} />
              </div>

              <h3 className="font-bold">
                Messages
              </h3>

              <p className="mt-1 text-sm text-[#738391]">
                Chat with agents and landlords.
              </p>

              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#102f46]">
                Open Chat
                <ChevronRight size={14} />
              </div>
            </button>

            {/* ESCROW */}
            <button
              onClick={() => {
                alert(
                  "SPATDEL Escrow will be connected here when the payment system is built."
                );
              }}
              className="group rounded-3xl border border-[#dce3e7] bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f0f4] text-[#102f46]">
                <Wallet size={21} />
              </div>

              <h3 className="font-bold">
                Escrow Security
              </h3>

              <p className="mt-1 text-sm text-[#738391]">
                Secure your future property payments.
              </p>

              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#102f46]">
                Learn More
                <ChevronRight size={14} />
              </div>
            </button>
          </div>
        </div>

        {/* SAVED HOMES */}
        <div
          id="saved-homes"
          className="mb-6 rounded-3xl border border-[#dce3e7] bg-white p-6 shadow-sm sm:p-7"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f0f4] text-[#102f46]">
                <Home size={21} />
              </div>

              <h2 className="text-xl font-bold">
                My Saved Homes
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#687987]">
                Keep track of verified homes you are interested in.
              </p>
            </div>

            <div className="rounded-full bg-[#f5f7f8] px-3 py-1 text-xs font-bold text-[#607080]">
              {savedProperties.length} saved
            </div>
          </div>

          {/* ERROR */}
          {savedPropertyError && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600">
              {savedPropertyError}
            </div>
          )}

          {/* LOADING */}
          {loadingSavedProperties ? (
            <div className="mt-6 rounded-2xl border border-[#dce3e7] bg-[#fafbfb] p-6 text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#d9e0e5] border-t-[#102f46]" />

              <p className="text-sm font-semibold text-[#607080]">
                Loading saved homes...
              </p>
            </div>
          ) : savedProperties.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#cfd9df] bg-[#fafbfb] p-7 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#fff4d6] text-[#9a7010]">
                <Heart size={21} />
              </div>

              <p className="text-sm font-semibold">
                No saved homes yet
              </p>

              <p className="mx-auto mt-1 max-w-md text-sm text-[#738391]">
                Explore verified homes and save the ones you
                like so you can come back to them later.
              </p>

              <button
                onClick={goHome}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#102f46] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#183d57]"
              >
                Find Homes
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {savedProperties.map((property) => (
                <div
                  key={property.id}
                  className="overflow-hidden rounded-2xl border border-[#dce3e7] bg-[#fafbfb]"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* IMAGE */}
                    <div className="relative h-48 w-full shrink-0 overflow-hidden sm:h-auto sm:w-44">
                      <img
                        src={property.image}
                        alt={property.title}
                        className="h-full w-full object-cover"
                      />

                      {property.verified && (
                        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-[#28734b] px-2.5 py-1 text-[10px] font-bold text-white">
                          <ShieldCheck size={12} />
                          Verified
                        </div>
                      )}
                    </div>

                    {/* DETAILS */}
                    <div className="min-w-0 flex-1 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-bold text-[#102f46]">
                            {property.title}
                          </h3>

                          {property.location && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-[#738391]">
                              <MapPin size={13} />

                              <span className="truncate">
                                {property.location}
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() =>
                            removeSavedProperty(
                              property.id
                            )
                          }
                          disabled={
                            removingPropertyId ===
                            property.id
                          }
                          aria-label="Remove saved property"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 bg-white text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <p className="mt-3 text-lg font-bold text-[#102f46]">
                        {getDisplayedPrice(property.price)}
                        {getOriginalPrice(property.price) && (
                          <span className="ml-2 text-sm font-semibold text-[#9aa4aa] line-through decoration-2">
                            {getOriginalPrice(property.price)}
                          </span>
                        )}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#607080]">
                        <span className="flex items-center gap-1">
                          <BedDouble size={14} />
                          {property.beds} beds
                        </span>

                        <span className="flex items-center gap-1">
                          <Bath size={14} />
                          {property.baths} baths
                        </span>

                        <span className="flex items-center gap-1">
                          <Maximize size={14} />
                          {property.sqm}
                        </span>
                      </div>

                      <button
                        onClick={goHome}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#102f46] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#183d57]"
                      >
                        View Home
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LOWER DASHBOARD GRID */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* LIFETIME SPIN REWARD — TENANTS ONLY */}
          {userRole === "tenant" && (
            <div className="rounded-3xl border border-[#dce3e7] bg-white p-6 shadow-sm sm:p-7">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff4d6] text-[#9a7010]">
                <Trophy size={21} />
              </div>
              <h2 className="text-xl font-bold">One-Time Rent Discount</h2>
              <p className="mt-2 text-sm leading-6 text-[#687987]">
                Spin once in your lifetime. Your naira reward is saved permanently and reduces every available house's displayed price.
              </p>

              <div className="mt-6 grid items-center gap-6 sm:grid-cols-2">
                <div className="flex flex-col items-center">
                  <div
                    className="relative h-52 w-52 rounded-full border-[6px] border-[#102f46] shadow-lg"
                    style={{
                      transform: `rotate(${rewardWheelRotation}deg)`,
                      transition: spinningReward
                        ? "transform 1.8s cubic-bezier(0.12, 0.8, 0.18, 1)"
                        : "none",
                    }}
                  >
                    <div
                      className="absolute inset-1 rounded-full"
                      style={{
                        background: "conic-gradient(from -30deg, #087b62 0deg 60deg, #f05a00 60deg 120deg, #102f46 120deg 180deg, #19b87a 180deg 240deg, #f05a00 240deg 300deg, #155e75 300deg 360deg)",
                      }}
                    />
                    <span className="absolute left-1/2 top-[10%] -translate-x-1/2 text-xs font-black text-white">₦5K</span>
                    <span className="absolute right-[4%] top-[29%] rotate-45 text-xs font-black text-white">₦10K</span>
                    <span className="absolute right-[5%] bottom-[25%] -rotate-45 text-xs font-black text-white">₦15K</span>
                    <span className="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-xs font-black text-white">₦20K</span>
                    <span className="absolute bottom-[25%] left-[3%] rotate-45 text-xs font-black text-white">₦25K</span>
                    <span className="absolute left-[4%] top-[29%] -rotate-45 text-xs font-black text-white">₦30K</span>
                    <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-[#071b18]" />
                  </div>
                  <button
                    onClick={spinTenantReward}
                    disabled={spinningReward || rewardLoading || rewardAmount !== null || Boolean(rewardSpunAt)}
                    className="mt-4 rounded-full bg-[#102f46] px-6 py-3 text-sm font-black text-white transition hover:bg-[#174763] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {spinningReward
                      ? "SPINNING..."
                      : rewardLoading
                        ? "CHECKING..."
                        : rewardAmount !== null || rewardSpunAt
                          ? "SPIN USED"
                          : "SPIN ONCE"}
                  </button>
                </div>

                <div className="rounded-2xl bg-[#102f46] p-5 text-white">
                  <p className="text-xs uppercase tracking-wider text-[#b9c8d2]">Your saved reward</p>
                  <p className="mt-2 text-3xl font-black text-[#e9b949]">
                    {rewardAmount !== null
                      ? "₦" + rewardAmount.toLocaleString("en-NG")
                      : rewardLoading ? "Loading..." : "Not claimed"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#d3dee5]">
                    {rewardAmount !== null
                      ? "Your discount is active on every available house's displayed price."
                      : "Choose one spin to receive a permanent discount on every available house."}
                  </p>
                  {rewardSpunAt && (
                    <p className="mt-3 text-[10px] text-[#b9c8d2]">
                      Claimed {new Date(rewardSpunAt).toLocaleDateString("en-NG")}
                    </p>
                  )}
                </div>
              </div>

              {rewardActionError && (
                <p role="alert" className="mt-4 text-xs font-semibold text-red-600">{rewardActionError}</p>
              )}
              {rewardActionNotice && (
                <p role="status" className="mt-4 text-xs font-semibold text-[#087b62]">{rewardActionNotice}</p>
              )}
            </div>
          )}

          {/* ENQUIRIES */}
          <div
            id="enquiries"
            className="rounded-3xl border border-[#dce3e7] bg-white p-6 shadow-sm sm:p-7"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f0f4] text-[#102f46]">
              <FileText size={21} />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">
                  My Enquiries
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#687987]">
                  Property enquiries you make will appear here,
                  including replies from agents and landlords.
                </p>
              </div>

              <div className="shrink-0 rounded-full bg-[#f5f7f8] px-3 py-1 text-xs font-bold text-[#607080]">
                {enquiries.length}
              </div>
            </div>

            {/* ENQUIRY ERROR */}
            {enquiryError && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600">
                {enquiryError}
              </div>
            )}

            {/* ENQUIRY LOADING */}
            {loadingEnquiries ? (
              <div className="mt-6 rounded-2xl border border-[#dce3e7] bg-[#fafbfb] p-6 text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#d9e0e5] border-t-[#102f46]" />

                <p className="text-sm font-semibold text-[#607080]">
                  Loading your enquiries...
                </p>
              </div>
            ) : enquiries.length === 0 ? (
              <div className="mt-6 rounded-2xl bg-[#f5f7f8] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#738391]">
                    <FileText size={18} />
                  </div>

                  <div>
                    <p className="font-semibold">
                      No enquiries yet
                    </p>

                    <p className="mt-1 text-xs text-[#738391]">
                      Start by finding a property you like.
                    </p>
                  </div>
                </div>

                <button
                  onClick={goHome}
                  className="mt-4 flex items-center gap-2 rounded-full bg-[#102f46] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#183d57]"
                >
                  Browse Properties
                  <ChevronRight size={15} />
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {enquiries.map((enquiry) => (
                  <div
                    key={enquiry.id}
                    className="overflow-hidden rounded-2xl border border-[#dce3e7] bg-[#fafbfb]"
                  >
                    <div className="flex flex-col sm:flex-row">
                      {/* PROPERTY IMAGE */}
                      {enquiry.property?.image ? (
                        <div className="h-40 w-full shrink-0 overflow-hidden sm:h-auto sm:w-36">
                          <img
                            src={enquiry.property.image}
                            alt={
                              enquiry.property.title ||
                              "Property"
                            }
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-40 w-full shrink-0 items-center justify-center bg-[#e8f0f4] text-[#102f46] sm:h-auto sm:w-36">
                          <Home size={28} />
                        </div>
                      )}

                      {/* ENQUIRY DETAILS */}
                      <div className="min-w-0 flex-1 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="font-bold text-[#102f46]">
                              {enquiry.property?.title ||
                                "Property enquiry"}
                            </h3>

                            {enquiry.property?.location && (
                              <div className="mt-1 flex items-center gap-1 text-xs text-[#738391]">
                                <MapPin size={13} />

                                <span className="truncate">
                                  {
                                    enquiry.property
                                      .location
                                  }
                                </span>
                              </div>
                            )}
                          </div>

                          <div
                            className={`flex w-fit shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${getStatusClasses(
                              enquiry.status
                            )}`}
                          >
                            {getStatusIcon(
                              enquiry.status
                            )}
                            {getStatusLabel(
                              enquiry.status
                            )}
                          </div>
                        </div>

                        <p className="mt-3 text-sm font-bold text-[#102f46]">
                          {enquiry.subject}
                        </p>

                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#687987]">
                          {enquiry.message}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-[#8a969f]">
                            {formatEnquiryDate(
                              enquiry.created_at
                            )}
                          </p>

                          <button
                            onClick={goHome}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#102f46] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#183d57]"
                          >
                            View Home
                            <ChevronRight
                              size={14}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MESSAGES */}
          <div className="rounded-3xl border border-[#dce3e7] bg-white p-6 shadow-sm sm:p-7">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f4ed] text-[#28734b]">
              <MessageSquare size={21} />
            </div>

            <h2 className="text-xl font-bold">
              Messages
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#687987]">
              Chat with verified agents and landlords about
              properties you are interested in.
            </p>

            <div className="mt-6 rounded-2xl bg-[#f5f7f8] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#738391]">
                  <MessageSquare size={18} />
                </div>

                <div>
                  <p className="font-semibold">
                    Chat is coming next
                  </p>

                  <p className="mt-1 text-xs text-[#738391]">
                    Your property conversations will appear here.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ESCROW */}
          <div className="rounded-3xl border border-[#dce3e7] bg-white p-6 shadow-sm sm:p-7">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f0f4] text-[#102f46]">
              <Wallet size={21} />
            </div>

            <h2 className="text-xl font-bold">
              Escrow Security
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#687987]">
              Keep your property payments protected through
              SPATDEL's secure escrow system.
            </p>

            <div className="mt-6 rounded-2xl bg-[#f5f7f8] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8f4ed] text-[#28734b]">
                  <CheckCircle2 size={19} />
                </div>

                <div>
                  <p className="font-semibold">
                    No active transaction
                  </p>

                  <p className="mt-1 text-xs text-[#738391]">
                    Your escrow transactions will appear here.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ACCOUNT SECURITY */}
          <div className="rounded-3xl border border-[#dce3e7] bg-white p-6 shadow-sm sm:p-7">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f4ed] text-[#28734b]">
              <ShieldCheck size={21} />
            </div>

            <h2 className="text-xl font-bold">
              Account Security
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#687987]">
              Your authentication is handled securely through
              Supabase.
            </p>

            <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#f5f7f8] p-4">
              <div>
                <p className="font-semibold">
                  Email authentication
                </p>

                <p className="mt-1 text-xs text-[#738391]">
                  Password protected account
                </p>
              </div>

              <ShieldCheck
                size={22}
                className="text-[#28734b]"
              />
            </div>

            <button
              onClick={() =>
                router.push("/reset-password")
              }
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#d5dde2] bg-white py-3 text-sm font-bold transition hover:bg-[#f5f7f8]"
            >
              <Lock size={16} />
              Reset Password
            </button>
          </div>

          {/* SETTINGS */}
          <div className="rounded-3xl border border-[#dce3e7] bg-white p-6 shadow-sm sm:p-7">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f0f4] text-[#102f46]">
              <Settings size={21} />
            </div>

            <h2 className="text-xl font-bold">
              Account Settings
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#687987]">
              Update your profile information and account
              preferences.
            </p>

            {!editingProfile ? (
              <>
                <div className="mt-5 rounded-2xl bg-[#f5f7f8] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        Profile information
                      </p>

                      <p className="mt-1 truncate text-sm text-[#738391]">
                        {getUserName()}
                      </p>

                      <p className="mt-1 truncate text-xs text-[#8a969f]">
                        {user?.email}
                      </p>

                      <p className="mt-1 text-xs font-semibold capitalize text-[#102f46]">
                        {getRoleLabel()}
                      </p>
                    </div>

                    <button
                      onClick={startEditingProfile}
                      className="flex shrink-0 items-center gap-2 rounded-full bg-[#102f46] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#183d57]"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                  </div>
                </div>

                {profileMessage && (
                  <p className="mt-3 text-sm font-semibold text-[#28734b]">
                    {profileMessage}
                  </p>
                )}
              </>
            ) : (
              <div className="mt-5 rounded-2xl bg-[#f5f7f8] p-4">
                <label className="text-sm font-semibold">
                  Full Name
                </label>

                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setProfileError("");
                  }}
                  placeholder="Enter your full name"
                  disabled={savingProfile}
                  className="mt-2 w-full rounded-xl border border-[#d5dde2] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#102f46] disabled:cursor-not-allowed disabled:bg-[#eef1f3]"
                />

                {profileError && (
                  <p className="mt-2 text-sm font-semibold text-red-600">
                    {profileError}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="flex items-center gap-2 rounded-full bg-[#102f46] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#183d57] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save size={16} />

                    {savingProfile
                      ? "Saving..."
                      : "Save Changes"}
                  </button>

                  <button
                    onClick={cancelEditingProfile}
                    disabled={savingProfile}
                    className="rounded-full border border-[#d5dde2] bg-white px-5 py-2.5 text-sm font-bold transition hover:bg-[#eef1f3] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* NOTIFICATION PREVIEW */}
        <div className="mt-6 rounded-3xl border border-[#dce3e7] bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fff4d6] text-[#9a7010]">
                <Bell size={21} />
              </div>

              <div>
                <h2 className="font-bold">
                  Property Notifications
                </h2>

                <p className="mt-1 text-sm text-[#738391]">
                  Important property updates and replies will
                  appear here when notifications are connected.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-[#f5f7f8] px-4 py-2 text-xs font-bold text-[#607080]">
              <CheckCircle2 size={14} />
              Ready
            </div>
          </div>
        </div>

        {/* SIGN OUT */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 rounded-full border border-red-200 bg-white px-6 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={17} />

            {signingOut
              ? "Signing out..."
              : "Sign Out"}
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#dfe4e7] bg-[#102f46] px-5 py-8 text-center text-sm text-[#b9c8d2]">
        <p>
          © {new Date().getFullYear()} SPATDEL. Smart Property &
          Community.
        </p>
      </footer>
    </main>
  );
}

