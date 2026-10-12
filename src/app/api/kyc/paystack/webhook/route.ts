import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 401 });

  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(signature, "hex");
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: { event?: string; data?: { customer_code?: string; reason?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const customerCode = event.data?.customer_code;
  if (!customerCode || !["customeridentification.success", "customeridentification.failed"].includes(String(event.event))) {
    return NextResponse.json({ received: true });
  }

  const adminClient = createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: { getAll: () => [], setAll: () => undefined },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const succeeded = event.event === "customeridentification.success";
  const { error } = await adminClient
    .from("spatdel_kyc_profiles")
    .update({
      status: succeeded ? "verified" : "rejected",
      verified_at: succeeded ? new Date().toISOString() : null,
      review_note: succeeded ? null : String(event.data?.reason || "Paystack could not verify the supplied identity and bank details.").slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "paystack")
    .eq("provider_reference", customerCode)
    .eq("status", "pending");

  if (error) {
    console.error("Could not update SPATDEL KYC from Paystack webhook:", error);
    return NextResponse.json({ error: "Could not update KYC status." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
