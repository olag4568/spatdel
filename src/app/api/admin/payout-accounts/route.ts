import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    return { response: NextResponse.json({ error: "Admin payment tools are not configured on the server." }, { status: 503 }) };
  }

  const cookieStore = await cookies();
  const authClient = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Route handlers may not be allowed to refresh cookies in every context.
        }
      },
    },
  });

  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) {
    return { response: NextResponse.json({ error: "Please sign in first." }, { status: 401 }) };
  }

  const adminClient = createServerClient(url, serviceKey, {
    cookies: { getAll: () => [], setAll: () => undefined },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Could not check admin role:", profileError);
    return { response: NextResponse.json({ error: "Could not verify admin permissions." }, { status: 500 }) };
  }
  if (profile?.role !== "admin") {
    return { response: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  return { adminClient, response: null };
}

export async function GET() {
  const auth = await getClients();
  if (!auth.adminClient) return auth.response!;

  const { data: accounts, error } = await auth.adminClient
    .from("spatdel_payout_accounts")
    .select("id,user_id,provider,bank_name,account_name,account_number_last4,status,is_default,created_at,verified_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Could not load admin payout accounts:", error);
    return NextResponse.json({ error: "Could not load payout accounts. Confirm the wallet migration has been applied." }, { status: 500 });
  }

  const userIds = [...new Set((accounts ?? []).map((account) => account.user_id))];
  let profiles: Array<{ id: string; full_name: string | null; email: string | null }> = [];
  if (userIds.length) {
    const { data, error: profilesError } = await auth.adminClient
      .from("profiles")
      .select("id,full_name,email")
      .in("id", userIds);
    if (profilesError) {
      console.error("Could not load payout-account owners:", profilesError);
      return NextResponse.json({ error: "Could not load account owners." }, { status: 500 });
    }
    profiles = data ?? [];
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return NextResponse.json({
    configured: Boolean(process.env.PAYSTACK_SECRET_KEY),
    accounts: (accounts ?? []).map((account) => ({
      ...account,
      owner: profileById.get(account.user_id) ?? null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await getClients();
  if (!auth.adminClient) return auth.response!;

  let input: { id?: unknown; status?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const id = typeof input.id === "string" ? input.id.trim() : "";
  const status = input.status;
  if (!/^[0-9a-f-]{36}$/i.test(id) || (status !== "verified" && status !== "rejected")) {
    return NextResponse.json({ error: "Choose a valid payout account and review status." }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await auth.adminClient
    .from("spatdel_payout_accounts")
    .select("id,status,provider_recipient_code")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    console.error("Could not inspect payout account:", lookupError);
    return NextResponse.json({ error: "Could not inspect this payout account." }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ error: "Payout account not found." }, { status: 404 });
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "Only pending payout accounts can be reviewed." }, { status: 409 });
  }
  if (!existing.provider_recipient_code) {
    return NextResponse.json({ error: "This account has no provider recipient reference and cannot be approved." }, { status: 409 });
  }

  const { data: updated, error: updateError } = await auth.adminClient
    .from("spatdel_payout_accounts")
    .update({
      status,
      verified_at: status === "verified" ? new Date().toISOString() : null,
      is_default: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id,status,verified_at")
    .maybeSingle();

  if (updateError) {
    console.error("Could not update payout-account review:", updateError);
    return NextResponse.json({ error: "Could not save the review decision." }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: "This account was already reviewed. Refresh and try again." }, { status: 409 });

  return NextResponse.json({
    account: updated,
    message: status === "verified"
      ? "Payout account marked verified. This does not enable or initiate withdrawals."
      : "Payout account rejected. No money was moved.",
  }, { headers: { "Cache-Control": "no-store" } });
}
