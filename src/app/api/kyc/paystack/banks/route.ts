import { NextResponse } from "next/server";

export async function GET() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  // Paystack is optional during development. Report its setup state without
  // treating an intentionally unconfigured provider as a page-breaking error.
  if (!secretKey) {
    return NextResponse.json(
      { configured: false, banks: [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const allBanks: Array<{ name: string; code: string; active?: boolean }> = [];
    let page = 1;
    let pageCount = 1;

    do {
      const url = new URL("https://api.paystack.co/bank");
      url.searchParams.set("country", "nigeria");
      url.searchParams.set("perPage", "100");
      url.searchParams.set("page", String(page));
      const response = await fetch(url, {
        headers: { Authorization: "Bearer " + secretKey },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || result?.status !== true || !Array.isArray(result?.data)) {
        return NextResponse.json({ error: "Could not load supported banks from Paystack." }, { status: 502 });
      }
      allBanks.push(...result.data);
      pageCount = Math.min(Number(result?.meta?.pageCount) || 1, 10);
      page += 1;
    } while (page <= pageCount);

    const uniqueBanks = new Map<string, { name: string; code: string }>();
    for (const bank of allBanks) {
      if (typeof bank.name === "string" && typeof bank.code === "string" && bank.active !== false) {
        uniqueBanks.set(bank.code, { name: bank.name, code: bank.code });
      }
    }
    const banks = [...uniqueBanks.values()].sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(
      { configured: true, banks },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch (error) {
    console.error("Paystack bank list request failed:", error);
    return NextResponse.json({ error: "Could not load banks right now." }, { status: 502 });
  }
}
