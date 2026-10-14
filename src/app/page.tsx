"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowRight,
  Check,
  Heart,
  Home as HomeIcon,
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
  Users,
  Wallet,
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

type UserRole = "user" | "tenant" | "agent" | "landlord" | "chairman" | "admin";

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
  const [rewardPointsBalance, setRewardPointsBalance] = useState(0);
  const [rewardSpunAt, setRewardSpunAt] = useState<string | null>(null);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardStatusLoaded, setRewardStatusLoaded] = useState(false);
  const [rewardError, setRewardError] = useState("");
  const [rewardNotice, setRewardNotice] = useState("");
  const [guestClaimPoints, setGuestClaimPoints] = useState<number | null>(null);

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
  const [chairmanApplicationStatus, setChairmanApplicationStatus] = useState<"pending" | "approved" | "rejected" | null>(null);

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
        setChairmanApplicationStatus(null);
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
        setChairmanApplicationStatus(null);
      } else {
        const profile = data as Profile | null;
        const role: UserRole =
          profile?.role === "tenant" ||
          profile?.role === "agent" ||
          profile?.role === "landlord" ||
          profile?.role === "chairman" ||
          profile?.role === "admin"
            ? profile.role
            : "tenant";
        setUserRole(role);

        if (role === "chairman") {
          setChairmanApplicationStatus("approved");
        } else {
          const { data: application } = await supabase
            .from("chairman_applications")
            .select("status")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!mounted) return;
          setChairmanApplicationStatus(
            application?.status === "pending" ||
            application?.status === "approved" ||
            application?.status === "rejected"
              ? application.status
              : null
          );
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

    async function loadSpinReward() {
      if (!user || !["user", "agent", "chairman"].includes(userRole || "")) {
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
        .select("reward_amount, spun_at, points_balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("Failed to load tenant reward:", error);
        setRewardError("We couldn't load your reward status. Please refresh and try again.");
      } else {
        setRewardAmount(data?.reward_amount ?? null);
        setRewardPointsBalance(Number(data?.points_balance ?? data?.reward_amount ?? 0));
        setRewardSpunAt(data?.spun_at ?? null);
      }

      setRewardLoading(false);
      setRewardStatusLoaded(true);
    }

    loadSpinReward();

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

  function goToWallet() {
    setProfileMenu(false);
    setMobileMenu(false);
    router.push("/wallet");
  }

  function goToPostProperty() {
    setProfileMenu(false);
    setMobileMenu(false);
    router.push("/agent");
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
      // Weighted guest preview: larger prizes are intentionally rarer.
      const guestPrizeSlots = [
        ...Array(30).fill(5000),
        ...Array(25).fill(10000),
        ...Array(20).fill(25000),
        ...Array(15).fill(50000),
        ...Array(7).fill(75000),
        ...Array(3).fill(100000),
      ];
      const guestReward = guestPrizeSlots[Math.floor(Math.random() * guestPrizeSlots.length)];
      const guestRewardIndex = [5000, 10000, 25000, 50000, 75000, 100000].indexOf(guestReward);
      setSpinning(true);
      setRewardError("");
      setRewardNotice("");
      // Align the selected segment's centre with the fixed top pointer.
      // Include the current rotation so repeated spins cannot drift to another prize.
      setWheelRotation((current) => {
        const currentMod = ((current % 360) + 360) % 360;
        const extraRotation =
          (360 - ((currentMod + guestRewardIndex * 60) % 360)) % 360;
        return current + 1440 + extraRotation;
      });
      window.setTimeout(() => {
        setGuestClaimPoints(guestReward);
        setSpinning(false);
      }, 1900);
      return;
    }

    if (!["user", "agent", "chairman"].includes(userRole || "")) {
      setRewardError("Spin & Earn is available to SPATDEL Users, Agents, and Chairmen only.");
      return;
    }

    if (!rewardStatusLoaded || rewardLoading) {
      setRewardError("Checking your lifetime spin status. Please wait.");
      return;
    }

    if (rewardSpunAt && Date.now() < new Date(rewardSpunAt).getTime() + 7 * 24 * 60 * 60 * 1000) {
      const nextSpin = new Date(new Date(rewardSpunAt).getTime() + 7 * 24 * 60 * 60 * 1000);
      setRewardNotice("Your weekly spin is on cooldown until " + nextSpin.toLocaleString("en-NG") + ".");
      return;
    }

    setSpinning(true);
    setRewardError("");
    setRewardNotice("");

    const { data, error } = await supabase.rpc("claim_tenant_spin_reward");

    if (error) {
      console.error("Failed to claim lifetime spin reward:", error);
      setRewardError(
        error.message?.includes("SPATDEL Users, Agents, and Chairmen")
          ? "Spin & Earn is available to SPATDEL Users, Agents, and Chairmen only."
          : "Your spin could not be saved. Please try again."
      );
      setSpinning(false);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    const reward = Number(result?.reward_amount);
    const spunAt = result?.spun_at ?? null;
    const pointsBalance = Number(result?.points_balance ?? rewardPointsBalance + reward);

    if (![5000, 10000, 25000, 50000, 75000, 100000].includes(reward) || !spunAt) {
      setRewardError("We couldn't confirm your reward. Refresh and check your reward status.");
      setSpinning(false);
      return;
    }

    if (result?.already_spun) {
      setRewardAmount(reward);
      setRewardPointsBalance(pointsBalance);
      setRewardSpunAt(spunAt);
      setRewardNotice("Your weekly reward is saved to your points balance.");
      setSpinning(false);
      return;
    }

    const rewards = [5000, 10000, 25000, 50000, 75000, 100000];
    const rewardIndex = rewards.indexOf(reward);
    // Align the confirmed reward segment with the fixed top pointer.
    // Account for the wheel's existing rotation to prevent mismatches on later spins.
    setWheelRotation((current) => {
      const currentMod = ((current % 360) + 360) % 360;
      const extraRotation =
        (360 - ((currentMod + rewardIndex * 60) % 360)) % 360;
      return current + 1440 + extraRotation;
    });

    window.setTimeout(() => {
      setRewardAmount(reward);
      setRewardPointsBalance(pointsBalance);
      setRewardSpunAt(spunAt);
      setRewardNotice(
        "Congratulations! You won " + reward.toLocaleString("en-NG") +
        " points (worth about ₦" + (reward / 100).toLocaleString("en-NG") + "). Redeem on eligible SPATDEL purchases only."
      );
      setSpinning(false);
    }, 1900);
  }

  function getDisplayedPrice(price: string) {
    return price;
  }

  function getOriginalPrice(_price: string) {
    return null;
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
      return "Approved Chairman";
    }

    if (chairmanApplicationStatus === "pending") {
      return "Chairman Application Pending";
    }

    if (chairmanApplicationStatus === "rejected") {
      return "Chairman Application Rejected";
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

            {(!user || (!roleLoading && ["user", "agent", "chairman"].includes(userRole || ""))) && (
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

              {(!user || (!roleLoading && ["user", "agent", "chairman"].includes(userRole || ""))) && (
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
            <div className="overflow-hidden rounded-2xl border border-[#102f46]/10 bg-white shadow-2xl">
              <div className="relative h-[430px] overflow-hidden">
                <iframe
                  title="Live interactive map of Ijegun Community Road, Lagos"
                  src="https://maps.google.com/maps?q=Ijegun%20Community%20Road%2C%20Lagos%2C%20Nigeria&t=&z=15&ie=UTF8&iwloc=&output=embed"
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />

                <div className="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-2rem)] rounded-xl border border-white/70 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#087b62]">
                    Explore the community
                  </p>
                  <p className="mt-1 text-sm font-black text-[#102f46]">
                    Ijegun Community Road
                  </p>
                  <p className="mt-1 text-[10px] text-[#63717a]">
                    Lagos, Nigeria · Move and zoom the map
                  </p>
                </div>

                <a
                  href="https://www.google.com/maps/search/?api=1&query=Ijegun+Community+Road%2C+Lagos%2C+Nigeria"
                  target="_blank"
                  rel="noreferrer"
                  className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-lg bg-[#f05a00] px-4 py-3 text-xs font-black text-white shadow-lg transition hover:bg-[#d94e00]"
                >
                  Open full map
                  <ArrowRight size={14} />
                </a>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[#102f46]/10 bg-white px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#102f46]">
                  <MapPin size={16} className="text-[#f05a00]" />
                  Ijegun, Lagos
                </div>
                <span className="text-[10px] text-[#71808a]">
                  Interactive live map
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK ACCESS