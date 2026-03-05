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
          content: `You are an LLM visibility consultant for small businesses. Your job is to analyse a business profile and its observable online signals, then generate gap-based recommendations to improve how AI assistants discover and describe the business.

CRITICAL RULES:
- Only recommend actions for gaps — things that are missing or weak
- If a signal is already present and strong, do NOT recommend it (skip that category entirely)
- Each recommendation must be grounded in the observed signals
- Rank by expected impact on LLM visibility: High > Medium > Low
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

The categories to consider (only flag gaps):
1. Google Business Profile — we have confirmed via the Google Places API whether a GBP exists. If not found, recommend creating one. If found, skip this category entirely and focus on other gaps.
2. Schema.org markup — LocalBusiness/Organization JSON-LD makes the business machine-readable
3. Review volume and recency — we have the real Google review count and rating from the Places API. If review count is low (under 50) or rating is below 4.0, flag it. If reviews are strong (50+ reviews, 4.0+), skip this category. If data is unavailable, do not make assumptions.
4. Website content quality — clear service descriptions, location pages, FAQs. If no FAQ detected, recommend adding one as LLMs pull heavily from Q&A content.
5. Blog / fresh content — regular publishing signals an active, relevant business
6. Social presence — active social profiles feed LLM training data
7. GBP completeness — opening hours and photos on the GBP listing improve local ranking and LLM data quality. Flag missing hours or low photo count (under 10) as separate gaps if GBP exists.
8. Local directory citations — Yelp, TripAdvisor, Foursquare listings`,
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
