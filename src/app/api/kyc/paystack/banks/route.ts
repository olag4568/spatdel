import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Paystack is not configured yet." }, { status: 503 });
  }

  try {
    const response = await fetch("https://api.paystack.co/bank?country=nigeria&perPage=100", {
      headers: { Authorization: "Bearer " + secretKey },
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok || result?.status !== true || !Array.isArray(result?.data)) {
      return NextResponse.json({ error: "Could not load supported banks from Paystack." }, { status: 502 });
    }

    const banks = result.data
      .filter((bank: { name?: string; code?: string; active?: boolean }) =>
        typeof bank.name === "string" && typeof bank.code === "string" && bank.active !== false
      )
      .map((bank: { name: string; code: string }) => ({ name: bank.name, code: bank.code }))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

    return NextResponse.json({ banks }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    console.error("Paystack bank list request failed:", error);
    return NextResponse.json({ error: "Could not load banks right now." }, { status: 502 });
  }
}
