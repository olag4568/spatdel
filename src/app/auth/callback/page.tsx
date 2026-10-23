"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const handled = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const finishSignIn = async () => {
      const code = new URLSearchParams(window.location.search).get("code");

      if (!code) {
        setError("This confirmation link is missing its sign-in code. Request a new confirmation email and try again.");
        return;
      }

      const supabase = createClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setError("We could not complete email confirmation. The link may have expired or already been used. Please request a new confirmation email.");
        return;
      }

      router.replace("/");
      router.refresh();
    };

    void finishSignIn();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f7f2] px-5 text-[#102f46]">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        {error ? (
          <>
            <h1 className="text-2xl font-black">Confirmation link issue</h1>
            <p className="mt-3 text-sm leading-6 text-[#71808a]">{error}</p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-lg bg-[#102f46] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#174763]"
            >
              Go to sign in
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#087b62]/20 border-t-[#087b62]" />
            <h1 className="mt-5 text-2xl font-black">Confirming your email</h1>
            <p className="mt-3 text-sm leading-6 text-[#71808a]">
              Please wait while we securely finish setting up your SPATDEL account.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
