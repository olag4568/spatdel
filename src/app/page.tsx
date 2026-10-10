"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowRight,
  Check,
  Heart,
  MapPin,
  Menu,
  ShieldCheck,
  Star,
  X,
  Zap,
  LogOut,
  User,
  MessageSquare,
  LayoutDashboard,
  Send,
} from "lucide-react";

type Property = {
  id: string;
  created_at?: string;
  owner_id?: string | null;
  submitted_by?: string | null;
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
};

type SavedPropertyRow = {
  property_id: string;
};

type UserRole = "tenant" | "agent" | "landlord" | "chairman" | "admin";

type Profile = {
  role: UserRole;
  full_name?: string | null;
};

type PropertyMessage = {
  id: string;
  enquiry_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  read_at?: string | null;
};

const supabase = createClient();

export default function Home() {
  const router = useRouter();

  const [mobileMenu, setMobileMenu] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [rewardAmount, setRewardAmount] = useState<number | null>(null);
  const [rewardSpunAt, setRewardSpunAt] = useState<string | null>(null);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardStatusLoaded, setRewardStatusLoaded] = useState(false);
  const [rewardError, setRewardError] = useState("");
  const [rewardNotice, setRewardNotice] = useState("");

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState("");

  const [selectedProperty, setSelectedProperty] =
    useState<Property | null>(null);

  // AUTH
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileMenu, setProfileMenu] = useState(false);

  // USER ROLE
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  // SAVED PROPERTIES
  const [savedPropertyIds, setSavedPropertyIds] = useState<string[]>([]);
  const [savingPropertyId, setSavingPropertyId] =
    useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  // ENQUIRY
  const [enquiryMode, setEnquiryMode] = useState(false);
  const [enquirySubject, setEnquirySubject] = useState("");
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [enquirySubmitting, setEnquirySubmitting] = useState(false);
  const [enquiryError, setEnquiryError] = useState("");
  const [enquirySuccess, setEnquirySuccess] = useState(false);

  // CHAT
  const [chatMode, setChatMode] = useState(false);
  const [activeEnquiryId, setActiveEnquiryId] =
    useState<string | null>(null);
  const [messages, setMessages] = useState<PropertyMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState("");

  /*
  |--------------------------------------------------------------------------
  | AUTH
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setUser(user);
      setAuthLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | PROFILE / ROLE
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!user) {
        setUserRole(null);
        setRoleLoading(false);
        return;
      }

      setRoleLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("Failed to load user profile:", error);
        setUserRole(null);
      } else {
        const profile = data as Profile | null;

        if (
          profile?.role === "tenant" ||
          profile?.role === "agent" ||
          profile?.role === "landlord" ||
          profile?.role === "admin"
        ) {
          setUserRole(profile.role);
        } else {
          setUserRole("tenant");
        }
      }

      setRoleLoading(false);
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user]);

  /*
  |--------------------------------------------------------------------------
  | LOAD TENANT'S LIFETIME REWARD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    async function loadTenantReward() {
      if (!user || userRole !== "tenant") {
        setRewardAmount(null);
        setRewardSpunAt(null);
        setRewardLoading(false);
        setRewardStatusLoaded(!user || !roleLoading);
        return;
      }

      setRewardLoading(true);
      setRewardStatusLoaded(false);
      setRewardError("");

      const { data, error } = await supabase
        .from("tenant_rewards")
        .select("reward_amount, spun_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("Failed to load tenant reward:", error);
        setRewardError("We couldn't load your reward status. Please refresh and try again.");
      } else {
        setRewardAmount(data?.reward_amount ?? null);
        setRewardSpunAt(data?.spun_at ?? null);
      }

      setRewardLoading(false);
      setRewardStatusLoaded(true);
    }

    loadTenantReward();

    return () => {
      mounted = false;
    };
  }, [user, userRole, roleLoading]);

  /*
  |--------------------------------------------------------------------------
  | LOAD PROPERTIES
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    async function loadProperties() {
      setPropertiesLoading(true);
      setPropertiesError("");

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        // Public browsing must never show listings awaiting admin approval.
        .eq("verified", true)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (error) {
        console.error("Failed to load properties:", error);

        setPropertiesError(
          "Unable to load properties right now."
        );

        setProperties([]);
      } else {
        setProperties((data ?? []) as Property[]);
      }

      setPropertiesLoading(false);
    }

    loadProperties();

    return () => {
      mounted = false;
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | LOAD SAVED PROPERTIES
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    async function loadSavedProperties() {
      if (!user) {
        setSavedPropertyIds([]);
        return;
      }

      const { data, error } = await supabase
        .from("saved_properties")
        .select("property_id")
        .eq("user_id", user.id);

      if (!mounted) return;

      if (error) {
        console.error(
          "Failed to load saved properties:",
          error
        );
        return;
      }

      const rows = (data ?? []) as SavedPropertyRow[];

      setSavedPropertyIds(
        rows.map((item) => item.property_id)
      );
    }

    loadSavedProperties();

    return () => {
      mounted = false;
    };
  }, [user]);

  /*
  |--------------------------------------------------------------------------
  | NAVIGATION
  |--------------------------------------------------------------------------
  */

  function goToLogin() {
    setProfileMenu(false);
    setMobileMenu(false);
    router.push("/login");
  }

  function goToSignup() {
    setProfileMenu(false);
    setMobileMenu(false);
    router.push("/signup");
  }

  function goToAccount() {
    setProfileMenu(false);
    setMobileMenu(false);

    if (userRole === "chairman") {
      router.push("/chairman");
      return;
    }

    if (userRole === "agent" || userRole === "landlord") {
      router.push("/agent");
      return;
    }

    if (userRole === "admin") {
      router.push("/admin");
      return;
    }

    router.push("/account");
  }

  function goToMessages() {
    setProfileMenu(false);
    setMobileMenu(false);
    router.push("/messages");
  }

  function goToAdminDashboard() {
    setProfileMenu(false);
    setMobileMenu(false);
    router.push("/admin");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();

    setUser(null);
    setUserRole(null);
    setSavedPropertyIds([]);
    setProfileMenu(false);
    setMobileMenu(false);
    setSelectedProperty(null);
    setChatMode(false);
    setEnquiryMode(false);
    setActiveEnquiryId(null);
    setMessages([]);

    router.refresh();
  }

  /*
  |--------------------------------------------------------------------------
  | PROPERTY RETURN AFTER LOGIN
  |--------------------------------------------------------------------------
  */

  function goToLoginFromProperty(property: Property) {
    sessionStorage.setItem(
      "spatdel_return_property",
      JSON.stringify(property)
    );

    router.push("/login");
  }

  function goToSignupFromProperty(property: Property) {
    sessionStorage.setItem(
      "spatdel_return_property",
      JSON.stringify(property)
    );

    router.push("/signup");
  }

  /*
  |--------------------------------------------------------------------------
  | ENQUIRY
  |--------------------------------------------------------------------------
  */

  function handlePropertyEnquiry(property: Property) {
    if (!user) {
      goToLoginFromProperty(property);
      return;
    }

    setEnquiryError("");
    setEnquirySuccess(false);
    setMessageError("");

    // Use the owner/submitter already returned with the public listing.
    // Avoid a second properties query that can fail under row-level security.
    const targetUserId = property.owner_id || property.submitted_by;

    if (!targetUserId) {
      window.alert("This property has no assigned agent or landlord yet, so SPATDEL cannot open the correct conversation. Please contact support or try another listing.");
      return;
    }

    if (targetUserId === user.id) {
      window.alert("You cannot enquire about your own listing.");
      return;
    }

    // Contact always opens the shared Messages inbox, never the old inline chat box.
    setEnquiryMode(false);
    setChatMode(false);
    setSelectedProperty(null);
    router.push(
      `/messages?user=${encodeURIComponent(targetUserId)}&property=${encodeURIComponent(property.id)}`
    );
  }

  async function submitPropertyEnquiry() {
    if (!selectedProperty) return;

    setEnquiryError("");
    setEnquirySuccess(false);

    if (!user) {
      goToLoginFromProperty(selectedProperty);
      return;
    }

    const cleanSubject = enquirySubject.trim();
    const cleanMessage = enquiryMessage.trim();

    if (!cleanSubject) {
      setEnquiryError("Please enter a subject.");
      return;
    }

    if (!cleanMessage) {
      setEnquiryError("Please enter your message.");
      return;
    }

    if (cleanMessage.length < 10) {
      setEnquiryError("Please make your message a little more detailed.");
      return;
    }

    setEnquirySubmitting(true);

    try {
      // Resolve the actual listing owner so the conversation goes to the right account.
      const { data: propertyOwner, error: ownerError } = await supabase
        .from("properties")
        .select("owner_id, submitted_by")
        .eq("id", selectedProperty.id)
        .single();

      if (ownerError) throw new Error("We could not find the agent or landlord for this property.");

      const targetUserId = propertyOwner?.owner_id || propertyOwner?.submitted_by;
      if (!targetUserId) {
        setEnquiryError("This property has no assigned agent or landlord yet.");
        return;
      }

      if (targetUserId === user.id) {
        setEnquiryError("You cannot enquire about your own listing.");
        return;
      }

      // Start/reuse the same conversation shown in the main SPATDEL Messages inbox.
      const { data: conversationId, error: chatError } = await supabase.rpc(
        "spatdel_start_chat",
        {
          target_user_id: targetUserId,
          related_property_id: selectedProperty.id,
          first_message: null,
        }
      );

      if (chatError || !conversationId) {
        console.error("Could not start linked property chat:", chatError);
        setEnquiryError("We could not open the message conversation. Please try again.");
        return;
      }

      // Link the property enquiry to that conversation. The database trigger mirrors
      // all property_messages into the main chat and vice versa.
      const { data, error } = await supabase
        .from("property_enquiries")
        .insert({
          property_id: selectedProperty.id,
          tenant_id: user.id,
          subject: cleanSubject,
          message: cleanMessage,
          status: "pending",
          conversation_id: conversationId,
        })
        .select("id")
        .single();

      if (error || !data?.id) {
        console.error("Failed to create linked property enquiry:", error);
        setEnquiryError("We could not save the enquiry. Please try again.");
        return;
      }

      const { data: messageData, error: messageError } = await supabase
        .from("property_messages")
        .insert({
          enquiry_id: data.id,
          sender_id: user.id,
          message: cleanMessage,
        })
        .select("id, enquiry_id, sender_id, message, created_at, read_at")
        .single();

      if (messageError) {
        console.error("Failed to create first property message:", messageError);
        setEnquiryError("Your enquiry was created, but the first message could not be sent.");
        return;
      }

      setMessages(messageData ? [messageData as PropertyMessage] : []);
      setActiveEnquiryId(data.id);
      setEnquirySuccess(true);
      setEnquiryMode(false);
      setChatMode(true);
      setEnquirySubject("");
      setEnquiryMessage("");
    } catch (error) {
      console.error("Unexpected enquiry error:", error);
      setEnquiryError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setEnquirySubmitting(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | CHAT
  |--------------------------------------------------------------------------
  */

  async function loadChatMessages(
    enquiryId: string
  ) {
    setMessagesLoading(true);
    setMessageError("");

    const { data, error } = await supabase
      .from("property_messages")
      .select(
        "id, enquiry_id, sender_id, message, created_at, read_at"
      )
      .eq("enquiry_id", enquiryId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Failed to load chat messages:",
        error
      );

      setMessageError(
        "Unable to load messages right now."
      );

      setMessages([]);
    } else {
      setMessages(
        (data ?? []) as PropertyMessage[]
      );
    }

    setMessagesLoading(false);
  }

  async function openChat(enquiryId: string) {
    if (!user) {
      goToLogin();
      return;
    }

    setActiveEnquiryId(enquiryId);
    setChatMode(true);
    setEnquiryMode(false);
    setEnquirySuccess(false);

    await loadChatMessages(enquiryId);
  }

  async function sendChatMessage() {
    if (!user || !activeEnquiryId) {
      return;
    }

    const cleanMessage = messageText.trim();

    if (!cleanMessage) {
      return;
    }

    if (cleanMessage.length > 1000) {
      setMessageError(
        "Message cannot exceed 1000 characters."
      );
      return;
    }

    setMessageSending(true);
    setMessageError("");

    try {
      const { data, error } = await supabase
        .from("property_messages")
        .insert({
          enquiry_id: activeEnquiryId,
          sender_id: user.id,
          message: cleanMessage,
        })
        .select(
          "id, enquiry_id, sender_id, message, created_at, read_at"
        )
        .single();

      if (error) {
        console.error(
          "Failed to send message:",
          error
        );

        setMessageError(
          "Message could not be sent. Please try again."
        );

        return;
      }

      /*
       * Add the REAL database row.
       * This prevents duplicate IDs when realtime
       * sends the same INSERT event.
       */
      if (data) {
        setMessages((oldMessages) => {
          if (
            oldMessages.some(
              (message) =>
                message.id === data.id
            )
          ) {
            return oldMessages;
          }

          return [
            ...oldMessages,
            data as PropertyMessage,
          ];
        });
      }

      setMessageText("");
    } catch (error) {
      console.error(
        "Unexpected message error:",
        error
      );

      setMessageError(
        "Something went wrong while sending."
      );
    } finally {
      setMessageSending(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | REALTIME CHAT
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!activeEnquiryId || !user) {
      return;
    }

    const channel = supabase
      .channel(
        `property-chat-${activeEnquiryId}`
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "property_messages",
          filter: `enquiry_id=eq.${activeEnquiryId}`,
        },
        (payload) => {
          const incomingMessage =
            payload.new as PropertyMessage;

          setMessages((oldMessages) => {
            if (
              oldMessages.some(
                (message) =>
                  message.id ===
                  incomingMessage.id
              )
            ) {
              return oldMessages;
            }

            return [
              ...oldMessages,
              incomingMessage,
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEnquiryId, user]);

  /*
  |--------------------------------------------------------------------------
  | PROPERTY MODAL
  |--------------------------------------------------------------------------
  */

  function closePropertyModal() {
    setSelectedProperty(null);
    setEnquiryMode(false);
    setChatMode(false);
    setActiveEnquiryId(null);
    setMessages([]);
    setMessageText("");
    setMessageError("");
    setEnquirySubject("");
    setEnquiryMessage("");
    setEnquiryError("");
    setEnquirySuccess(false);
  }

  /*
  |--------------------------------------------------------------------------
  | HELPERS
  |--------------------------------------------------------------------------
  */

  function scrollToSection(id: string) {
    setMobileMenu(false);

    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: "smooth",
      });
  }

  async function spinWheel() {
    if (spinning) return;

    if (!user) {
      setRewardError("Sign in with a tenant account to use your one-time spin.");
      router.push("/login?next=/#spin");
      return;
    }

    if (userRole !== "tenant") {
      setRewardError("Only tenant accounts can claim this reward.");
      return;
    }

    if (!rewardStatusLoaded || rewardLoading) {
      setRewardError("Checking your lifetime spin status. Please wait.");
      return;
    }

    if (rewardAmount !== null || rewardSpunAt) {
      setRewardNotice("You've already used your one-time lifetime spin.");
      return;
    }

    setSpinning(true);
    setRewardError("");
    setRewardNotice("");

    const { data, error } = await supabase.rpc("claim_tenant_spin_reward");

    if (error) {
      console.error("Failed to claim lifetime spin reward:", error);
      setRewardError(
        error.message?.includes("Only tenant")
          ? "Only tenant accounts can claim this reward."
          : "Your spin could not be saved. Please try again."
      );
      setSpinning(false);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    const reward = Number(result?.reward_amount);
    const spunAt = result?.spun_at ?? null;

    if (![5000, 10000, 15000, 20000, 25000, 30000].includes(reward) || !spunAt) {
      setRewardError("We couldn't confirm your reward. Refresh and check your reward status.");
      setSpinning(false);
      return;
    }

    if (result?.already_spun) {
      setRewardAmount(reward);
      setRewardSpunAt(spunAt);
      setRewardNotice("Your lifetime spin has already been used. Your discount is saved.");
      setSpinning(false);
      return;
    }

    const rewards = [5000, 10000, 15000, 20000, 25000, 30000];
    const rewardIndex = rewards.indexOf(reward);
    const targetRotation = (360 - rewardIndex * 60) % 360;
    setWheelRotation((current) => current + 1440 + targetRotation);

    window.setTimeout(() => {
      setRewardAmount(reward);
      setRewardSpunAt(spunAt);
      setRewardNotice(
        "Congratulations! You won ₦" + reward.toLocaleString("en-NG") +
        " off every available house's displayed price."
      );
      setSpinning(false);
    }, 1900);
  }

  function getDisplayedPrice(price: string) {
    if (userRole !== "tenant" || !rewardAmount) return price;
    const match = price.match(/(?:₦|NGN\s*)?\s*([\d,]+(?:\.\d+)?)/i);
    if (!match) return price;
    const originalAmount = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(originalAmount)) return price;
    const discountedAmount = Math.max(0, originalAmount - rewardAmount);
    return price.replace(match[0], "₦" + discountedAmount.toLocaleString("en-NG"));
  }

  function getOriginalPrice(price: string) {
    if (userRole !== "tenant" || !rewardAmount) return null;
    const match = price.match(/(?:₦|NGN\s*)?\s*([\d,]+(?:\.\d+)?)/i);
    if (!match) return null;
    const originalAmount = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(originalAmount)) return null;
    return "₦" + originalAmount.toLocaleString("en-NG");
  }

  function getUserName() {
    const metadataName =
      user?.user_metadata?.full_name;

    if (
      metadataName &&
      typeof metadataName === "string"
    ) {
      return metadataName;
    }

    const email =
      user?.email || "";

    if (email.includes("@")) {
      return email.split("@")[0];
    }

    return "SPATDEL User";
  }

  function getUserInitials() {
    const name = getUserName();

    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) {
      return "U";
    }

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return (
      parts[0][0] +
      parts[parts.length - 1][0]
    ).toUpperCase();
  }

  function getRoleLabel() {
    if (roleLoading) {
      return "Loading...";
    }

    if (!userRole) {
      return "Guest";
    }

    if (userRole === "admin") {
      return "Admin";
    }

    if (userRole === "landlord") {
      return "Landlord";
    }

    if (userRole === "chairman") {
      return "Community Chairman";
    }

    if (userRole === "agent") {
      return "Agent";
    }

    return "Tenant";
  }

  function isPropertySaved(
    propertyId: string
  ) {
    return savedPropertyIds.includes(
      propertyId
    );
  }

  async function toggleSaveProperty(
    property: Property
  ) {
    setSaveError("");

    if (!user) {
      goToLoginFromProperty(property);
      return;
    }

    if (savingPropertyId) {
      return;
    }

    setSavingPropertyId(property.id);

    try {
      const saved = isPropertySaved(
        property.id
      );

      if (saved) {
        const { error } =
          await supabase
            .from("saved_properties")
            .delete()
            .eq("user_id", user.id)
            .eq(
              "property_id",
              property.id
            );

        if (error) {
          console.error(
            "Failed to remove saved property:",
            error
          );

          setSaveError(
            "Could not remove this property from your saved homes."
          );

          return;
        }

        setSavedPropertyIds(
          (current) =>
            current.filter(
              (id) =>
                id !== property.id
            )
        );
      } else {
        const { error } =
          await supabase
            .from("saved_properties")
            .insert({
              user_id: user.id,
              property_id:
                property.id,
            });

        if (error) {
          console.error(
            "Failed to save property:",
            error
          );

          setSaveError(
            "Could not save this property right now."
          );

          return;
        }

        setSavedPropertyIds(
          (current) => [
            ...current,
            property.id,
          ]
        );
      }
    } finally {
      setSavingPropertyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#102f46]">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-[#102f46]/10 bg-[#f8f7f2]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-5 py-3 sm:px-8">
          <button
            onClick={() =>
              scrollToSection("top")
            }
            className="flex items-center"
          >
            <img
              src="/spatdel.png"
              alt="SPATDEL"
              className="h-14 w-auto object-contain"
            />
          </button>

          <nav className="hidden items-center gap-7 lg:flex">
            <button
              onClick={() =>
                scrollToSection("homes")
              }
              className="text-xs font-bold transition hover:text-[#087b62]"
            >
              Find Homes
            </button>

            <button
              onClick={() =>
                scrollToSection("community")
              }
              className="text-xs font-bold transition hover:text-[#087b62]"
            >
              Community Pulse
            </button>

            {(!user || (!roleLoading && userRole === "tenant")) && (
              <button
                onClick={() => scrollToSection("spin")}
                className="text-xs font-bold transition hover:text-[#087b62]"
              >
                Spin & Earn
              </button>
            )}

            <button
              onClick={() =>
                scrollToSection("security")
              }
              className="text-xs font-bold transition hover:text-[#087b62]"
            >
              Escrow Security
            </button>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {authLoading ? (
              <div className="h-10 w-24 animate-pulse rounded-lg bg-[#102f46]/10" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() =>
                    setProfileMenu(
                      (current) =>
                        !current
                    )
                  }
                  className="flex items-center gap-2 rounded-lg border border-[#102f46]/10 bg-white px-3 py-2 text-xs font-bold shadow-sm"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#102f46] text-[10px] font-black text-white">
                    {getUserInitials()}
                  </div>

                  <div className="text-left">
                    <p className="max-w-[120px] truncate">
                      {getUserName()}
                    </p>

                    <p className="text-[8px] font-semibold text-[#087b62]">
                      {getRoleLabel()}
                    </p>
                  </div>
                </button>

                {profileMenu && (
                  <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-[#102f46]/10 bg-white shadow-xl">
                    <div className="border-b border-[#102f46]/10 px-4 py-3">
                      <p className="text-xs font-black">
                        {getUserName()}
                      </p>

                      <p className="mt-1 truncate text-[9px] text-[#71808a]">
                        {user.email}
                      </p>

                      <span className="mt-2 inline-block rounded bg-[#e4f5ee] px-2 py-1 text-[8px] font-black uppercase text-[#087b62]">
                        {getRoleLabel()}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setProfileMenu(false);
                        router.push("/profile/edit");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-xs font-bold hover:bg-[#f8f7f2]"
                    >
                      <User size={15} />
                      My Profile
                    </button>

                    <button
                      onClick={goToAccount}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-xs font-bold hover:bg-[#f8f7f2]"
                    >
                      <LayoutDashboard
                        size={15}
                      />
                      My Dashboard
                    </button>

                    <button
                      onClick={goToMessages}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-xs font-bold hover:bg-[#f8f7f2]"
                    >
                      <MessageSquare size={15} />
                      Messages
                    </button>

                    {userRole ===
                      "admin" && (
                      <button
                        onClick={
                          goToAdminDashboard
                        }
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-xs font-bold text-[#f05a00] hover:bg-[#fff0e8]"
                      >
                        <ShieldCheck
                          size={15}
                        />
                        Admin Dashboard
                      </button>
                    )}

                    <button
                      onClick={
                        handleSignOut
                      }
                      className="flex w-full items-center gap-3 border-t border-[#102f46]/10 px-4 py-3 text-left text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      <LogOut
                        size={15}
                      />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={goToLogin}
                  className="rounded-lg px-4 py-2 text-xs font-bold transition hover:text-[#087b62]"
                >
                  Sign In
                </button>

                <button
                  onClick={goToSignup}
                  className="rounded-lg bg-[#102f46] px-5 py-3 text-xs font-black text-white transition hover:bg-[#174763]"
                >
                  Get Started
                </button>
              </>
            )}

            <button
              onClick={() =>
                scrollToSection("homes")
              }
              className="flex items-center gap-2 rounded-lg bg-[#f05a00] px-5 py-3 text-xs font-black text-white transition hover:bg-[#d94e00]"
            >
              Find Verified Homes
              <ArrowRight size={14} />
            </button>
          </div>

          <button
            onClick={() =>
              setMobileMenu(
                (current) => !current
              )
            }
            className="rounded-lg p-2 lg:hidden"
            aria-label="Open menu"
          >
            {mobileMenu ? (
              <X size={23} />
            ) : (
              <Menu size={23} />
            )}
          </button>
        </div>

        {/* MOBILE MENU */}
        {mobileMenu && (
          <div className="border-t border-[#102f46]/10 bg-[#f8f7f2] px-5 py-5 lg:hidden">
            <div className="space-y-1">
              <button
                onClick={() =>
                  scrollToSection("homes")
                }
                className="block w-full rounded-lg px-3 py-3 text-left text-sm font-bold hover:bg-white"
              >
                Find Homes
              </button>

              <button
                onClick={() =>
                  scrollToSection(
                    "community"
                  )
                }
                className="block w-full rounded-lg px-3 py-3 text-left text-sm font-bold hover:bg-white"
              >
                Community Pulse
              </button>

              {(!user || (!roleLoading && userRole === "tenant")) && (
                <button
                  onClick={() => scrollToSection("spin")}
                  className="block w-full rounded-lg px-3 py-3 text-left text-sm font-bold hover:bg-white"
                >
                  Spin & Earn
                </button>
              )}

              <button
                onClick={() =>
                  scrollToSection(
                    "security"
                  )
                }
                className="block w-full rounded-lg px-3 py-3 text-left text-sm font-bold hover:bg-white"
              >
                Escrow Security
              </button>
            </div>

            <div className="mt-4 border-t border-[#102f46]/10 pt-4">
              {user ? (
                <div className="space-y-2">
                  <div className="rounded-xl bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#102f46] text-xs font-black text-white">
                        {getUserInitials()}
                      </div>

                      <div>
                        <p className="text-sm font-black">
                          {getUserName()}
                        </p>

                        <p className="text-[9px] text-[#087b62]">
                          {getRoleLabel()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setProfileMenu(false);
                      setMobileMenu(false);
                      router.push("/profile/edit");
                    }}
                    className="flex w-full items-center gap-3 rounded-lg bg-white px-4 py-3 text-left text-xs font-bold"
                  >
                    <User size={16} />
                    My Profile
                  </button>

                  <button
                    onClick={goToAccount}
                    className="flex w-full items-center gap-3 rounded-lg bg-white px-4 py-3 text-left text-xs font-bold"
                  >
                    <LayoutDashboard
                      size={16}
                    />
                    My Dashboard
                  </button>

                  <button
                    onClick={goToMessages}
                    className="flex w-full items-center gap-3 rounded-lg bg-white px-4 py-3 text-left text-xs font-bold"
                  >
                    <MessageSquare size={16} />
                    Messages
                  </button>

                  {userRole ===
                    "admin" && (
                    <button
                      onClick={
                        goToAdminDashboard
                      }
                      className="flex w-full items-center gap-3 rounded-lg bg-white px-4 py-3 text-left text-xs font-bold text-[#f05a00]"
                    >
                      <ShieldCheck
                        size={16}
                      />
                      Admin Dashboard
                    </button>
                  )}

                  <button
                    onClick={
                      handleSignOut
                    }
                    className="flex w-full items-center gap-3 rounded-lg bg-red-50 px-4 py-3 text-left text-xs font-bold text-red-600"
                  >
                    <LogOut
                      size={16}
                    />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="grid gap-2">
                  <button
                    onClick={goToLogin}
                    className="rounded-lg border border-[#102f46]/15 bg-white px-4 py-3 text-sm font-bold"
                  >
                    Sign In
                  </button>

                  <button
                    onClick={goToSignup}
                    className="rounded-lg bg-[#102f46] px-4 py-3 text-sm font-black text-white"
                  >
                    Create Account
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section
        id="top"
        className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 sm:py-24"
      >
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md bg-[#fff0e8] px-3 py-2 text-[9px] font-black uppercase tracking-wide text-[#f05a00]">
              <ShieldCheck size={13} />
              No Zero-Scam Guarantee
            </div>

            <h1 className="mt-6 max-w-[720px] text-5xl font-black leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
              Rent with
              <span className="block text-[#087b62]">
                Certainty
              </span>
              in Lagos.
            </h1>

            <p className="mt-6 max-w-[650px] text-sm leading-7 text-[#63717a] sm:text-base">
              Find verified homes, understand flood
              and power conditions, connect with
              property professionals and make smarter
              housing decisions.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() =>
                  scrollToSection(
                    "homes"
                  )
                }
                className="flex items-center justify-center gap-2 rounded-lg bg-[#f05a00] px-6 py-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#d94e00]"
              >
                Find Verified Homes
                <ArrowRight size={17} />
              </button>

              <button
                onClick={() =>
                  scrollToSection(
                    "security"
                  )
                }
                className="flex items-center justify-center gap-2 rounded-lg border border-[#102f46]/15 bg-white px-6 py-4 text-sm font-bold transition hover:bg-[#eef5f1]"
              >
                Escrow Security
                <ShieldCheck
                  size={17}
                />
              </button>
            </div>

            <div className="mt-10 grid max-w-[620px] grid-cols-3 gap-4 border-t border-[#102f46]/10 pt-7">
              <div>
                <p className="text-2xl font-black">
                  8+
                </p>

                <p className="mt-1 text-[9px] text-[#71808a]">
                  Vetted properties
                </p>
              </div>

              <div>
                <p className="text-2xl font-black">
                  95%
                </p>

                <p className="mt-1 text-[9px] text-[#71808a]">
                  Flood model accuracy
                </p>
              </div>

              <div>
                <p className="text-2xl font-black">
                  24/7
                </p>

                <p className="mt-1 text-[9px] text-[#71808a]">
                  Platform access
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl bg-[#102f46] shadow-2xl">
              <div className="relative h-[430px] overflow-hidden">
                <img
                  src={
                    properties[0]?.image ||
                    "/spatdel.png"
                  }
                  alt="Lagos property"
                  className="h-full w-full object-cover opacity-90"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#071b18] via-transparent to-transparent" />

                <div className="absolute left-5 top-5 rounded-lg bg-white/95 p-4 shadow-xl backdrop-blur">
                  <div className="flex items-center justify-between gap-8">
                    <div>
                      <p className="text-[8px] font-bold text-[#71808a]">
                        VERIFIED HOME
                      </p>

                      <p className="mt-1 text-xs font-black">
                        Lekki, Lagos
                      </p>
                    </div>

                    <span className="rounded bg-[#e4f5ee] px-2 py-1 text-[7px] font-black text-[#087b62]">
                      SECURED
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-black">
                    {properties[0]
                      ? getDisplayedPrice(properties[0].price)
                      : "₦1,200,000"}
                    {properties[0] && getOriginalPrice(properties[0].price) && (
                      <span className="ml-2 text-xs font-semibold text-[#9aa4aa] line-through decoration-2">
                        {getOriginalPrice(properties[0].price)}
                      </span>
                    )}{" "} / yr
                  </p>

                  <div className="mt-3 flex items-center gap-2 text-[9px] text-[#63717a]">
                    <span className="text-[#f05a00]">
                      ●
                    </span>
                    Power Grid: 20h/day
                  </div>
                </div>

                <div className="absolute bottom-5 left-5 flex flex-wrap gap-5 text-[9px] text-white/80">
                  <span>
                    <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#19e58f]" />
                    Safe Zone
                  </span>

                  <span>
                    <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#f05a00]" />
                    Power Grid
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="border-y border-[#102f46]/10 bg-white">
        <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-6 px-5 py-7 sm:grid-cols-4 sm:px-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-[#087b62]" />

            <div>
              <p className="text-xs font-bold">
                Verified Homes
              </p>

              <p className="text-[9px] text-[#71808a]">
                Inspected listings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Zap className="text-[#f05a00]" />

            <div>
              <p className="text-xs font-bold">
                Power Data
              </p>

              <p className="text-[9px] text-[#71808a]">
                Real community reports
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <MapPin className="text-[#087b62]" />

            <div>
              <p className="text-xs font-bold">
                Flood Intelligence
              </p>

              <p className="text-[9px] text-[#71808a]">
                Location-based risk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ShieldCheck className="text-[#f05a00]" />

            <div>
              <p className="text-xs font-bold">
                Payment Protection
              </p>

              <p className="text-[9px] text-[#71808a]">
                Escrow security
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SPIN & EARN — visible to guests and tenants only */}
      {(!authLoading && (!user || (!roleLoading && userRole === "tenant"))) && (
      <section
        id="spin"
        className="mx-auto max-w-[1280px] px-5 py-24 sm:px-8"
      >
        <div className="rounded-2xl border border-[#19b87a]/50 bg-white p-6 shadow-sm sm:p-10">
          <div className="mb-10 max-w-[750px]">
            <span className="rounded-md bg-[#fff0e8] px-3 py-1 text-[9px] font-bold uppercase tracking-wide text-[#f05a00]">
              Lagos Verified Rewards
            </span>

            <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
              One-Time Rent Discount
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#71808a] sm:text-base">
              Spin once in your lifetime to win a direct naira discount. Your reward is saved to your tenant account and reduces every available house's displayed price.
            </p>
          </div>

          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-col items-center">
              <div className="relative h-72 w-72 sm:h-80 sm:w-80">
                <div className="absolute left-1/2 top-[-16px] z-40 -translate-x-1/2">
                  <div className="relative">
                    <div className="h-0 w-0 border-l-[15px] border-r-[15px] border-t-[34px] border-l-transparent border-r-transparent border-t-[#102f46] drop-shadow-lg" />

                    <div className="absolute left-1/2 top-[2px] h-2 w-2 -translate-x-1/2 rounded-full bg-[#f05a00]" />
                  </div>
                </div>

                <div
                  className="absolute inset-0 rounded-full border-[7px] border-[#102f46] p-2 shadow-[0_12px_40px_rgba(16,47,70,0.25)]"
                  style={{
                    transform: `rotate(${wheelRotation}deg)`,
                    transition: spinning
                      ? "transform 1.8s cubic-bezier(0.12, 0.8, 0.18, 1)"
                      : "none",
                    willChange: "transform",
                  }}
                >
                  <div
                    className="absolute inset-2 rounded-full"
                    style={{
                      background: `
                        repeating-conic-gradient(
                          from -30deg,
                          rgba(255,255,255,0.9) 0deg 1.2deg,
                          transparent 1.2deg 60deg
                        ),
                        conic-gradient(
                          from -30deg,
                          #087b62 0deg 60deg,
                          #f05a00 60deg 120deg,
                          #102f46 120deg 180deg,
                          #19b87a 180deg 240deg,
                          #f05a00 240deg 300deg,
                          #155e75 300deg 360deg
                        )
                      `,
                    }}
                  />

                  <div className="absolute left-1/2 top-[12%] -translate-x-1/2 text-center text-white drop-shadow-md">
                    <div className="text-[16px] font-black leading-none">
                      ₦5K
                    </div>

                    <div className="mt-1 text-[7px] font-bold tracking-wider">
                      NAIRA OFF
                    </div>
                  </div>

                  <div className="absolute right-[11%] top-[29%] w-[62px] -rotate-[30deg] text-center text-white drop-shadow-md">
                    <div className="text-[15px] font-black leading-none">
                      ₦10K
                    </div>

                    <div className="mt-1 text-[7px] font-bold tracking-wider">
                      NAIRA OFF
                    </div>
                  </div>

                  <div className="absolute right-[10%] bottom-[26%] w-[65px] rotate-[30deg] text-center text-white drop-shadow-md">
                    <div className="text-[14px] font-black leading-none">
                      ₦15K
                    </div>

                    <div className="mt-1 text-[7px] font-bold tracking-wider">
                      NAIRA OFF
                    </div>
                  </div>

                  <div className="absolute bottom-[11%] left-1/2 w-[80px] -translate-x-1/2 text-center text-white drop-shadow-md">
                    <div className="text-[12px] font-black leading-none">
                      ₦20K
                    </div>

                    <div className="mt-1 text-[7px] font-bold tracking-wider">
                      NAIRA OFF
                    </div>
                  </div>

                  <div className="absolute bottom-[26%] left-[9%] w-[65px] -rotate-[30deg] text-center text-white drop-shadow-md">
                    <div className="text-[15px] font-black leading-none">
                      ₦25K
                    </div>

                    <div className="mt-1 text-[7px] font-bold tracking-wider">
                      NAIRA OFF
                    </div>
                  </div>

                  <div className="absolute left-[10%] top-[29%] w-[62px] rotate-[30deg] text-center text-white drop-shadow-md">
                    <div className="text-[15px] font-black leading-none">
                      ₦30K
                    </div>

                    <div className="mt-1 text-[7px] font-bold tracking-wider">
                      NAIRA OFF
                    </div>
                  </div>

                  <div className="absolute left-1/2 top-1/2 h-[106px] w-[106px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-white/90 bg-[#071b18] shadow-[0_5px_20px_rgba(0,0,0,0.35)]" />
                </div>

                <div className="absolute inset-0 z-30 flex items-center justify-center">
                  <button
                    onClick={spinWheel}
                    disabled={
                      spinning ||
                      rewardLoading ||
                      (Boolean(user) && userRole === "tenant" && (rewardAmount !== null || Boolean(rewardSpunAt)))
                    }
                    className="flex h-[82px] w-[82px] items-center justify-center rounded-full border-[4px] border-[#19e58f] bg-[#071b18] text-center text-[10px] font-black text-[#19e58f] shadow-[0_4px_20px_rgba(0,0,0,0.45)] transition duration-200 hover:scale-105 hover:border-white disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-80"
                  >
                    {spinning
                      ? "SPINNING..."
                      : !user
                        ? "SIGN IN"
                        : rewardAmount !== null || rewardSpunAt
                          ? "USED"
                          : rewardLoading || !rewardStatusLoaded
                            ? "CHECKING"
                            : "SPIN NOW"}
                  </button>
                </div>
              </div>

              <p className="mt-7 text-center text-[10px] text-[#71808a]">
                One spin per tenant account for life. No daily reset.
              </p>
              {rewardError && (
                <p role="alert" className="mt-3 max-w-xs text-center text-xs font-semibold text-red-600">
                  {rewardError}
                </p>
              )}
              {rewardNotice && (
                <p role="status" className="mt-3 max-w-xs text-center text-xs font-semibold text-[#087b62]">
                  {rewardNotice}
                </p>
              )}
            </div>

            <div>
              <div className="rounded-xl bg-[#f8f7f2] p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-[#71808a]">
                  Your lifetime rent discount
                </p>
                <p className="mt-3 text-3xl font-black text-[#f05a00]">
                  {rewardAmount !== null
                    ? "₦" + rewardAmount.toLocaleString("en-NG")
                    : "Not claimed yet"}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#71808a]">
                  {rewardAmount !== null
                    ? "This discount is applied to every available house's displayed price while you're signed in as a tenant."
                    : "Spin once to unlock a discount that stays on your account for life."}
                </p>
                {rewardSpunAt && (
                  <p className="mt-3 text-[10px] font-semibold text-[#087b62]">
                    Claimed on {new Date(rewardSpunAt).toLocaleDateString("en-NG")}
                  </p>
                )}
                {rewardLoading && (
                  <p className="mt-3 text-[10px] text-[#71808a]">Loading your reward...</p>
                )}
              </div>

              <div className="mt-8 rounded-xl border border-[#102f46]/10 bg-white p-5">
                <h3 className="text-sm font-black">How it works</h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-5 text-[#71808a]">
                  <li>Spin once using your tenant account.</li>
                  <li>Your naira discount is saved permanently.</li>
                  <li>The discount appears on every available house's displayed price.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      )}
      
      {/* PROPERTIES */}
      <section
        id="homes"
        className="mx-auto max-w-[1280px] px-5 pb-24 sm:px-8"
      >
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <span className="rounded-md bg-[#fff0e8] px-3 py-1 text-[9px] font-bold uppercase tracking-wide text-[#f05a00]">
              Verified Properties
            </span>

            <h2 className="mt-5 text-3xl font-black sm:text-4xl">
              Verified Homes in Lagos
            </h2>

            <p className="mt-3 text-sm text-[#71808a]">
              Real homes. Real information. Verified before
              you rent.
            </p>
          </div>

          <button
            onClick={() =>
              scrollToSection(
                "homes"
              )
            }
            className="flex items-center gap-2 text-sm font-bold text-[#087b62]"
          >
            View all homes
            <ArrowRight size={16} />
          </button>
        </div>

        {saveError && (
          <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            <span>
              {saveError}
            </span>

            <button
              onClick={() =>
                setSaveError("")
              }
              className="font-black"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {propertiesLoading ? (
            <div className="col-span-full rounded-xl border border-[#102f46]/10 bg-white p-10 text-center">
              <p className="text-sm font-bold">
                Loading verified homes...
              </p>

              <p className="mt-2 text-xs text-[#71808a]">
                Getting the latest properties from SPATDEL.
              </p>
            </div>
          ) : propertiesError ? (
            <div className="col-span-full rounded-xl border border-red-200 bg-white p-10 text-center">
              <p className="text-sm font-bold text-red-600">
                {propertiesError}
              </p>
            </div>
          ) : properties.length ===
            0 ? (
            <div className="col-span-full rounded-xl border border-[#102f46]/10 bg-white p-10 text-center">
              <p className="text-sm font-bold">
                No properties available yet.
              </p>

              <p className="mt-2 text-xs text-[#71808a]">
                New verified homes will appear here.
              </p>
            </div>
          ) : (
            properties.map(
              (property) => {
                const saved =
                  isPropertySaved(
                    property.id
                  );

                const saving =
                  savingPropertyId ===
                  property.id;

                return (
                  <article
                    key={
                      property.id
                    }
                    className="group overflow-hidden rounded-xl border border-[#102f46]/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={
                          property.image
                        }
                        alt={
                          property.title
                        }
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />

                      <span
                        className={`absolute left-3 top-3 rounded-md px-2 py-1 text-[8px] font-black text-white ${
                          property.verified
                            ? "bg-[#087b62]"
                            : "bg-[#71808a]"
                        }`}
                      >
                        {property.verified
                          ? "VERIFIED"
                          : "PENDING"}
                      </span>

                      <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-[8px] font-bold text-white backdrop-blur">
                        {property.listing_purpose === "sale" ? "FOR SALE" : property.listing_purpose === "rent" ? "FOR RENT" : property.type || `${property.beds} BED`}
                      </span>

                      <button
                        onClick={() =>
                          toggleSaveProperty(
                            property
                          )
                        }
                        disabled={
                          saving
                        }
                        aria-label={
                          saved
                            ? "Remove saved property"
                            : "Save property"
                        }
                        className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition ${
                          saved
                            ? "bg-[#f05a00] text-white"
                            : "bg-white/90 text-[#102f46] hover:bg-white"
                        } ${
                          saving
                            ? "cursor-not-allowed opacity-60"
                            : ""
                        }`}
                      >
                        <Heart
                          size={
                            17
                          }
                          fill={
                            saved
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>
                    </div>

                    <div className="p-4">
                      <h3 className="text-sm font-black leading-5">
                        {
                          property.title
                        }
                      </h3>

                      <p className="mt-1 flex items-center gap-1 text-[10px] text-[#71808a]">
                        <MapPin
                          size={
                            11
                          }
                        />
                        {property.location ||
                          "Lagos"}
                      </p>

                      <p className="mt-4 text-lg font-black text-[#087b62]">
                        {
                          getDisplayedPrice(property.price)
                        }
                        {getOriginalPrice(property.price) && (
                          <span className="ml-2 text-xs font-semibold text-[#9aa4aa] line-through decoration-2">
                            {getOriginalPrice(property.price)}
                          </span>
                        )}

                        <span className="text-[9px] font-medium text-[#71808a]">
                          {" "}
                          / year
                        </span>
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-[9px]">
                        <div className="rounded-md bg-[#e4f5ee] px-2 py-2 text-[#087b62]">
                          <span className="block text-[#71808a]">
                            Flood Risk
                          </span>

                          <b>
                            {property.flood_risk ||
                              property.flood}
                          </b>
                        </div>

                        <div className="rounded-md bg-[#fff0e8] px-2 py-2 text-[#f05a00]">
                          <span className="block text-[#71808a]">
                            Power
                          </span>

                          <b>
                            {property.power_hours ||
                              property.power}
                          </b>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          setSelectedProperty(
                            property
                          )
                        }
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#102f46] py-3 text-xs font-bold text-white transition hover:bg-[#174763]"
                      >
                        View Property
                        <ArrowRight
                          size={
                            14
                          }
                        />
                      </button>
                    </div>
                  </article>
                );
              }
            )
          )}
        </div>
      </section>

      {/* COMMUNITY */}
      <section
        id="community"
        className="bg-[#eef5f1]"
      >
        <div className="mx-auto max-w-[1280px] px-5 py-24 sm:px-8">
          <div className="max-w-[680px]">
            <span className="rounded-md bg-white px-3 py-1 text-[9px] font-bold uppercase tracking-wide text-[#087b62]">
              Community Pulse
            </span>

            <h2 className="mt-5 text-3xl font-black sm:text-4xl">
              Know what&apos;s happening around your home.
            </h2>

            <p className="mt-4 text-sm leading-7 text-[#63717a] sm:text-base">
              SPATDEL brings local community intelligence
              together so you can understand the area before
              making a housing decision.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <Zap
                className="text-[#f05a00]"
                size={28}
              />

              <h3 className="mt-5 font-black">
                Electricity
              </h3>

              <p className="mt-2 text-xs leading-6 text-[#71808a]">
                See community reports about power reliability
                and outages.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <MapPin
                className="text-[#087b62]"
                size={28}
              />

              <h3 className="mt-5 font-black">
                Flooding
              </h3>

              <p className="mt-2 text-xs leading-6 text-[#71808a]">
                Understand flood conditions around properties
                and roads.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <ShieldCheck
                className="text-[#f05a00]"
                size={28}
              />

              <h3 className="mt-5 font-black">
                Security
              </h3>

              <p className="mt-2 text-xs leading-6 text-[#71808a]">
                Access community information and verified
                reports.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <Star
                className="text-[#087b62]"
                size={28}
              />

              <h3 className="mt-5 font-black">
                Local Services
              </h3>

              <p className="mt-2 text-xs leading-6 text-[#71808a]">
                Discover useful services and facilities around
                your community.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-2xl bg-[#102f46] p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-wide text-[#19e58f]">
                <MessageSquare size={13} /> Join the conversation
              </span>
              <h3 className="mt-4 text-xl font-black sm:text-2xl">
                Your community has a lot to say.
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
                Publish posts, reply to housing questions, or chat live with tenants, agents and landlords.
              </p>
            </div>
            <button
              onClick={() => router.push("/community")}
              className="mt-5 inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#19e58f] px-5 py-3 text-sm font-black text-[#071b18] transition hover:-translate-y-0.5 sm:mt-0"
            >
              Open Community Pulse <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section
        id="security"
        className="bg-[#102f46] text-white"
      >
        <div className="mx-auto max-w-[1280px] px-5 py-24 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <span className="rounded-md bg-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-wide text-[#19e58f]">
                Escrow Security
              </span>

              <h2 className="mt-6 text-3xl font-black sm:text-4xl">
                Your rent should never depend on trust alone.
              </h2>

              <p className="mt-5 text-sm leading-7 text-white/60 sm:text-base">
                Our payment architecture is designed to make
                housing transactions safer and more transparent.
              </p>

              <button
                onClick={goToLogin}
                className="mt-8 flex items-center gap-2 rounded-lg bg-[#19e58f] px-6 py-4 text-sm font-black text-[#071b18] transition hover:-translate-y-0.5"
              >
                Learn About Security
                <ArrowRight
                  size={16}
                />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                <ShieldCheck
                  className="text-[#19e58f]"
                  size={30}
                />

                <h3 className="mt-5 font-black">
                  Verified Identity
                </h3>

                <p className="mt-2 text-xs leading-6 text-white/50">
                  Account and property verification help reduce
                  fraudulent listings.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                <Check
                  className="text-[#19e58f]"
                  size={30}
                />

                <h3 className="mt-5 font-black">
                  Transparent Payments
                </h3>

                <p className="mt-2 text-xs leading-6 text-white/50">
                  Keep transaction records organized and easy
                  to understand.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                <Zap
                  className="text-[#19e58f]"
                  size={30}
                />

                <h3 className="mt-5 font-black">
                  Community Reports
                </h3>

                <p className="mt-2 text-xs leading-6 text-white/50">
                  Housing decisions can include real local
                  information.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                <Star
                  className="text-[#19e58f]"
                  size={30}
                />

                <h3 className="mt-5 font-black">
                  Trusted Platform
                </h3>

                <p className="mt-2 text-xs leading-6 text-white/50">
                  Built to connect tenants, landlords, agents
                  and communities.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1280px] px-5 py-24 sm:px-8">
        <div className="overflow-hidden rounded-2xl bg-[#f05a00] px-7 py-14 text-center text-white sm:px-12">
          <h2 className="text-3xl font-black sm:text-5xl">
            Find a home you can actually trust.
          </h2>

          <p className="mx-auto mt-5 max-w-[600px] text-sm leading-6 text-white/80 sm:text-base">
            Search verified properties, understand your
            community and rent with greater confidence.
          </p>

          <button
            onClick={() =>
              scrollToSection(
                "homes"
              )
            }
            className="mt-8 rounded-lg bg-white px-7 py-4 text-sm font-black text-[#102f46] shadow-lg transition hover:-translate-y-0.5"
          >
            Find Verified Homes
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#020709] text-white">
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="flex items-center">
                <img
                  src="/spatdel.png"
                  alt="SPATDEL"
                  className="h-14 w-auto object-contain"
                />
              </div>

              <p className="mt-5 max-w-[400px] text-sm leading-7 text-white/50">
                A smarter property and community platform built
                to make housing decisions in Lagos safer, clearer
                and more informed.
              </p>

              <div className="mt-6 flex flex-wrap gap-5 text-sm font-medium">
                <a
                  href="#"
                  className="text-white/50 transition hover:text-[#19e58f]"
                >
                  Facebook
                </a>

                <a
                  href="#"
                  className="text-white/50 transition hover:text-[#19e58f]"
                >
                  X
                </a>

                <a
                  href="#"
                  className="text-white/50 transition hover:text-[#19e58f]"
                >
                  Instagram
                </a>

                <a
                  href="#"
                  className="text-white/50 transition hover:text-[#19e58f]"
                >
                  LinkedIn
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-black text-[#19e58f]">
                PLATFORM
              </h4>

              <div className="mt-5 space-y-3 text-sm text-white/50">
                <a
                  href="#homes"
                  className="block hover:text-white"
                >
                  Find Homes
                </a>

                <a
                  href="#spin"
                  className="block hover:text-white"
                >
                  Spin & Earn
                </a>

                <a
                  href="#security"
                  className="block hover:text-white"
                >
                  Escrow Security
                </a>

                <a
                  href="#community"
                  className="block hover:text-white"
                >
                  Community Pulse
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-black text-[#19e58f]">
                COMPANY
              </h4>

              <div className="mt-5 space-y-3 text-sm text-white/50">
                <a
                  href="#"
                  className="block hover:text-white"
                >
                  About Us
                </a>

                <a
                  href="#"
                  className="block hover:text-white"
                >
                  Contact
                </a>

                <a
                  href="#"
                  className="block hover:text-white"
                >
                  Privacy Policy
                </a>

                <a
                  href="#"
                  className="block hover:text-white"
                >
                  Terms of Service
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-7 text-xs text-white/30">
            © 2026 SPATDEL. All rights reserved.
          </div>
        </div>
      </footer>

      {/* PROPERTY DETAILS MODAL */}
      {selectedProperty && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-5 py-8 backdrop-blur-sm"
          onClick={closePropertyModal}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              onClick={closePropertyModal}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
              aria-label="Close property details"
            >
              <X size={20} />
            </button>

            {/* PROPERTY IMAGE */}
            <div className="relative h-64 overflow-hidden sm:h-80">
              <img
                src={
                  selectedProperty.image
                }
                alt={
                  selectedProperty.title
                }
                className="h-full w-full object-cover"
              />

              <div
                className={`absolute bottom-4 left-4 rounded-md px-3 py-2 text-[9px] font-black text-white ${
                  selectedProperty.verified
                    ? "bg-[#087b62]"
                    : "bg-[#71808a]"
                }`}
              >
                {selectedProperty.verified
                  ? "VERIFIED PROPERTY"
                  : "PROPERTY LISTING"}
              </div>

              <button
                onClick={() =>
                  toggleSaveProperty(
                    selectedProperty
                  )
                }
                disabled={
                  savingPropertyId ===
                  selectedProperty.id
                }
                className={`absolute bottom-4 right-4 flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold shadow-lg transition ${
                  isPropertySaved(
                    selectedProperty.id
                  )
                    ? "bg-[#f05a00] text-white"
                    : "bg-white text-[#102f46]"
                }`}
              >
                <Heart
                  size={15}
                  fill={
                    isPropertySaved(
                      selectedProperty.id
                    )
                      ? "currentColor"
                      : "none"
                  }
                />

                {isPropertySaved(
                  selectedProperty.id
                )
                  ? "Saved"
                  : "Save Property"}
              </button>
            </div>

            <div className="p-6 sm:p-8">
              {/* TITLE + PRICE */}
              <div className="flex flex-col justify-between gap-4 sm:flex-row">
                <div>
                  <h2 className="text-2xl font-black text-[#102f46] sm:text-3xl">
                    {
                      selectedProperty.title
                    }
                  </h2>

                  <p className="mt-2 flex items-center gap-2 text-sm text-[#71808a]">
                    <MapPin size={15} />
                    {selectedProperty.location ||
                      "Lagos"}
                  </p>
                </div>

                <div className="sm:text-right">
                  <p className="text-2xl font-black text-[#087b62]">
                    {
                      getDisplayedPrice(selectedProperty.price)
                    }
                    {getOriginalPrice(selectedProperty.price) && (
                      <span className="ml-2 text-sm font-semibold text-[#9aa4aa] line-through decoration-2">
                        {getOriginalPrice(selectedProperty.price)}
                      </span>
                    )}
                  </p>

                  <p className="text-xs text-[#71808a]">
                    per year
                  </p>
                </div>
              </div>

              {/* PROPERTY STATS */}
              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-[#f8f7f2] p-4">
                  <p className="text-[10px] text-[#71808a]">
                    Type
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {selectedProperty.type ||
                      `${selectedProperty.beds} BED`}
                  </p>
                </div>

                <div className="rounded-xl bg-[#f8f7f2] p-4">
                  <p className="text-[10px] text-[#71808a]">
                    Beds
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {
                      selectedProperty.beds
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-[#f8f7f2] p-4">
                  <p className="text-[10px] text-[#71808a]">
                    Baths
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {
                      selectedProperty.baths
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-[#f8f7f2] p-4">
                  <p className="text-[10px] text-[#71808a]">
                    Size
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {
                      selectedProperty.sqm
                    }{" "}
                    sqm
                  </p>
                </div>
              </div>

              {/* PROPERTY INTELLIGENCE */}
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[#e4f5ee] p-4">
                  <p className="text-[10px] text-[#71808a]">
                    Flood Risk
                  </p>

                  <p className="mt-1 text-sm font-black text-[#087b62]">
                    {selectedProperty.flood_risk ||
                      selectedProperty.flood}
                  </p>
                </div>

                <div className="rounded-xl bg-[#fff0e8] p-4">
                  <p className="text-[10px] text-[#71808a]">
                    Power
                  </p>

                  <p className="mt-1 text-sm font-black text-[#f05a00]">
                    {selectedProperty.power_hours ||
                      selectedProperty.power}
                  </p>
                </div>

                <div className="rounded-xl bg-[#eef5f1] p-4">
                  <p className="text-[10px] text-[#71808a]">
                    Status
                  </p>

                  <p className="mt-1 text-sm font-black text-[#087b62]">
                    {selectedProperty.verified
                      ? "Verified"
                      : "Pending"}
                  </p>
                </div>
              </div>

              {/* DESCRIPTION */}
              {selectedProperty.description && (
                <div className="mt-7 rounded-xl border border-[#102f46]/10 bg-white p-5">
                  <h3 className="text-sm font-black">
                    About this property
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-[#71808a]">
                    {
                      selectedProperty.description
                    }
                  </p>
                </div>
              )}

              {/* VERIFICATION */}
              <div className="mt-7 rounded-xl border border-[#102f46]/10 bg-[#f8f7f2] p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    className="mt-0.5 shrink-0 text-[#087b62]"
                    size={22}
                  />

                  <div>
                    <h3 className="text-sm font-black">
                      SPATDEL Verification
                    </h3>

                    <p className="mt-2 text-xs leading-6 text-[#71808a]">
                      {selectedProperty.verified
                        ? "This property has been marked as verified in the SPATDEL property database."
                        : "This property is currently listed on SPATDEL but has not yet been marked as fully verified."}
                    </p>
                  </div>
                </div>
              </div>

              {/* CHAT */}
              {chatMode && (
                <div className="mt-7 overflow-hidden rounded-xl border border-[#102f46]/10 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-[#102f46]/10 bg-[#102f46] px-5 py-4 text-white">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#19e58f] text-[#071b18]">
                        <MessageSquare
                          size={17}
                        />
                      </div>

                      <div>
                        <p className="text-sm font-black">
                          Property Chat
                        </p>

                        <p className="text-[9px] text-white/60">
                          {
                            selectedProperty.title
                          }
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setChatMode(
                          false
                        );
                        setMessageError(
                          ""
                        );
                      }}
                      className="rounded-lg p-2 transition hover:bg-white/10"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  <div className="h-[300px] overflow-y-auto bg-[#f8f7f2] p-4">
                    {messagesLoading ? (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-xs font-bold text-[#71808a]">
                          Loading messages...
                        </p>
                      </div>
                    ) : messages.length ===
                      0 ? (
                      <div className="flex h-full items-center justify-center text-center">
                        <div>
                          <MessageSquare
                            size={28}
                            className="mx-auto text-[#087b62]"
                          />

                          <p className="mt-3 text-xs font-bold">
                            No messages yet
                          </p>

                          <p className="mt-1 text-[10px] text-[#71808a]">
                            Start the conversation below.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map(
                          (message) => {
                            const mine =
                              message.sender_id ===
                              user?.id;

                            return (
                              <div
                                key={
                                  message.id
                                }
                                className={`flex ${
                                  mine
                                    ? "justify-end"
                                    : "justify-start"
                                }`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                                    mine
                                      ? "rounded-br-sm bg-[#102f46] text-white"
                                      : "rounded-bl-sm bg-white text-[#102f46] shadow-sm"
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap text-xs leading-5">
                                    {
                                      message.message
                                    }
                                  </p>

                                  <p
                                    className={`mt-1 text-[8px] ${
                                      mine
                                        ? "text-white/50"
                                        : "text-[#71808a]"
                                    }`}
                                  >
                                    {new Date(
                                      message.created_at
                                    ).toLocaleTimeString(
                                      [],
                                      {
                                        hour: "2-digit",
                                        minute:
                                          "2-digit",
                                      }
                                    )}
                                  </p>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>

                  {messageError && (
                    <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-[10px] text-red-700">
                      {
                        messageError
                      }
                    </div>
                  )}

                  <div className="border-t border-[#102f46]/10 bg-white p-3">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={
                          messageText
                        }
                        onChange={(
                          event
                        ) =>
                          setMessageText(
                            event.target
                              .value
                          )
                        }
                        onKeyDown={(
                          event
                        ) => {
                          if (
                            event.key ===
                              "Enter" &&
                            !event.shiftKey
                          ) {
                            event.preventDefault();

                            if (
                              !messageSending
                            ) {
                              sendChatMessage();
                            }
                          }
                        }}
                        rows={2}
                        maxLength={1000}
                        placeholder="Type your message..."
                        className="min-h-[48px] flex-1 resize-none rounded-xl border border-[#102f46]/15 bg-[#f8f7f2] px-4 py-3 text-xs outline-none transition focus:border-[#f05a00] focus:ring-2 focus:ring-[#f05a00]/10"
                      />

                      <button
                        onClick={
                          sendChatMessage
                        }
                        disabled={
                          messageSending ||
                          !messageText.trim()
                        }
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f05a00] text-white transition hover:bg-[#d94e00] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Send message"
                      >
                        <Send
                          size={17}
                        />
                      </button>
                    </div>

                    <p className="mt-2 text-[8px] text-[#71808a]">
                      Press Enter to send. Shift + Enter for a new line.
                    </p>
                  </div>
                </div>
              )}

              {/* SUCCESS */}
              {enquirySuccess &&
                !chatMode && (
                  <div className="mt-5 rounded-xl border border-[#087b62]/20 bg-[#e4f5ee] p-4">
                    <div className="flex items-start gap-3">
                      <Check
                        size={20}
                        className="mt-0.5 shrink-0 text-[#087b62]"
                      />

                      <div>
                        <p className="text-xs font-black text-[#087b62]">
                          Enquiry sent successfully
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#4c625a]">
                          Your conversation has been started.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {/* ENQUIRY FORM */}
              {enquiryMode &&
                !enquirySuccess && (
                  <div className="mt-7 rounded-xl border border-[#f05a00]/20 bg-[#fffaf7] p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0e8] text-[#f05a00]">
                        <MessageSquare
                          size={19}
                        />
                      </div>

                      <div>
                        <h3 className="text-sm font-black">
                          Start Property Conversation
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-[#71808a]">
                          Send a message to the agent or landlord handling this property.
                        </p>
                      </div>
                    </div>

                    {enquiryError && (
                      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                        {
                          enquiryError
                        }
                      </div>
                    )}

                    <div className="mt-5">
                      <label
                        htmlFor="enquiry-subject"
                        className="text-xs font-black text-[#102f46]"
                      >
                        Subject
                      </label>

                      <input
                        id="enquiry-subject"
                        type="text"
                        value={
                          enquirySubject
                        }
                        onChange={(
                          event
                        ) =>
                          setEnquirySubject(
                            event.target
                              .value
                          )
                        }
                        placeholder="e.g. Availability and inspection"
                        maxLength={120}
                        className="mt-2 w-full rounded-lg border border-[#102f46]/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#f05a00] focus:ring-2 focus:ring-[#f05a00]/10"
                      />
                    </div>

                    <div className="mt-4">
                      <label
                        htmlFor="enquiry-message"
                        className="text-xs font-black text-[#102f46]"
                      >
                        First Message
                      </label>

                      <textarea
                        id="enquiry-message"
                        value={
                          enquiryMessage
                        }
                        onChange={(
                          event
                        ) =>
                          setEnquiryMessage(
                            event.target
                              .value
                          )
                        }
                        placeholder="Ask your question about this property..."
                        rows={5}
                        maxLength={1000}
                        className="mt-2 w-full resize-none rounded-lg border border-[#102f46]/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#f05a00] focus:ring-2 focus:ring-[#f05a00]/10"
                      />

                      <div className="mt-1 text-right text-[9px] text-[#71808a]">
                        {
                          enquiryMessage.length
                        }
                        /1000
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={
                          submitPropertyEnquiry
                        }
                        disabled={
                          enquirySubmitting
                        }
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#f05a00] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#d94e00] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Send
                          size={16}
                        />

                        {enquirySubmitting
                          ? "Starting Chat..."
                          : "Start Conversation"}
                      </button>

                      <button
                        onClick={() => {
                          setEnquiryMode(
                            false
                          );
                          setEnquiryError(
                            ""
                          );
                        }}
                        disabled={
                          enquirySubmitting
                        }
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#102f46]/15 bg-white px-5 py-3.5 text-sm font-bold text-[#102f46] transition hover:bg-[#f8f7f2]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

              {/* ACTIONS */}
              {!enquiryMode &&
                !chatMode &&
                !enquirySuccess && (
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() =>
                        handlePropertyEnquiry(
                          selectedProperty
                        )
                      }
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#f05a00] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#d94e00]"
                    >
                      <MessageSquare
                        size={17}
                      />
                      Contact / Enquire
                    </button>

                    <button
                      onClick={
                        closePropertyModal
                      }
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#102f46] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#174763]"
                    >
                      Close
                      <X size={16} />
                    </button>
                  </div>
                )}

              {/* CHAT CLOSE */}
              {chatMode && (
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setChatMode(
                        false
                      );
                      setMessageError(
                        ""
                      );
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#102f46]/15 bg-white py-3 text-xs font-bold text-[#102f46] transition hover:bg-[#f8f7f2]"
                  >
                    <X size={15} />
                    Close Chat
                  </button>
                </div>
              )}

              {!user &&
                !enquiryMode &&
                !chatMode &&
                !enquirySuccess && (
                  <p className="mt-4 text-center text-[10px] text-[#71808a]">
                    You&apos;ll need an account before contacting
                    the property agent or landlord.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}