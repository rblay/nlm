import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { BusinessProfile, Recommendation, RecommendResponse } from "@/lib/types";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  const { profile }: { profile: BusinessProfile } = await request.json();

  if (!profile) {
    return NextResponse.json({ error: "profile is required" }, { status: 400 });
  }

  const signalSummary = [
    `Page title tag: ${profile.signals.titleTag ? `"${profile.signals.titleTag}"` : "missing"}`,
    `Meta description: ${profile.signals.hasMetaDescription ? "present" : "missing"}`,
    `Schema.org / JSON-LD markup on website: ${profile.signals.hasSchema ? "detected" : "not detected"}`,
    `Blog or news section on website: ${profile.signals.hasBlog ? "detected" : "not detected"}`,
    `FAQ page or FAQ schema on website: ${profile.signals.hasFAQ ? "detected" : "not detected"}`,
    `Social media links on website: ${profile.signals.socialLinks.length > 0 ? profile.signals.socialLinks.join(", ") : "none found"}`,
    `Google Maps embed on website: ${profile.signals.hasMapsEmbed ? "detected" : "not detected"}`,
    `Google Business Profile confirmed via Places API: ${profile.signals.hasGoogleBusinessProfile ? "yes" : "not found"}`,
    `GBP has opening hours set: ${profile.signals.gbpHasHours ? "yes" : profile.signals.hasGoogleBusinessProfile ? "no" : "unknown (no GBP found)"}`,
    `GBP photo count: ${profile.signals.gbpPhotoCount !== null ? profile.signals.gbpPhotoCount : profile.signals.hasGoogleBusinessProfile ? "0" : "unknown (no GBP found)"}`,
    `Google review count: ${profile.signals.reviewCount !== null ? profile.signals.reviewCount : "unavailable"}`,
    `Google review rating: ${profile.signals.reviewRating !== null ? `${profile.signals.reviewRating}/5` : "unavailable"}`,
  ].join("\n");

  let recommendations: Recommendation[];
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an LLM visibility consultant for small businesses. Your job is to analyse a business profile and its observable online signals, then generate a prioritised list of gap-based recommendations for things that are missing.

CRITICAL RULES:
- Only flag signals that are missing or absent — never recommend fixing something the business already does
- Each item must be grounded in the observed signals
- Rank by expected impact: High > Medium > Low
- Return 3–6 recommendations maximum

Return a JSON object with exactly this shape:
{
  "recommendations": [
    {
      "title": "short action-oriented title (string)",
      "whyItMatters": "1–2 sentences explaining how this gap hurts LLM visibility (string)",
      "observed": "what was (or wasn't) found on the site (string)",
      "impact": "High" | "Medium" | "Low",
      "firstAction": "one concrete, specific next step the business can take today (string)"
    }
  ]
}

Gap categories to consider (only flag if missing):
1. Google Business Profile — confirmed via Google Places API. If not found, recommend creating one.
2. Schema.org markup — LocalBusiness/Organization JSON-LD makes the business machine-readable
3. Review volume and recency — flag if count < 50 or rating < 4.0. Skip if strong. Do not guess if data unavailable.
4. Page title and meta description — flag if missing
5. Website content quality — if no FAQ detected, recommend adding one
6. Blog / fresh content — flag if no blog detected
7. Social presence — flag if no social links found
8. GBP completeness — flag missing hours or photo count < 10 if GBP exists
9. Local directory citations — Yelp, TripAdvisor, Foursquare`,
        },
        {
          role: "user",
          content: `Business: ${profile.name}
Type: ${profile.type}
Location: ${profile.location}
Description: ${profile.description}
Services: ${profile.services.join(", ")}

Observable signals detected:
${signalSummary}`,
        },
      ],
      max_tokens: 1200,
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
    recommendations = parsed.recommendations ?? [];
  } catch (err) {
    console.error("[recommend] OpenAI call failed:", err);
    return NextResponse.json(
      { error: "Failed to generate recommendations — check your OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  const response: RecommendResponse = { recommendations };
  return NextResponse.json(response);
}
