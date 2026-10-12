import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type PayoutAccountInput = {
  bankCode?: unknown;
  accountNumber?: unknown;
};

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function getAuthenticatedUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { user: null, response: NextResponse.json({ error: "Authentication is not configured." }, { status: 503 }) };
  }

  const cookieStore = await cookies();
  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Authentication still fails closed if cookies cannot be refreshed.
        }
      },
    },
  });

  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) {
    return { user: null, response: NextResponse.json({ error: "Please sign in first." }, { status: 401 }) };
  }
  return { user: data.user, response: null };
}

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.user) return auth.response!;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Secure bank-account storage is not configured." }, { status: 503 });
  }

  const adminClient = createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: { getAll: () => [], setAll: () => undefined },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await adminClient
    .from("spatdel_payout_accounts")
    .select("id,bank_name,account_name,account_number_last4,status,is_default,created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load payout accounts:", error);
    return NextResponse.json({ error: "Could not load your saved bank accounts." }, { status: 500 });
  }

  return NextResponse.json({ accounts: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.user) return auth.response!;

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "SPATDEL has not connected its payment provider yet. Bank-account linking will be available after the admin completes setup." },
      { status: 503 }
    );
  }

  let input: PayoutAccountInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const bankCode = cleanString(input.bankCode, 20);
  const accountNumber = cleanString(input.accountNumber, 10);
  if (!/^\d+$/.test(bankCode) || !/^\d{10}$/.test(accountNumber)) {
    return NextResponse.json({ error: "Choose a bank and enter a valid 10-digit account number." }, { status: 400 });
  }

  try {
    const resolveUrl = new URL("https://api.paystack.co/bank/resolve");
    resolveUrl.searchParams.set("account_number", accountNumber);
    resolveUrl.searchParams.set("bank_code", bankCode);
    const resolveResponse = await fetch(resolveUrl, {
      headers: { Authorization: "Bearer " + secretKey },
      cache: "no-store",
    });
    const resolveResult = await resolveResponse.json();

    if (!resolveResponse.ok || resolveResult?.status !== true || typeof resolveResult?.data?.account_name !== "string") {
      return NextResponse.json({ error: "Paystack could not verify this bank account. Check the bank and account number." }, { status: 422 });
    }

    const accountName = String(resolveResult.data.account_name).trim();
    const recipientResponse = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      }),
      cache: "no-store",
    });
    const recipientResult = await recipientResponse.json();

    if (!recipientResponse.ok || recipientResult?.status !== true || typeof recipientResult?.data?.recipient_code !== "string") {
      console.error("Paystack recipient creation failed:", recipientResult?.message || recipientResponse.status);
      return NextResponse.json({ error: "Paystack could not register this payout account. Please try again later." }, { status: 502 });
    }

    // Never persist the full account number. Store only Paystack's recipient token
    // and the last four digits needed to help the user identify the account.
    const adminClient = createServerClient(supabaseUrl, serviceRoleKey, {
      cookies: { getAll: () => [], setAll: () => undefined },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const bankName = typeof recipientResult.data?.details?.bank_name === "string"
      ? recipientResult.data.details.bank_name.slice(0, 120)
      : null;

    const { data: saved, error: saveError } = await adminClient
      .from("spatdel_payout_accounts")
      .insert({
        user_id: auth.user.id,
        provider: "paystack",
        provider_recipient_code: recipientResult.data.recipient_code,
        bank_name: bankName,
        account_name: accountName.slice(0, 160),
        account_number_last4: accountNumber.slice(-4),
        status: "pending",
        is_default: false,
      })
      .select("id,bank_name,account_name,account_number_last4,status,is_default,created_at")
      .single();

    if (saveError) {
      console.error("Could not save payout account:", saveError);
      return NextResponse.json({ error: "The account was registered with the provider but SPATDEL could not save it. Contact support before trying again." }, { status: 500 });
    }

    return NextResponse.json({
      account: saved,
      message: "Bank account registered. It is pending SPATDEL review and is not enabled for withdrawals yet.",
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Payout account registration failed:", error);
    return NextResponse.json({ error: "Could not register this bank account right now." }, { status: 502 });
  }
}
