"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [community, setCommunity] = useState("ijegun-ikotun");

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

    setLoading(true);

    const { data, error: signupError } =
      await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          // Return to this app origin, where the callback exchanges the PKCE code for a session.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: cleanName,
            role: "tenant",
            community_area: community,
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

    setMessage("Account created successfully for the Ijegun–Ikotun community. Please check your email to confirm your account before signing in.");

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
          <div
            className="relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(16, 47, 70, 0.35) 0%, rgba(16, 47, 70, 0.88) 100%), url('https://images.privateproperty.com.ng/large/tastefully-newly-built-2-bedroom-0UGeMX6xmyH8DrcXxiJN.jpg')",
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          >
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

                {/* COMMUNITY AREA */}
                <div>
                  <label className="mb-3 block text-xs font-bold uppercase tracking-wide">
                    Choose your community
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setCommunity("ijegun-ikotun")}
                      aria-pressed={community === "ijegun-ikotun"}
                      className={`rounded-lg border p-4 text-left transition ${
                        community === "ijegun-ikotun"
                          ? "border-[#087b62] bg-[#e4f5ee] text-[#087b62] ring-1 ring-[#087b62]/20"
                          : "border-[#102f46]/15 bg-[#f8f7f2] text-[#102f46] hover:border-[#087b62]/40"
                      }`}
                    >
                      <span className="block text-sm font-bold">Ijegun–Ikotun</span>
                      <span className="mt-1 block text-xs font-semibold text-[#087b62]">Available now</span>
                    </button>

                    <div
                      aria-disabled="true"
                      className="cursor-not-allowed rounded-lg border border-[#102f46]/10 bg-[#f8f7f2]/70 p-4 text-left opacity-70"
                    >
                      <span className="block text-sm font-bold text-[#102f46]">Other parts of Lagos</span>
                      <span className="mt-1 block text-xs font-semibold text-[#71808a]">Coming soon</span>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-[#71808a]">
                    SPATDEL is launching first in Ijegun–Ikotun, with more Lagos communities coming soon.
                  </p>
                </div>

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