import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { BusinessProfile, Improvement } from "@/lib/types";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  const {
    profile,
    queries,
    missedQueries,
    overallScore,
  }: {
    profile: BusinessProfile;
    queries: string[];
    missedQueries: string[];
    overallScore: number;
  } = await request.json();

  if (!profile || !queries) {
    return NextResponse.json({ error: "profile and queries are required" }, { status: 400 });
  }

  // Build a list of present signals (only things that exist — we're improving, not filling gaps)
  // Deliberately exclude any frequency or date signals — we care about content relevance only
  const presentSignals: string[] = [];

  if (profile.signals.hasBlog) {
    presentSignals.push("Blog/news section present on website");
  }
  if (profile.signals.hasFAQ) {
    const qNote = profile.signals.faqQuestions && profile.signals.faqQuestions.length > 0
      ? ` — ${profile.signals.faqQuestions.length} questions found: ${profile.signals.faqQuestions.slice(0, 6).join(" | ")}`
      : "";
    presentSignals.push(`FAQ page present${qNote}`);
  }
  if (profile.signals.socialLinks.length > 0) {
    presentSignals.push(`Social profiles: ${profile.signals.socialLinks.join(", ")}`);
  }
  if (profile.signals.hasGoogleBusinessProfile) {
    const photoNote = profile.signals.gbpPhotoCount !== null ? `, ${profile.signals.gbpPhotoCount} photos` : "";
    const hoursNote = profile.signals.gbpHasHours ? ", hours set" : ", no hours set";
    presentSignals.push(`Google Business Profile confirmed${photoNote}${hoursNote}`);
  }
  if (profile.signals.reviewCount !== null && profile.signals.reviewCount > 0) {
    presentSignals.push(`${profile.signals.reviewCount} Google reviews (${profile.signals.reviewRating ?? "?"}/5 rating)`);
  }
  if (profile.signals.hasSchema) {
    presentSignals.push(`Schema.org / JSON-LD markup present on website`);
  }
  if (profile.signals.titleTag) {
    presentSignals.push(`Title tag: "${profile.signals.titleTag}"`);
  }
  if (profile.signals.hasMetaDescription) {
    presentSignals.push("Meta description present");
  }

  // Nothing to improve — no present signals worth strengthening
  if (presentSignals.length === 0) {
    return NextResponse.json({ improvements: [] });
  }

  const missedQueriesText = missedQueries.length > 0
    ? missedQueries.join("\n")
    : "None — the business appeared in all tested queries";

  let improvements: Improvement[];
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an LLM visibility specialist. Your job is to help businesses get mentioned more often when AI systems answer customer questions — by improving the relevance and machine-readability of content they already have.

You will receive:
- A business profile (name, type, location, services)
- The queries AI systems were tested against
- The specific queries where this business was NOT mentioned by any AI
- A list of signals (content assets) the business already has

Your task: generate 2–4 specific, query-aligned improvement suggestions for assets the business ALREADY HAS.

CRITICAL RULES:
- Only suggest improvements for signals listed under "Existing assets". Never suggest creating something new.
- NEVER mention frequency, posting cadence, or how often content is published — that is not relevant here.
- Be specific: reference actual missed query patterns in your gap explanation so the business understands the connection.
- Focus on content relevance and machine-readability — how existing assets can better signal the right topics to AI systems.
- Rank by expected impact on LLM mention frequency: High > Medium > Low
- Return 2–4 improvements maximum. If fewer than 2 are genuinely impactful, return only those.
- If nothing qualifies (assets are already well-aligned), return an empty array.

Return a JSON object with exactly this shape:
{
  "improvements": [
    {
      "title": "short action-oriented title — e.g. 'Increase Blog Relevance for AI' or 'Enrich Schema Markup' (string)",
      "whatYouHave": "positive, specific description of what the business already has (string)",
      "gap": "1–2 sentences on WHY this asset isn't helping with the missed queries, with specific query examples (string)",
      "potential": "High" | "Medium" | "Low",
      "action": "one specific, concrete next step to improve alignment with missed query patterns (string)"
    }
  ]
}

Improvement categories — only flag if the signal IS present:

1. Blog relevance for AI — blog exists but the content doesn't use the natural-language phrases, intent patterns, or service+location combinations from missed queries. LLMs learn from indexed content, so blog posts that don't include the exact language people use when asking AI questions won't help visibility. Focus on topic alignment and language naturalness, NOT frequency.

2. FAQ keyword alignment — FAQ exists but questions are phrased as internal business language rather than the conversational patterns from missed queries (e.g. "Do you offer X?" vs "best X near [location]"). AI systems prioritise FAQ content when answering direct questions — aligning question phrasing to real queries has outsized impact.

3. Schema markup depth — Schema.org markup is present, but it may be using a generic type (e.g. LocalBusiness) rather than the most specific applicable type (e.g. Restaurant, HealthClub, BeautySalon, LegalService). Additionally, fields like serviceArea, hasOfferCatalog, openingHoursSpecification, sameAs (social profiles), and priceRange are commonly missing and directly used by LLMs to describe businesses in responses.

4. Title tag and meta description language — title tag and/or meta description are present but likely use brand-first or generic language rather than the service+location+intent language from missed queries. These are primary data sources for LLMs when structured data is absent.

5. Social content focus — social profiles exist but the topics, captions, and language probably don't address the intent patterns from missed queries. LLMs are trained on indexed social content — posts that use the right service and location language improve brand signal.

6. GBP description language — GBP is confirmed but the business description field may not include the natural-language service and location phrases from missed queries. AI assistants frequently pull GBP descriptions verbatim.

7. Review response strategy — reviews exist and responding to them with keyword-rich language (services, location, specific use cases) would strengthen the brand signal for missed queries. Review response text is indexed and used by LLMs.`,
        },
        {
          role: "user",
          content: `Business: ${profile.name}
Type: ${profile.type}
Location: ${profile.location}
Description: ${profile.description}
Services: ${profile.services.join(", ")}

Existing assets:
${presentSignals.join("\n")}

All queries tested (what potential customers search for):
${queries.join("\n")}

Missed queries — where this business was NOT mentioned by any AI:
${missedQueriesText}

Overall AI visibility score: ${overallScore}/100`,
        },
      ],
      max_tokens: 1400,
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
    improvements = parsed.improvements ?? [];
  } catch (err) {
    console.error("[improve] OpenAI call failed:", err);
    return NextResponse.json(
      { error: "Failed to generate improvements — check your OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  console.log("\n========== IMPROVEMENTS ==========");
  console.log(JSON.stringify(improvements, null, 2));
  console.log("===================================\n");

  return NextResponse.json({ improvements });
}
