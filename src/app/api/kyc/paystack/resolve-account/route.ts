import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secretKey || !supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Account verification is not configured yet." }, { status: 503 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
      },
    },
  });
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) {
    return NextResponse.json({ error: "Please sign in before checking a bank account." }, { status: 401 });
  }

  let input: { bankCode?: unknown; accountNumber?: unknown };
  try { input = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const bankCode = typeof input.bankCode === "string" ? input.bankCode.trim() : "";
  const accountNumber = typeof input.accountNumber === "string" ? input.accountNumber.trim() : "";
  if (!/^\d+$/.test(bankCode) || !/^\d{10}$/.test(accountNumber)) {
    return NextResponse.json({ error: "Choose a bank and enter a valid 10-digit account number." }, { status: 400 });
  }

  try {
    const url = new URL("https://api.paystack.co/bank/resolve");
    url.searchParams.set("account_number", accountNumber);
    url.searchParams.set("bank_code", bankCode);
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + secretKey },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || result?.status !== true || typeof result?.data?.account_name !== "string") {
      return NextResponse.json({ error: "Paystack could not resolve that account. Check the bank and account number." }, { status: 422 });
    }
    return NextResponse.json({ accountName: result.data.account_name }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Paystack account resolution failed:", error);
    return NextResponse.json({ error: "Could not check this account right now. Please try again." }, { status: 502 });
  }
}
