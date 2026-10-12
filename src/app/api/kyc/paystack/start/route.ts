import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

type KycRequest = {
  firstName?: unknown;
  lastName?: unknown;
  bankCode?: unknown;
  accountNumber?: unknown;
  bvn?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  const paystackKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!paystackKey || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "KYC verification is not configured yet." }, { status: 503 });
  }

  const cookieStore = await cookies();
  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // A route may not be allowed to refresh cookies; the auth check still fails closed.
        }
      },
    },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser();
  const user = authData.user;
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in before starting identity verification." }, { status: 401 });
  }
  if (!user.email) {
    return NextResponse.json({ error: "Add and confirm an email address to your account first." }, { status: 400 });
  }

  let input: KycRequest;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const firstName = cleanText(input.firstName, 80);
  const lastName = cleanText(input.lastName, 80);
  const bankCode = cleanText(input.bankCode, 20);
  const accountNumber = cleanText(input.accountNumber, 20);
  const bvn = cleanText(input.bvn, 20);

  if (!firstName || !lastName || !/^\d{10}$/.test(accountNumber) || !/^\d{11}$/.test(bvn) || !/^\d+$/.test(bankCode)) {
    return NextResponse.json({
      error: "Enter your first and last name, choose a bank, provide a 10-digit account number and an 11-digit BVN.",
    }, { status: 400 });
  }

  // The service-role client is server-only and is never sent to the browser.
  const adminClient = createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: { getAll: () => [], setAll: () => undefined },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: currentKyc, error: currentKycError } = await adminClient
    .from("spatdel_kyc_profiles")
    .select("status,provider,provider_reference")
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentKycError || !currentKyc) {
    return NextResponse.json({ error: "Your KYC profile is not ready. Apply the SPATDEL wallet migration and try again." }, { status: 409 });
  }
  if (currentKyc.status === "verified") {
    return NextResponse.json({ error: "Your identity is already verified." }, { status: 409 });
  }
  if (currentKyc.status === "pending" && currentKyc.provider === "paystack" && currentKyc.provider_reference) {
    return NextResponse.json({ error: "Your Paystack verification is already in progress. Refresh this page for updates." }, { status: 409 });
  }

  let customerCodeForRecovery = currentKyc.provider === "paystack" ? currentKyc.provider_reference : null;

  try {
    let customerCode = customerCodeForRecovery;

    if (!customerCode) {
      const customerResponse = await fetch("https://api.paystack.co/customer", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + paystackKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          metadata: { spatdel_user_id: user.id },
        }),
        cache: "no-store",
      });
      const customerResult = await customerResponse.json();
      if (!customerResponse.ok || customerResult?.status !== true || !customerResult?.data?.customer_code) {
        console.error("Paystack customer creation failed:", customerResult?.message || customerResponse.status);
        return NextResponse.json({ error: "Paystack could not start verification. Please try again later." }, { status: 502 });
      }
      customerCode = String(customerResult.data.customer_code);
      customerCodeForRecovery = customerCode;
    }

    const { error: saveError } = await adminClient
      .from("spatdel_kyc_profiles")
      .update({
        status: "pending",
        provider: "paystack",
        provider_reference: customerCode,
        verified_at: null,
        reviewed_by: null,
        review_note: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (saveError) throw saveError;
    customerCodeForRecovery = customerCode;

    const identifyResponse = await fetch(
      "https://api.paystack.co/customer/" + encodeURIComponent(customerCode) + "/identification",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + paystackKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          country: "NG",
          type: "bank_account",
          account_number: accountNumber,
          bvn,
          bank_code: bankCode,
          first_name: firstName,
          last_name: lastName,
        }),
        cache: "no-store",
      }
    );
    const identifyResult = await identifyResponse.json();

    if (!identifyResponse.ok || identifyResult?.status !== true) {
      await adminClient
        .from("spatdel_kyc_profiles")
        .update({
          status: "needs_review",
          review_note: "Paystack did not accept the identification request. User must retry or contact support.",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("provider_reference", customerCode);

      console.error("Paystack identification request failed:", identifyResult?.message || identifyResponse.status);
      return NextResponse.json({ error: "Paystack could not accept these details. Check them and try again." }, { status: 422 });
    }

    // BVN and account number are intentionally not stored in SPATDEL.
    return NextResponse.json({
      ok: true,
      status: "pending",
      message: "Verification started. SPATDEL will update your status when Paystack sends its verification result.",
    });
  } catch (error) {
    console.error("Paystack KYC request failed:", error);
    // If the provider request fails after the profile was marked pending, avoid leaving it stuck forever.
    if (customerCodeForRecovery) {
      const { error: recoveryError } = await adminClient
        .from("spatdel_kyc_profiles")
        .update({
          status: "needs_review",
          review_note: "The verification request could not be completed. User may retry or contact support.",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("provider", "paystack")
        .eq("provider_reference", customerCodeForRecovery)
        .eq("status", "pending");
      if (recoveryError) console.error("Could not recover SPATDEL KYC status:", recoveryError);
    }
    return NextResponse.json({ error: "Could not start verification. Please try again later." }, { status: 502 });
  }
}
