"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  FileWarning,
  Home,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Users,
  X,
  MapPin,
  BedDouble,
  Bath,
  Ruler,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type UserRole = "tenant" | "agent" | "landlord" | "chairman" | "admin";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  created_at?: string | null;
};

type ChairmanApplication = {
  id: string;
  user_id: string;
  community_name: string;
  country: string;
  state: string;
  local_government: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  applicant_name?: string;
  applicant_email?: string;
};

type CommunityOption = {
  id: string;
  name: string;
  state: string | null;
  country: string | null;
  local_government: string | null;
  status: "active" | "inactive" | "pending";
};

type CommunityReport = {
  id: string;
  reporter_id: string;
  target_type: "post" | "comment" | "message";
  target_id: string;
  reason: string;
  status: "open" | "resolved";
  created_at: string;
  reporter_name?: string;
  target_content?: string;
};

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
  verified?: boolean | null;
  location?: string | null;
  type?: string | null;
  listing_purpose?: "rent" | "sale" | null;
  flood_risk?: string | null;
  power_hours?: string | null;
  description?: string | null;
  created_at?: string | null;
  approval_status?: "pending" | "approved" | "rejected" | "changes_requested" | null;
  submitted_by?: string | null;
  review_note?: string | null;
  images?: string[] | null;
};

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [communityReports, setCommunityReports] = useState<CommunityReport[]>([]);
  const [chairmanApplications, setChairmanApplications] = useState<ChairmanApplication[]>([]);
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [selectedCommunityByApplication, setSelectedCommunityByApplication] = useState<Record<string, string>>({});
  const [loadingChairmanApplications, setLoadingChairmanApplications] = useState(false);
  const [reviewingApplicationId, setReviewingApplicationId] = useState<string | null>(null);
  const [newCommunityName, setNewCommunityName] = useState("");
  const [newCommunityCountry, setNewCommunityCountry] = useState("");
  const [newCommunityState, setNewCommunityState] = useState("");
  const [newCommunityLga, setNewCommunityLga] = useState("");
  const [creatingCommunity, setCreatingCommunity] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] =
    useState<"all" | UserRole>("all");

  const [propertySearch, setPropertySearch] = useState("");
  const [propertyFilter, setPropertyFilter] =
    useState<"all" | "verified" | "pending">("all");

  const [updatingRoleId, setUpdatingRoleId] =
    useState<string | null>(null);

  const [updatingPropertyId, setUpdatingPropertyId] =
    useState<string | null>(null);

  const [selectedProperty, setSelectedProperty] =
    useState<Property | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAdminData = useCallback(async () => {
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: adminProfile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, full_name, email, role, created_at")
        .eq("id", user.id)
        .single();

    if (profileError || !adminProfile) {
      router.replace("/");
      return;
    }

    if (adminProfile.role !== "admin") {
      router.replace("/");
      return;
    }

    setProfile(adminProfile);

    setLoadingUsers(true);

    const { data: allUsers, error: usersError } =
      await supabase
        .from("profiles")
        .select("id, full_name, email, role, created_at")
        .order("created_at", { ascending: false });

    if (usersError) {
      setError(
        `Could not load users: ${usersError.message}`
      );
    } else {
      setUsers(allUsers || []);
    }

    setLoadingUsers(false);

    setLoadingProperties(true);

    const { data: propertyData, error: propertyError } =
      await supabase
        .from("properties")
        .select(
          "id, title, price, beds, baths, sqm, image, images, flood, power, verified, approval_status, submitted_by, reviewed_by, reviewed_at, review_note, location, type, listing_purpose, flood_risk, power_hours, description, created_at"
        )
        .order("created_at", { ascending: false });

    if (propertyError) {
      setError((current) =>
        current
          ? `${current} Properties: ${propertyError.message}`
          : `Could not load properties: ${propertyError.message}`
      );
    } else {
      setProperties(propertyData || []);
    }

    setLoadingProperties(false);

    setLoadingReports(true);
    const { data: reportData, error: reportsError } = await supabase
      .from("spatdel_community_reports")
      .select("id, reporter_id, target_type, target_id, reason, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (reportsError) {
      setError((current) =>
        current
          ? `${current} Community reports: ${reportsError.message}`
          : `Could not load community reports: ${reportsError.message}`
      );
    } else {
      const rows = (reportData || []) as CommunityReport[];
      const targetIds = (type: CommunityReport["target_type"]) =>
        rows.filter((report) => report.target_type === type).map((report) => report.target_id);

      const [postsResult, commentsResult, messagesResult] = await Promise.all([
        targetIds("post").length
          ? supabase.from("spatdel_community_posts").select("id, body").in("id", targetIds("post"))
          : Promise.resolve({ data: [], error: null }),
        targetIds("comment").length
          ? supabase.from("spatdel_community_comments").select("id, body").in("id", targetIds("comment"))
          : Promise.resolve({ data: [], error: null }),
        targetIds("message").length
          ? supabase.from("spatdel_community_messages").select("id, body").in("id", targetIds("message"))
          : Promise.resolve({ data: [], error: null }),
      ]);

      const contentById = new Map<string, string>();
      for (const item of [...(postsResult.data || []), ...(commentsResult.data || []), ...(messagesResult.data || [])]) {
        contentById.set(item.id, item.body);
      }

      const reporterIds = Array.from(new Set(rows.map((report) => report.reporter_id)));
      const { data: reporterProfiles } = reporterIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", reporterIds)
        : { data: [] };
      const reporterNameById = new Map(
        (reporterProfiles || []).map((item) => [item.id, item.full_name || item.email || "SPATDEL member"])
      );

      setCommunityReports(rows.map((report) => ({
        ...report,
        reporter_name: reporterNameById.get(report.reporter_id) || "SPATDEL member",
        target_content: contentById.get(report.target_id) || "[Content unavailable or already deleted]",
      })));
    }
    setLoadingReports(false);

    setLoadingChairmanApplications(true);
    const [applicationsResult, communitiesResult] = await Promise.all([
      supabase
        .from("chairman_applications")
        .select("id, user_id, community_name, country, state, local_government, reason, status, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("communities")
        .select("id, name, country, state, local_government, status")
        .order("name", { ascending: true }),
    ]);

    if (applicationsResult.error) {
      setError((current) =>
        current
          ? `${current} Chairman applications: ${applicationsResult.error.message}`
          : `Could not load chairman applications: ${applicationsResult.error.message}`
      );
    } else {
      const applicationRows = (applicationsResult.data || []) as ChairmanApplication[];
      const applicantIds = Array.from(new Set(applicationRows.map((application) => application.user_id)));
      const { data: applicantProfiles } = applicantIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", applicantIds)
        : { data: [] };
      const applicantById = new Map(
        (applicantProfiles || []).map((item) => [item.id, item])
      );
      setChairmanApplications(applicationRows.map((application) => ({
        ...application,
        applicant_name: applicantById.get(application.user_id)?.full_name || "SPATDEL member",
        applicant_email: applicantById.get(application.user_id)?.email || "",
      })));
    }

    if (communitiesResult.error) {
      setError((current) =>
        current
          ? `${current} Communities: ${communitiesResult.error.message}`
          : `Could not load communities: ${communitiesResult.error.message}`
      );
    } else {
      setCommunities((communitiesResult.data || []) as CommunityOption[]);
    }
    setLoadingChairmanApplications(false);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function changeUserRole(
    userId: string,
    newRole: UserRole
  ) {
    if (userId === profile?.id) {
      setError(
        "You cannot change your own admin role here."
      );
      return;
    }

    setError("");
    setSuccess("");
    setUpdatingRoleId(userId);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (updateError) {
      setError(
        `Could not update role: ${updateError.message}`
      );
      setUpdatingRoleId(null);
      return;
    }

    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId
          ? { ...user, role: newRole }
          : user
      )
    );

    setSuccess("User role updated successfully.");
    setUpdatingRoleId(null);

    setTimeout(() => {
      setSuccess("");
    }, 3000);
  }

  async function deleteProperty(property: Property) {
    const confirmed = window.confirm(
      `Delete "${property.title}" permanently? This cannot be undone.`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setUpdatingPropertyId(property.id);

    const { error: deleteError } = await supabase
      .from("properties")
      .delete()
      .eq("id", property.id);

    if (deleteError) {
      setError(`Could not delete property: ${deleteError.message}`);
      setUpdatingPropertyId(null);
      return;
    }

    setProperties((current) => current.filter((item) => item.id !== property.id));
    setSelectedProperty((current) => current?.id === property.id ? null : current);
    setSuccess("Property deleted successfully.");
    setUpdatingPropertyId(null);
  }

  async function togglePropertyVerification(
    property: Property
  ) {
    setError("");
    setSuccess("");
    setUpdatingPropertyId(property.id);

    const nextVerified = property.verified !== true;

    const { error: updateError } = await supabase
      .from("properties")
      .update({
        verified: nextVerified,
        approval_status: nextVerified ? "approved" : "pending",
        reviewed_by: nextVerified ? profile?.id ?? null : null,
        reviewed_at: nextVerified ? new Date().toISOString() : null,
      })
      .eq("id", property.id);

    if (updateError) {
      setError(
        `Could not update property verification: ${updateError.message}`
      );
      setUpdatingPropertyId(null);
      return;
    }

    setProperties((currentProperties) =>
      currentProperties.map((item) =>
        item.id === property.id
          ? {
              ...item,
              verified: nextVerified,
              approval_status: nextVerified ? "approved" : "pending",
              reviewed_by: nextVerified ? profile?.id ?? null : null,
              reviewed_at: nextVerified ? new Date().toISOString() : null,
            }
          : item
      )
    );

    setSelectedProperty((current) =>
      current?.id === property.id
        ? {
            ...current,
            verified: nextVerified,
          }
        : current
    );

    setSuccess(
      nextVerified
        ? "Property verified successfully."
        : "Property moved back to pending."
    );

    setUpdatingPropertyId(null);

    setTimeout(() => {
      setSuccess("");
    }, 3000);
  }

  async function createCommunity() {
    const name = newCommunityName.trim();
    const country = newCommunityCountry.trim();
    const state = newCommunityState.trim();
    const localGovernment = newCommunityLga.trim();
    if (!name || !country || !state || !localGovernment) {
      setError("Enter the country, region/state, administrative area, and community name.");
      return;
    }

    setError("");
    setSuccess("");
    setCreatingCommunity(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: createError } = await supabase
      .from("communities")
      .insert({
        name,
        country,
        state,
        local_government: localGovernment,
        status: "active",
        created_by: user?.id ?? null,
      })
      .select("id, name, country, state, local_government, status")
      .single();

    if (createError || !data) {
      setError(`Could not create community: ${createError?.message || "No community returned"}`);
      setCreatingCommunity(false);
      return;
    }

    setCommunities((current) => [...current, data as CommunityOption].sort((a, b) => a.name.localeCompare(b.name)));
    setNewCommunityName("");
    setNewCommunityCountry("");
    setNewCommunityState("");
    setNewCommunityLga("");
    setSuccess("Community created successfully.");
    setCreatingCommunity(false);
  }

  async function reviewChairmanApplication(application: ChairmanApplication, decision: "approved" | "rejected") {
    const communityId = selectedCommunityByApplication[application.id];
    if (decision === "approved" && !communityId) {
      setError("Choose a community before approving and assigning this chairman.");
      return;
    }

    setError("");
    setSuccess("");
    setReviewingApplicationId(application.id);

    const { data: { user } } = await supabase.auth.getUser();
    const { error: applicationError } = await supabase
      .from("chairman_applications")
      .update({
        status: decision,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", application.id);

    if (applicationError) {
      setError(`Could not update application: ${applicationError.message}`);
      setReviewingApplicationId(null);
      return;
    }

    if (decision === "approved") {
      const { error: roleError } = await supabase
        .from("profiles")
        .update({ role: "chairman" })
        .eq("id", application.user_id);
      if (roleError) {
        setError(`Application was approved, but the chairman role could not be granted: ${roleError.message}`);
        setReviewingApplicationId(null);
        await loadAdminData();
        return;
      }

      const { error: assignmentError } = await supabase
        .from("community_chairmen")
        .upsert({
          community_id: communityId,
          chairman_id: application.user_id,
          assigned_by: user?.id ?? null,
        }, { onConflict: "community_id,chairman_id" });

      if (assignmentError) {
        setError(`Chairman role granted, but community assignment failed: ${assignmentError.message}`);
        setReviewingApplicationId(null);
        await loadAdminData();
        return;
      }

      setSuccess("Chairman application approved and community assigned.");
    } else {
      setSuccess("Chairman application rejected.");
    }

    setChairmanApplications((current) =>
      current.map((item) => item.id === application.id ? { ...item, status: decision } : item)
    );
    if (decision === "approved") {
      setUsers((current) => current.map((item) => item.id === application.user_id ? { ...item, role: "chairman" } : item));
    }
    setReviewingApplicationId(null);
  }

  async function resolveCommunityReport(reportId: string) {
    setError("");
    setSuccess("");
    setResolvingReportId(reportId);
    const { error: resolveError } = await supabase
      .from("spatdel_community_reports")
      .update({ status: "resolved" })
      .eq("id", reportId);
    if (resolveError) {
      setError(`Could not resolve report: ${resolveError.message}`);
    } else {
      setCommunityReports((current) =>
        current.map((report) => report.id === reportId ? { ...report, status: "resolved" } : report)
      );
      setSuccess("Community report marked as reviewed.");
    }
    setResolvingReportId(null);
  }

  const tenantCount = users.filter(
    (user) => user.role === "tenant"
  ).length;

  const agentCount = users.filter(
    (user) => user.role === "agent"
  ).length;

  const landlordCount = users.filter(
    (user) => user.role === "landlord"
  ).length;

  const adminCount = users.filter(
    (user) => user.role === "admin"
  ).length;

  const verifiedProperties = properties.filter(
    (property) => property.verified === true
  ).length;

  const pendingProperties = properties.filter(
    (property) => property.verified !== true
  ).length;

  const filteredUsers = users.filter((user) => {
    const searchValue = search.toLowerCase().trim();

    const matchesSearch =
      !searchValue ||
      (user.full_name || "")
        .toLowerCase()
        .includes(searchValue) ||
      (user.email || "")
        .toLowerCase()
        .includes(searchValue);

    const matchesRole =
      roleFilter === "all" ||
      user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const filteredProperties = properties.filter(
    (property) => {
      const searchValue =
        propertySearch.toLowerCase().trim();

      const matchesSearch =
        !searchValue ||
        property.title
          .toLowerCase()
          .includes(searchValue) ||
        (property.location || "")
          .toLowerCase()
          .includes(searchValue) ||
        (property.type || "")
          .toLowerCase()
          .includes(searchValue);

      const matchesStatus =
        propertyFilter === "all" ||
        (propertyFilter === "verified" &&
          property.verified === true) ||
        (propertyFilter === "pending" &&
          property.verified !== true);

      return matchesSearch && matchesStatus;
    }
  );

  function scrollToProperties() {
    document
      .getElementById("property-management")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  function scrollToUsers() {
    document
      .getElementById("user-management")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f7f2] text-[#102f46]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#102f46]/20 border-t-[#087b62]" />

          <p className="mt-4 text-sm text-[#71808a]">
            Loading admin dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#102f46]">
      {/* HEADER */}
      <header className="border-b border-[#102f46]/10 bg-white">
        <div className="mx-auto flex h-[76px] max-w-[1400px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center"
            >
              <img
                src="/spatdel.png"
                alt="SPATDEL"
                className="h-12 w-auto object-contain"
              />
            </button>

            <div className="hidden h-8 w-px bg-[#102f46]/10 sm:block" />

            <div className="hidden sm:block">
              <p className="text-xs font-bold uppercase tracking-wider text-[#087b62]">
                Administration
              </p>

              <p className="text-sm font-bold">
                Control Center
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold">
                {profile.full_name || "Admin"}
              </p>

              <p className="text-xs text-[#71808a]">
                Administrator
              </p>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-lg border border-[#102f46]/10 px-3 py-2 text-sm font-bold transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={17} />

              <span className="hidden sm:inline">
                Sign out
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <section className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8">
        {/* TITLE */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[#71808a]">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1 hover:text-[#087b62]"
            >
              <ArrowLeft size={15} />
              Home
            </button>

            <span>/</span>

            <span>Admin Dashboard</span>
          </div>

          <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-[#f05a00]">
                SPATDEL ADMIN
              </p>

              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                Platform Control Center
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71808a]">
                Manage users, properties, verification,
                reports, payments and the SPATDEL community.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadAdminData}
                className="flex items-center gap-2 rounded-lg border border-[#102f46]/10 bg-white px-4 py-2 text-xs font-bold transition hover:border-[#087b62]/30"
              >
                <RefreshCw size={15} />
                Refresh
              </button>

              <div className="flex items-center gap-2 rounded-full border border-[#087b62]/20 bg-[#e4f5ee] px-4 py-2 text-xs font-bold text-[#087b62]">
                <ShieldCheck size={15} />
                Admin Access
              </div>
            </div>
          </div>
        </div>

        {/* MESSAGES */}
        {error && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <p>{error}</p>

            <button
              onClick={() => setError("")}
              className="shrink-0"
              aria-label="Close error"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-[#087b62]/20 bg-[#e4f5ee] px-4 py-3 text-sm font-medium text-[#087b62]">
            {success}
          </div>
        )}

        {/* MAIN STATS */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={users.length.toString()}
            description="Registered accounts"
            icon={<Users size={21} />}
          />

          <StatCard
            title="Properties"
            value={
              loadingProperties
                ? "..."
                : properties.length.toString()
            }
            description="Listed properties"
            icon={<Building2 size={21} />}
          />

          <StatCard
            title="Verified Homes"
            value={verifiedProperties.toString()}
            description={`${pendingProperties} awaiting review`}
            icon={<CheckCircle2 size={21} />}
          />

          <StatCard
            title="Reports"
            value={communityReports.filter((report) => report.status === "open").length.toString()}
            description="Open community reports"
            icon={<FileWarning size={21} />}
          />
        </div>

        {/* ROLE STATS */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RoleCard
            title="Tenants"
            value={tenantCount}
            icon={<User size={19} />}
          />

          <RoleCard
            title="Agents"
            value={agentCount}
            icon={<Building2 size={19} />}
          />

          <RoleCard
            title="Landlords"
            value={landlordCount}
            icon={<Home size={19} />}
          />

          <RoleCard
            title="Admins"
            value={adminCount}
            icon={<ShieldCheck size={19} />}
          />
        </div>

        {/* CHAIRMAN APPLICATIONS AND COMMUNITY SETUP */}
        <section id="chairman-applications" className="mt-8 overflow-hidden rounded-2xl border border-[#102f46]/10 bg-white shadow-sm">
          <div className="border-b border-[#102f46]/10 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4f5ee] text-[#087b62]"><ShieldCheck size={20} /></div>
              <div>
                <h2 className="text-xl font-black">Chairman Applications</h2>
                <p className="text-xs text-[#71808a]">Review requests, create communities, and assign approved chairmen.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr] sm:p-6">
            <form
              onSubmit={(event) => { event.preventDefault(); void createCommunity(); }}
              className="h-fit rounded-xl border border-[#102f46]/10 bg-[#f8f7f2] p-4"
            >
              <h3 className="font-black">Create a community</h3>
              <p className="mt-1 text-xs leading-5 text-[#71808a]">Create the community first so an approved chairman can be assigned to it.</p>
              <div className="mt-4 space-y-3">
                <input value={newCommunityCountry} onChange={(event) => setNewCommunityCountry(event.target.value)} placeholder="Country (e.g. Nigeria, Ghana, UK)" required className="w-full rounded-lg border border-[#102f46]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#087b62]" />
                <input value={newCommunityState} onChange={(event) => setNewCommunityState(event.target.value)} placeholder="State / province / region" required className="w-full rounded-lg border border-[#102f46]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#087b62]" />
                <input value={newCommunityLga} onChange={(event) => setNewCommunityLga(event.target.value)} placeholder="District / county / LGA" required className="w-full rounded-lg border border-[#102f46]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#087b62]" />
                <input value={newCommunityName} onChange={(event) => setNewCommunityName(event.target.value)} placeholder="Community / estate / neighbourhood" required className="w-full rounded-lg border border-[#102f46]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#087b62]" />
                <button type="submit" disabled={creatingCommunity} className="w-full rounded-lg bg-[#102f46] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#174763] disabled:opacity-50">
                  {creatingCommunity ? "Creating..." : "Create community"}
                </button>
              </div>
              <div className="mt-4 border-t border-[#102f46]/10 pt-3">
                <p className="text-xs font-bold text-[#102f46]">{communities.length} communities available</p>
                {communities.slice(0, 5).map((community) => (
                  <p key={community.id} className="mt-2 text-xs text-[#71808a]">{community.name} · {community.local_government || "Area not set"}, {community.state || "Region not set"}, {community.country || "Country not set"}</p>
                ))}
              </div>
            </form>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black">Applications</h3>
                <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">
                  {chairmanApplications.filter((application) => application.status === "pending").length} pending
                </span>
              </div>
              {loadingChairmanApplications ? (
                <p className="py-8 text-center text-sm text-[#71808a]">Loading chairman applications...</p>
              ) : chairmanApplications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#102f46]/15 p-8 text-center">
                  <Users className="mx-auto text-[#087b62]" size={26} />
                  <p className="mt-3 font-bold">No chairman applications yet.</p>
                  <p className="mt-1 text-sm text-[#71808a]">New applications submitted through signup will appear here.</p>
                </div>
              ) : chairmanApplications.map((application) => (
                <article key={application.id} className="rounded-xl border border-[#102f46]/10 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${application.status === "pending" ? "bg-orange-50 text-orange-700" : application.status === "approved" ? "bg-[#e4f5ee] text-[#087b62]" : "bg-red-50 text-red-700"}`}>{application.status}</span>
                    <span className="text-xs text-[#71808a]">{formatDate(application.created_at)}</span>
                  </div>
                  <p className="mt-3 font-bold">{application.applicant_name || "SPATDEL member"}</p>
                  {application.applicant_email && <p className="text-xs text-[#71808a]">{application.applicant_email}</p>}
                  <p className="mt-2 text-sm">Requested community: <strong>{application.community_name}</strong></p>
                  <p className="text-sm text-[#71808a]">{application.local_government}, {application.state}, {application.country}</p>
                  {application.reason && <p className="mt-2 rounded-lg bg-[#f8f7f2] p-3 text-sm leading-5">{application.reason}</p>}
                  {application.status === "pending" && (
                    <div className="mt-4 space-y-3">
                      <label className="block text-xs font-bold text-[#71808a]">
                        Assign community
                        <select value={selectedCommunityByApplication[application.id] || ""} onChange={(event) => setSelectedCommunityByApplication((current) => ({ ...current, [application.id]: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[#102f46]/15 bg-white px-3 py-2.5 text-sm font-medium text-[#102f46] outline-none focus:border-[#087b62]">
                          <option value="">Select a community</option>
                          {communities.filter((community) => community.status === "active").map((community) => (
                            <option key={community.id} value={community.id}>{community.name} · {community.local_government || ""}{community.state ? `, ${community.state}` : ""}{community.country ? `, ${community.country}` : ""}</option>
                          ))}
                        </select>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void reviewChairmanApplication(application, "approved")} disabled={reviewingApplicationId === application.id || communities.filter((community) => community.status === "active").length === 0} className="rounded-lg bg-[#087b62] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#06644f] disabled:opacity-50">
                          {reviewingApplicationId === application.id ? "Saving..." : "Approve & assign"}
                        </button>
                        <button type="button" onClick={() => void reviewChairmanApplication(application, "rejected")} disabled={reviewingApplicationId === application.id} className="rounded-lg border border-red-200 px-4 py-2.5 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50">
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* COMMUNITY MODERATION */}
        <section id="community-moderation" className="mt-8 scroll-mt-6 overflow-hidden rounded-2xl border border-[#102f46]/10 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-[#102f46]/10 p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0e8] text-[#c34b12]"><FileWarning size={20} /></div>
              <div>
                <h2 className="text-xl font-black">Community Moderation</h2>
                <p className="text-xs text-[#71808a]">Review member reports from Community Pulse.</p>
              </div>
            </div>
            <div className="rounded-full bg-[#e4f5ee] px-3 py-1.5 text-xs font-bold text-[#087b62]">
              {communityReports.filter((report) => report.status === "open").length} open reports
            </div>
          </div>
          <div className="space-y-3 p-4 sm:p-6">
            {loadingReports ? (
              <p className="py-8 text-center text-sm text-[#71808a]">Loading community reports...</p>
            ) : communityReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#102f46]/15 p-8 text-center">
                <ShieldCheck className="mx-auto text-[#087b62]" size={28} />
                <p className="mt-3 font-bold">No community reports yet.</p>
                <p className="mt-1 text-sm text-[#71808a]">Reports submitted by members will appear here.</p>
              </div>
            ) : communityReports.map((report) => (
              <article key={report.id} className="rounded-xl border border-[#102f46]/10 p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#f8f7f2] px-2.5 py-1 text-[11px] font-bold uppercase text-[#102f46]">{report.target_type}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${report.status === "open" ? "bg-orange-50 text-orange-700" : "bg-[#e4f5ee] text-[#087b62]"}`}>{report.status === "open" ? "Needs review" : "Reviewed"}</span>
                      <span className="text-xs text-[#71808a]">{formatDate(report.created_at)}</span>
                    </div>
                    <p className="mt-3 text-sm font-bold">Reported by {report.reporter_name || "SPATDEL member"}</p>
                    <p className="mt-2 text-sm leading-6 text-[#71808a]">Reason: {report.reason}</p>
                    <div className="mt-3 rounded-lg bg-[#f8f7f2] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#71808a]">Reported content</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{report.target_content}</p>
                    </div>
                  </div>
                  {report.status === "open" && (
                    <button
                      onClick={() => void resolveCommunityReport(report.id)}
                      disabled={resolvingReportId === report.id}
                      className="shrink-0 rounded-lg bg-[#087b62] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#06644f] disabled:opacity-50"
                    >
                      {resolvingReportId === report.id ? "Saving..." : "Mark reviewed"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* USER MANAGEMENT */}
        <section
          id="user-management"
          className="mt-8 scroll-mt-6 overflow-hidden rounded-2xl border border-[#102f46]/10 bg-white shadow-sm"
        >
          <div className="border-b border-[#102f46]/10 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4f5ee] text-[#087b62]">
                    <Users size={20} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black">
                      User Management
                    </h2>

                    <p className="text-xs text-[#71808a]">
                      Manage SPATDEL accounts and roles.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71808a]"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="Search users..."
                    className="w-full rounded-lg border border-[#102f46]/10 bg-[#f8f7f2] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#087b62] sm:w-[230px]"
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) =>
                    setRoleFilter(
                      e.target.value as
                        | "all"
                        | UserRole
                    )
                  }
                  className="rounded-lg border border-[#102f46]/10 bg-[#f8f7f2] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#087b62]"
                >
                  <option value="all">All roles</option>
                  <option value="tenant">Tenants</option>
                  <option value="agent">Agents</option>
                  <option value="landlord">
                    Landlords
                  </option>
                  <option value="chairman">Chairmen</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
            </div>
          </div>

          {loadingUsers ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto h-7 w-7 animate-spin rounded-full border-4 border-[#102f46]/20 border-t-[#087b62]" />

                <p className="mt-3 text-sm text-[#71808a]">
                  Loading users...
                </p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-5 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f8f7f2] text-[#71808a]">
                <Users size={22} />
              </div>

              <h3 className="mt-4 font-bold">
                No users found
              </h3>

              <p className="mt-1 text-sm text-[#71808a]">
                Try changing your search or role filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-[#102f46]/10 bg-[#f8f7f2] text-left">
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#71808a]">
                      User
                    </th>

                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#71808a]">
                      Role
                    </th>

                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#71808a]">
                      Joined
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#71808a]">
                      Change Role
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-[#102f46]/5 last:border-0 hover:bg-[#f8f7f2]/60"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#102f46] text-sm font-black text-white">
                            {getInitials(
                              user.full_name,
                              user.email
                            )}
                          </div>

                          <div>
                            <p className="text-sm font-bold">
                              {user.full_name ||
                                "Unnamed User"}
                            </p>

                            <p className="text-xs text-[#71808a]">
                              {user.email ||
                                "No email"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <RoleBadge role={user.role} />
                      </td>

                      <td className="px-5 py-4 text-sm text-[#71808a]">
                        {formatDate(user.created_at)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {user.id === profile.id ? (
                          <span className="text-xs font-bold text-[#71808a]">
                            Current account
                          </span>
                        ) : (
                          <select
                            value={user.role}
                            disabled={
                              updatingRoleId === user.id
                            }
                            onChange={(e) =>
                              changeUserRole(
                                user.id,
                                e.target
                                  .value as UserRole
                              )
                            }
                            className="rounded-lg border border-[#102f46]/10 bg-white px-3 py-2 text-xs font-bold outline-none transition focus:border-[#087b62] disabled:opacity-50"
                          >
                            <option value="tenant">
                              Tenant
                            </option>

                            <option value="agent">
                              Agent
                            </option>

                            <option value="landlord">
                              Landlord
                            </option>

                            <option value="chairman">
                              Chairman
                            </option>

                            <option value="admin">
                              Admin
                            </option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* PROPERTY MANAGEMENT */}
        <section
          id="property-management"
          className="mt-8 scroll-mt-6 overflow-hidden rounded-2xl border border-[#102f46]/10 bg-white shadow-sm"
        >
          <div className="border-b border-[#102f46]/10 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4f5ee] text-[#087b62]">
                    <Building2 size={20} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black">
                      Property Management
                    </h2>

                    <p className="text-xs text-[#71808a]">
                      Review, verify and manage SPATDEL properties.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71808a]"
                  />

                  <input
                    type="text"
                    value={propertySearch}
                    onChange={(e) =>
                      setPropertySearch(e.target.value)
                    }
                    placeholder="Search properties..."
                    className="w-full rounded-lg border border-[#102f46]/10 bg-[#f8f7f2] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#087b62] sm:w-[230px]"
                  />
                </div>

                <select
                  value={propertyFilter}
                  onChange={(e) =>
                    setPropertyFilter(
                      e.target.value as
                        | "all"
                        | "verified"
                        | "pending"
                    )
                  }
                  className="rounded-lg border border-[#102f46]/10 bg-[#f8f7f2] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#087b62]"
                >
                  <option value="all">
                    All properties
                  </option>

                  <option value="verified">
                    Verified
                  </option>

                  <option value="pending">
                    Pending
                  </option>
                </select>
              </div>
            </div>
          </div>

          {loadingProperties ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto h-7 w-7 animate-spin rounded-full border-4 border-[#102f46]/20 border-t-[#087b62]" />

                <p className="mt-3 text-sm text-[#71808a]">
                  Loading properties...
                </p>
              </div>
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center px-5 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f8f7f2] text-[#71808a]">
                <Building2 size={22} />
              </div>

              <h3 className="mt-4 font-bold">
                No properties found
              </h3>

              <p className="mt-1 text-sm text-[#71808a]">
                Try changing your search or property filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px]">
                <thead>
                  <tr className="border-b border-[#102f46]/10 bg-[#f8f7f2] text-left">
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#71808a]">
                      Property
                    </th>

                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#71808a]">
                      Location
                    </th>

                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#71808a]">
                      Type
                    </th>

                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#71808a]">
                      Status
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#71808a]">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProperties.map((property) => (
                    <tr
                      key={property.id}
                      className="border-b border-[#102f46]/5 last:border-0 hover:bg-[#f8f7f2]/60"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-[#f8f7f2]">
                            {property.image ? (
                              <img
                                src={property.image}
                                alt={property.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#71808a]">
                                <Building2 size={20} />
                              </div>
                            )}
                          </div>

                          <div>
                            <button
                              onClick={() =>
                                setSelectedProperty(
                                  property
                                )
                              }
                              className="text-left text-sm font-bold hover:text-[#087b62]"
                            >
                              {property.title}
                            </button>

                            <p className="mt-1 text-xs text-[#71808a]">
                              {property.price}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-[#71808a]">
                          <MapPin size={14} />
                          <span>
                            {property.location ||
                              "Location not set"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-sm text-[#71808a]">{property.type || "Property"}</div>
                        <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${property.listing_purpose === "sale" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {property.listing_purpose === "sale" ? "For sale" : "For rent"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {property.verified === true ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#087b62]/20 bg-[#e4f5ee] px-3 py-1 text-xs font-bold text-[#087b62]">
                            <CheckCircle2 size={13} />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                            <FileWarning size={13} />
                            Pending
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() =>
                              setSelectedProperty(
                                property
                              )
                            }
                            className="rounded-lg border border-[#102f46]/10 bg-white px-3 py-2 text-xs font-bold transition hover:border-[#087b62]/30 hover:text-[#087b62]"
                          >
                            View
                          </button>

                          <button
                            onClick={() => deleteProperty(property)}
                            disabled={updatingPropertyId === property.id}
                            title="Delete property"
                            aria-label={`Delete ${property.title}`}
                            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>

                          <button
                            onClick={() =>
                              togglePropertyVerification(
                                property
                              )}
                            disabled={
                              updatingPropertyId ===
                              property.id
                            }
                            className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                              property.verified === true
                                ? "border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                                : "bg-[#087b62] text-white hover:bg-[#066b55]"
                            }`}
                          >
                            {updatingPropertyId ===
                            property.id
                              ? "Updating..."
                              : property.verified === true
                                ? "Unverify"
                                : "Verify"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-[#102f46]/10 bg-[#f8f7f2] px-5 py-4">
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#71808a]">
              <span>
                Total:{" "}
                <strong className="text-[#102f46]">
                  {properties.length}
                </strong>
              </span>

              <span>
                Verified:{" "}
                <strong className="text-[#087b62]">
                  {verifiedProperties}
                </strong>
              </span>

              <span>
                Pending:{" "}
                <strong className="text-orange-600">
                  {pendingProperties}
                </strong>
              </span>
            </div>
          </div>
        </section>

        {/* ADMIN MODULES */}
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AdminModule
            icon={<Users size={23} />}
            title="User Management"
            description="Manage tenants, agents and landlords."
            active
            onClick={scrollToUsers}
            actionText="Manage users →"
          />

          <AdminModule
            icon={<Building2 size={23} />}
            title="Property Management"
            description="Review and manage properties listed on SPATDEL."
            active
            onClick={scrollToProperties}
            actionText="Manage properties →"
          />

          <AdminModule
            icon={<ShieldCheck size={23} />}
            title="Verification"
            description="Review agents, landlords and property verification."
          />

          <AdminModule
            icon={<FileWarning size={23} />}
            title="Reports"
            description="Review reported users, properties and issues."
          />

          <AdminModule
            icon={<BarChart3 size={23} />}
            title="Analytics"
            description="Monitor SPATDEL activity and platform growth."
          />

          <AdminModule
            icon={<Home size={23} />}
            title="Community"
            description="Manage Community Pulse and platform activity."
          />
        </div>

        {/* NEXT SYSTEMS */}
        <div className="mt-8 overflow-hidden rounded-2xl bg-[#102f46] p-6 text-white sm:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#19e58f]">
                Next Systems
              </p>

              <h2 className="mt-2 text-2xl font-black">
                SPATDEL is being built module by module.
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                Tenant, Agent and Landlord dashboards will
                connect to this control center. The messaging
                system will later connect these roles directly.
              </p>
            </div>

            <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-5 py-4">
              <p className="text-xs text-white/50">
                Current role
              </p>

              <p className="mt-1 font-bold text-[#19e58f]">
                ADMIN
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PROPERTY DETAILS MODAL */}
      {selectedProperty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#102f46]/60 p-4 backdrop-blur-sm"
          onClick={() => setSelectedProperty(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              {selectedProperty.image ? (
                <img
                  src={selectedProperty.image}
                  alt={selectedProperty.title}
                  className="h-56 w-full object-cover sm:h-72"
                />
              ) : (
                <div className="flex h-56 items-center justify-center bg-[#f8f7f2] text-[#71808a]">
                  <Building2 size={40} />
                </div>
              )}

              <button
                onClick={() =>
                  setSelectedProperty(null)
                }
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#102f46] shadow-sm transition hover:bg-white"
                aria-label="Close property details"
              >
                <X size={18} />
              </button>

              <div className="absolute bottom-4 left-4">
                {selectedProperty.verified === true ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#e4f5ee] px-3 py-1.5 text-xs font-bold text-[#087b62] shadow-sm">
                    <CheckCircle2 size={14} />
                    Verified Property
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 shadow-sm">
                    <FileWarning size={14} />
                    Pending Verification
                  </span>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-7">
              {Array.isArray(selectedProperty.images) && selectedProperty.images.filter(Boolean).length > 1 && (
                <div className="mb-6">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#71808a]">Submitted photos</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {selectedProperty.images.filter(Boolean).map((photoUrl, index) => (
                      <a key={photoUrl + index} href={photoUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-[#dce3e7]">
                        <img src={photoUrl} alt={`Submitted property photo ${index + 1}`} className="h-28 w-full object-cover transition hover:scale-[1.02]" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#087b62]">
                    {selectedProperty.listing_purpose === "sale" ? "For sale" : "For rent"} · {selectedProperty.type || "Property"}
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    {selectedProperty.title}
                  </h2>

                  <div className="mt-2 flex items-center gap-1.5 text-sm text-[#71808a]">
                    <MapPin size={15} />
                    {selectedProperty.location ||
                      "Location not set"}
                  </div>
                </div>

                <p className="text-xl font-black text-[#087b62]">
                  {selectedProperty.price}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <PropertyInfo
                  icon={<BedDouble size={17} />}
                  label="Beds"
                  value={String(
                    selectedProperty.beds
                  )}
                />

                <PropertyInfo
                  icon={<Bath size={17} />}
                  label="Baths"
                  value={String(
                    selectedProperty.baths
                  )}
                />

                <PropertyInfo
                  icon={<Ruler size={17} />}
                  label="Size"
                  value={selectedProperty.sqm}
                />

                <PropertyInfo
                  icon={<ShieldCheck size={17} />}
                  label="Status"
                  value={
                    selectedProperty.verified
                      ? "Verified"
                      : "Pending"
                  }
                />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[#f8f7f2] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#71808a]">
                    Flood
                  </p>

                  <p className="mt-1 font-bold">
                    {selectedProperty.flood ||
                      selectedProperty.flood_risk ||
                      "Not provided"}
                  </p>
                </div>

                <div className="rounded-xl bg-[#f8f7f2] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#71808a]">
                    Power
                  </p>

                  <p className="mt-1 font-bold">
                    {selectedProperty.power ||
                      selectedProperty.power_hours ||
                      "Not provided"}
                  </p>
                </div>
              </div>

              {selectedProperty.description && (
                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#71808a]">
                    Description
                  </p>

                  <p className="mt-2 text-sm leading-6 text-[#71808a]">
                    {selectedProperty.description}
                  </p>
                </div>
              )}

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => deleteProperty(selectedProperty)}
                  disabled={updatingPropertyId === selectedProperty.id}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  Delete property
                </button>
                <button
                  onClick={() =>
                    togglePropertyVerification(
                      selectedProperty
                    )
                  }
                  disabled={
                    updatingPropertyId ===
                    selectedProperty.id
                  }
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${
                    selectedProperty.verified
                      ? "border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                      : "bg-[#087b62] text-white hover:bg-[#066b55]"
                  }`}
                >
                  {updatingPropertyId ===
                  selectedProperty.id
                    ? "Updating..."
                    : selectedProperty.verified
                      ? "Move Back To Pending"
                      : "Approve & Verify Property"}
                </button>

                <button
                  onClick={() =>
                    setSelectedProperty(null)
                  }
                  className="rounded-xl border border-[#102f46]/10 px-4 py-3 text-sm font-bold transition hover:bg-[#f8f7f2]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#102f46]/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#71808a]">
            {title}
          </p>

          <p className="mt-2 text-3xl font-black">
            {value}
          </p>

          <p className="mt-1 text-xs text-[#71808a]">
            {description}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4f5ee] text-[#087b62]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#102f46]/10 bg-white p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f8f7f2] text-[#087b62]">
        {icon}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-[#71808a]">
          {title}
        </p>

        <p className="text-xl font-black">
          {value}
        </p>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const styles = {
    tenant:
      "bg-blue-50 text-blue-700 border-blue-100",
    agent:
      "bg-orange-50 text-orange-700 border-orange-100",
    landlord:
      "bg-purple-50 text-purple-700 border-purple-100",
    admin:
      "bg-[#e4f5ee] text-[#087b62] border-[#087b62]/20",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${styles[role]}`}
    >
      {role}
    </span>
  );
}

function AdminModule({
  icon,
  title,
  description,
  active = false,
  onClick,
  actionText,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  active?: boolean;
  onClick?: () => void;
  actionText?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`group rounded-2xl border bg-white p-6 text-left shadow-sm transition ${
        onClick
          ? "hover:-translate-y-0.5 hover:shadow-md"
          : "cursor-default"
      } ${
        active
          ? "border-[#087b62]/30"
          : "border-[#102f46]/10"
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e4f5ee] text-[#087b62] transition group-hover:bg-[#087b62] group-hover:text-white">
        {icon}
      </div>

      <h3 className="mt-5 text-lg font-black">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[#71808a]">
        {description}
      </p>

      <div className="mt-5 text-xs font-bold text-[#087b62]">
        {actionText ||
          (active
            ? "Manage users →"
            : "Coming next →")}
      </div>
    </button>
  );
}

function PropertyInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#102f46]/10 bg-[#f8f7f2] p-3">
      <div className="flex items-center gap-2 text-[#087b62]">
        {icon}
        <span className="text-xs font-bold">
          {label}
        </span>
      </div>

      <p className="mt-1 text-sm font-black text-[#102f46]">
        {value}
      </p>
    </div>
  );
}

function getInitials(
  name: string | null,
  email: string | null
) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return parts[0].slice(0, 2).toUpperCase();
  }

  if (email?.trim()) {
    return email.slice(0, 2).toUpperCase();
  }

  return "US";
}

function formatDate(date: string | null | undefined) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}