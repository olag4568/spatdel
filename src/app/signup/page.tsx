"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  ShieldCheck,
  UserPlus,
  User,
  Building2,
  Home,
  ShieldCheck as ChairmanIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type UserRole = "tenant" | "agent" | "landlord" | "chairman";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [communityCountry, setCommunityCountry] = useState("");
  const [communityState, setCommunityState] = useState("");
  const [localGovernment, setLocalGovernment] = useState("");
  const [applicationReason, setApplicationReason] = useState("");

  const [role, setRole] = useState<UserRole>("tenant");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setMessage("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (
      !cleanName ||
      !cleanEmail ||
      !password ||
      !confirmPassword
    ) {
      setError("Please complete all fields.");
      return;
    }

    if (cleanName.length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (role === "chairman" && (!communityName.trim() || !communityCountry.trim() || !communityState.trim() || !localGovernment.trim())) {
      setError("Please enter your country, region/state, administrative area, and community name.");
      return;
    }

    setLoading(true);

    const { data, error: signupError } =
      await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            // Chairman applicants remain ordinary tenants until an admin approves them.
            role: role === "chairman" ? "tenant" : role,
            requested_role: role === "chairman" ? "chairman" : role,
            ...(role === "chairman" ? {
              chairman_community_name: communityName.trim(),
              chairman_country: communityCountry.trim(),
              chairman_state: communityState.trim(),
              chairman_local_government: localGovernment.trim(),
              chairman_application_reason: applicationReason.trim(),
            } : {}),
          },
        },
      });

    if (signupError) {
      setLoading(false);

      const errorMessage = signupError.message.toLowerCase();

      if (errorMessage.includes("rate limit")) {
        setError(
          "Too many signup attempts. Please wait a while and try again."
        );
      } else if (
        errorMessage.includes("already registered") ||
        errorMessage.includes("already been registered")
      ) {
        setError(
          "An account with this email already exists. Try signing in instead."
        );
      } else {
        setError(signupError.message);
      }

      return;
    }

    setLoading(false);

    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }

    setMessage(
      role === "chairman"
        ? "Your Chairman application has been submitted for review. Your account will not receive chairman access unless an admin approves it. Please check your email to confirm your account before signing in."
        : `Account created successfully as a ${role === "tenant" ? "Tenant" : role === "agent" ? "Agent" : "Landlord"}. Please check your email to confirm your account before signing in.`
    );

    setPassword("");
    setConfirmPassword("");
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#102f46]">
      {/* TOP BAR */}
      <header className="border-b border-[#102f46]/10 bg-[#f8f7f2]">
        <div className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between px-5 sm:px-8">
          <button
            onClick={() => router.push("/")}
            className="flex items-center"
          >
            <img
              src="/spatdel.png"
              alt="SPATDEL"
              className="h-14 w-auto object-contain"
            />
          </button>

          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm font-semibold text-[#102f46] transition hover:text-[#f05a00]"
          >
            <ArrowLeft size={17} />
            Back to home
          </button>
        </div>
      </header>

      {/* SIGNUP */}
      <section className="flex min-h-[calc(100vh-76px)] items-center justify-center px-5 py-12 sm:px-8">
        <div className="grid w-full max-w-[1000px] overflow-hidden rounded-2xl bg-white shadow-xl lg:grid-cols-2">
          {/* LEFT SIDE */}
          <div className="hidden bg-[#102f46] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#19e58f] text-[#071b18]">
                <UserPlus size={26} />
              </div>

              <h1 className="mt-8 text-4xl font-black leading-tight">
                Join
                <span className="block text-[#19e58f]">
                  SPATDEL.
                </span>
              </h1>

              <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
                Create your account to discover verified homes,
                save properties, earn rewards and access your
                SPATDEL community.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-bold">
                Rent with certainty.
              </p>

              <p className="mt-2 text-xs leading-6 text-white/50">
                Verified homes. Community intelligence. Safer payments.
              </p>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="p-7 sm:p-10 lg:p-12">
            <div className="mx-auto max-w-md">
              {/* MOBILE LOGO */}
              <div className="lg:hidden">
                <div className="mb-7 flex justify-center">
                  <img
                    src="/spatdel.png"
                    alt="SPATDEL"
                    className="h-14 w-auto object-contain"
                  />
                </div>
              </div>

              <h2 className="text-3xl font-black">
                Create account
              </h2>

              <p className="mt-2 text-sm text-[#71808a]">
                Join SPATDEL and rent with certainty.
              </p>

              <form
                onSubmit={handleSignup}
                className="mt-8 space-y-5"
              >
                {/* FULL NAME */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide">
                    Full Name
                  </label>

                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) =>
                      setFullName(e.target.value)
                    }
                    placeholder="Your full name"
                    autoComplete="name"
                    className="w-full rounded-lg border border-[#102f46]/15 bg-[#f8f7f2] px-4 py-3.5 text-sm outline-none transition focus:border-[#087b62] focus:ring-2 focus:ring-[#087b62]/10"
                  />
                </div>

                {/* EMAIL */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide">
                    Email Address
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full rounded-lg border border-[#102f46]/15 bg-[#f8f7f2] px-4 py-3.5 text-sm outline-none transition focus:border-[#087b62] focus:ring-2 focus:ring-[#087b62]/10"
                  />
                </div>

                {/* ACCOUNT TYPE */}
                <div>
                  <label className="mb-3 block text-xs font-bold uppercase tracking-wide">
                    I am a
                  </label>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {/* TENANT */}
                    <button
                      type="button"
                      onClick={() => setRole("tenant")}
                      className={`rounded-lg border p-3 text-center transition ${
                        role === "tenant"
                          ? "border-[#087b62] bg-[#e4f5ee] text-[#087b62]"
                          : "border-[#102f46]/15 bg-[#f8f7f2] text-[#102f46] hover:border-[#087b62]/40"
                      }`}
                    >
                      <User
                        size={20}
                        className="mx-auto"
                      />

                      <span className="mt-2 block text-xs font-bold">
                        Tenant
                      </span>
                    </button>

                    {/* AGENT */}
                    <button
                      type="button"
                      onClick={() => setRole("agent")}
                      className={`rounded-lg border p-3 text-center transition ${
                        role === "agent"
                          ? "border-[#087b62] bg-[#e4f5ee] text-[#087b62]"
                          : "border-[#102f46]/15 bg-[#f8f7f2] text-[#102f46] hover:border-[#087b62]/40"
                      }`}
                    >
                      <Building2
                        size={20}
                        className="mx-auto"
                      />

                      <span className="mt-2 block text-xs font-bold">
                        Agent
                      </span>
                    </button>

                    {/* CHAIRMAN — application only; approval is required for dashboard access */}
                    <button
                      type="button"
                      onClick={() => setRole("chairman")}
                      className={`rounded-lg border p-3 text-center transition ${role === "chairman" ? "border-[#087b62] bg-[#e4f5ee] text-[#087b62]" : "border-[#102f46]/15 bg-[#f8f7f2] text-[#102f46] hover:border-[#087b62]/40"}`}
                    >
                      <ChairmanIcon size={20} className="mx-auto" />
                      <span className="mt-2 block text-xs font-bold">Chairman</span>
                    </button>

                    {/* LANDLORD */}
                    <button
                      type="button"
                      onClick={() => setRole("landlord")}
                      className={`rounded-lg border p-3 text-center transition ${
                        role === "landlord"
                          ? "border-[#087b62] bg-[#e4f5ee] text-[#087b62]"
                          : "border-[#102f46]/15 bg-[#f8f7f2] text-[#102f46] hover:border-[#087b62]/40"
                      }`}
                    >
                      <Home
                        size={20}
                        className="mx-auto"
                      />

                      <span className="mt-2 block text-xs font-bold">
                        Landlord
                      </span>
                    </button>
                  </div>

                  <p className="mt-2 text-[10px] text-[#71808a]">
                    Choose the account type that best describes you.
                  </p>
                </div>

                {role === "chairman" && (
                  <div className="space-y-4 rounded-xl border border-[#087b62]/20 bg-[#e4f5ee]/50 p-4">
                    <div>
                      <h3 className="text-sm font-bold">Chairman application</h3>
                      <p className="mt-1 text-xs leading-5 text-[#71808a]">Tell us which community you represent. An admin must review your application before chairman access is granted.</p>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wide">Community name</label>
                      <input value={communityName} onChange={(e) => setCommunityName(e.target.value)} placeholder="Your community or estate name" className="w-full rounded-lg border border-[#102f46]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#087b62]" />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wide">Country</label>
                      <input value={communityCountry} onChange={(e) => setCommunityCountry(e.target.value)} placeholder="e.g. Nigeria, Ghana, United Kingdom" required className="w-full rounded-lg border border-[#102f46]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#087b62]" />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wide">State / province / region</label>
                      <input value={communityState} onChange={(e) => setCommunityState(e.target.value)} placeholder="e.g. Lagos" className="w-full rounded-lg border border-[#102f46]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#087b62]" />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wide">District / county / local government area</label>
                      <input value={localGovernment} onChange={(e) => setLocalGovernment(e.target.value)} placeholder="e.g. Ikeja" className="w-full rounded-lg border border-[#102f46]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#087b62]" />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wide">Why should you be the chairman? (optional)</label>
                      <textarea value={applicationReason} onChange={(e) => setApplicationReason(e.target.value)} rows={3} placeholder="Briefly explain your role in the community" className="w-full rounded-lg border border-[#102f46]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#087b62]" />
                    </div>
                  </div>
                )}

                {/* PASSWORD */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide">
                    Password
                  </label>

                  <div className="relative">
                    <input
                      type={
                        showPassword ? "text" : "password"
                      }
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      placeholder="Create a password"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-[#102f46]/15 bg-[#f8f7f2] px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-[#087b62] focus:ring-2 focus:ring-[#087b62]/10"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(!showPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71808a] hover:text-[#102f46]"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? (
                        <EyeOff size={19} />
                      ) : (
                        <Eye size={19} />
                      )}
                    </button>
                  </div>

                  <p className="mt-2 text-[10px] text-[#71808a]">
                    Use at least 6 characters.
                  </p>
                </div>

                {/* CONFIRM PASSWORD */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide">
                    Confirm Password
                  </label>

                  <div className="relative">
                    <input
                      type={
                        showConfirmPassword
                          ? "text"
                          : "password"
                      }
                      value={confirmPassword}
                      onChange={(e) =>
                        setConfirmPassword(e.target.value)
                      }
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-[#102f46]/15 bg-[#f8f7f2] px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-[#087b62] focus:ring-2 focus:ring-[#087b62]/10"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          !showConfirmPassword
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71808a] hover:text-[#102f46]"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={19} />
                      ) : (
                        <Eye size={19} />
                      )}
                    </button>
                  </div>
                </div>

                {/* ERROR */}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                {/* SUCCESS */}
                {message && (
                  <div className="rounded-lg border border-[#087b62]/20 bg-[#e4f5ee] px-4 py-3 text-sm leading-6 text-[#087b62]">
                    {message}
                  </div>
                )}

                {/* CREATE ACCOUNT */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-lg bg-[#102f46] py-4 text-sm font-bold text-white transition hover:bg-[#174763] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Creating account..."
                    : "Create Account"}
                </button>
              </form>

              {/* LOGIN */}
              <div className="mt-7 text-center text-sm text-[#71808a]">
                Already have an account?{" "}
                <button
                  onClick={() => router.push("/login")}
                  className="font-bold text-[#087b62] hover:text-[#f05a00]"
                >
                  Sign in
                </button>
              </div>

              {/* SECURITY NOTE */}
              <div className="mt-8 flex gap-3 rounded-lg bg-[#e4f5ee] p-4">
                <ShieldCheck
                  size={19}
                  className="mt-0.5 shrink-0 text-[#087b62]"
                />

                <p className="text-xs leading-5 text-[#38665a]">
                  Your account is protected with secure
                  authentication powered by Supabase.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}