import { NextRequest, NextResponse } from "next/server";
import type { BusinessProfile } from "@/lib/types";
import { upsertBusiness, insertSignals } from "@/lib/db/research";

/**
 * POST /api/research/seed
 *
 * Seed a business into the research dataset without running the full scoring pipeline.
 *
 * Body (one of):
 *   { "url": "https://..." }                         — triggers /api/analyze internally
 *   { "profile": BusinessProfile, "url": "..." }    — uses provided profile directly
 */
export async function POST(request: NextRequest) {
  const body = await request.json() as { url?: string; profile?: BusinessProfile };
  const { url, profile: providedProfile } = body;

  if (!url && !providedProfile) {
    return NextResponse.json(
      { error: "Provide either 'url' or 'profile'" },
      { status: 400 }
    );
  }

  let profile: BusinessProfile;
  let resolvedUrl: string = url ?? "";

  if (providedProfile) {
    profile = providedProfile;
  } else {
    // Call the analyze endpoint internally
    const analyzeUrl = new URL("/api/analyze", request.url).toString();
    const analyzeRes = await fetch(analyzeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!analyzeRes.ok) {
      const err = await analyzeRes.json().catch(() => ({ error: "analyze failed" }));
      return NextResponse.json(err, { status: analyzeRes.status });
    }
    const { profile: fetchedProfile } = await analyzeRes.json();
    profile = fetchedProfile;
  }

  const businessId = await upsertBusiness(resolvedUrl, profile, "seeded");
  if (!businessId) {
    return NextResponse.json({ error: "Failed to upsert business" }, { status: 500 });
  }

  await insertSignals(businessId, profile, "script");

  return NextResponse.json({
    success: true,
    businessId,
    name: profile.name,
    type: profile.type,
    location: profile.location,
  });
}
