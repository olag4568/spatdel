"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!password || !confirmPassword) {
      setError("Please enter your new password.");
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

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage(
      "Your password has been updated successfully. You can now sign in."
    );

    setPassword("");
    setConfirmPassword("");

    setTimeout(() => {
      router.push("/login");
    }, 1800);
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
            onClick={() => router.push("/login")}
            className="flex items-center gap-2 text-sm font-semibold text-[#102f46] transition hover:text-[#f05a00]"
          >
            <ArrowLeft size={17} />
            Back to sign in
          </button>
        </div>
      </header>

      {/* RESET PASSWORD */}
      <section className="flex min-h-[calc(100vh-76px)] items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-[520px] rounded-2xl bg-white p-7 shadow-xl sm:p-10">
          {/* LOGO */}
          <div className="mb-7 flex justify-center">
            <img
              src="/spatdel.png"
              alt="SPATDEL"
              className="h-14 w-auto object-contain"
            />
          </div>

          <div className="mb-7 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#e4f5ee] text-[#087b62]">
              <ShieldCheck size={28} />
            </div>

            <h1 className="mt-6 text-3xl font-black">
              Reset Password
            </h1>

            <p className="mt-2 text-sm leading-6 text-[#71808a]">
              Create a new password for your SPATDEL account.
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-5">
            {/* NEW PASSWORD */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide">
                New Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-[#102f46]/15 bg-[#f8f7f2] px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-[#087b62] focus:ring-2 focus:ring-[#087b62]/10"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
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

            {/* CONFIRM PASSWORD */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide">
                Confirm Password
              </label>

              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder="Confirm your new password"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-[#102f46]/15 bg-[#f8f7f2] px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-[#087b62] focus:ring-2 focus:ring-[#087b62]/10"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71808a] hover:text-[#102f46]"
                  aria-label="Toggle password visibility"
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
              <div className="rounded-lg border border-[#087b62]/20 bg-[#e4f5ee] px-4 py-3 text-sm text-[#087b62]">
                {message}
              </div>
            )}

            {/* RESET */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-[#102f46] py-4 text-sm font-bold text-white transition hover:bg-[#174763] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating password..." : "Update Password"}
            </button>
          </form>

          <div className="mt-7 text-center text-sm text-[#71808a]">
            Remember your password?{" "}
            <button
              onClick={() => router.push("/login")}
              className="font-bold text-[#087b62] hover:text-[#f05a00]"
            >
              Sign in
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}