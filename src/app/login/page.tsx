"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setLoading(false);

      if (
        loginError.message.toLowerCase().includes("email not confirmed")
      ) {
        setError(
          "Please confirm your email address before signing in."
        );
      } else {
        setError(loginError.message);
      }

      return;
    }

    setLoading(false);

    router.push("/");
    router.refresh();
  }

  async function handleForgotPassword() {
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    setLoading(true);

    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage(
      "Password reset instructions have been sent to your email."
    );
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

      {/* LOGIN */}
      <section className="flex min-h-[calc(100vh-76px)] items-center justify-center px-5 py-12 sm:px-8">
        <div className="grid w-full max-w-[1000px] overflow-hidden rounded-2xl bg-white shadow-xl lg:grid-cols-2">

          {/* LEFT SIDE */}
          <div className="hidden bg-[#102f46] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#19e58f] text-[#071b18]">
                <ShieldCheck size={26} />
              </div>

              <h1 className="mt-8 text-4xl font-black leading-tight">
                Welcome back to
                <span className="block text-[#19e58f]">
                  SPATDEL.
                </span>
              </h1>

              <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
                Sign in to manage your properties, save verified homes,
                track your rewards and access your SPATDEL community.
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
                Sign in
              </h2>

              <p className="mt-2 text-sm text-[#71808a]">
                Access your SPATDEL account.
              </p>

              <form
                onSubmit={handleLogin}
                className="mt-8 space-y-5"
              >

                {/* EMAIL */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide">
                    Email Address
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full rounded-lg border border-[#102f46]/15 bg-[#f8f7f2] px-4 py-3.5 text-sm outline-none transition focus:border-[#087b62] focus:ring-2 focus:ring-[#087b62]/10"
                  />
                </div>

                {/* PASSWORD */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wide">
                      Password
                    </label>

                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={loading}
                      className="text-xs font-semibold text-[#087b62] hover:text-[#f05a00] disabled:opacity-50"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={
                        showPassword ? "text" : "password"
                      }
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      placeholder="Enter your password"
                      autoComplete="current-password"
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
                </div>

                {/* ERROR */}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                {/* SUCCESS MESSAGE */}
                {message && (
                  <div className="rounded-lg border border-[#087b62]/20 bg-[#e4f5ee] px-4 py-3 text-sm text-[#087b62]">
                    {message}
                  </div>
                )}

                {/* SIGN IN */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-lg bg-[#102f46] py-4 text-sm font-bold text-white transition hover:bg-[#174763] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Signing in..."
                    : "Sign In"}
                </button>
              </form>

              {/* SIGN UP */}
              <div className="mt-7 text-center text-sm text-[#71808a]">
                Don't have an account?{" "}
                <button
                  onClick={() => router.push("/signup")}
                  className="font-bold text-[#087b62] hover:text-[#f05a00]"
                >
                  Create an account
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