import OpenAI from "openai";
import type { BusinessProfile, DebugEntry } from "@/lib/types";
import { getSupabaseClient } from "./client";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── research_businesses + research_signals ───────────────────────────────────

function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    let path = parsed.pathname.replace(/\/$/, "").toLowerCase();
    return `${parsed.protocol}//${host}${path}`;
  } catch {
    return url.toLowerCase();
  }
}

export async function upsertBusiness(
  url: string,
  profile: BusinessProfile,
  source: "pipeline" | "manual" | "seeded" = "pipeline"
): Promise<string | null> {
  const db = getSupabaseClient();
  if (!db) return null;
  try {
    const canonicalUrl = normaliseUrl(url);
    const { data, error } = await db
      .from("research_businesses")
      .upsert(
        {
          name: profile.name,
          url,
          canonical_url: canonicalUrl,
          business_type: profile.type,
          location: profile.location,
          description: profile.description,
          services: profile.services,
          source,
          last_analyzed_at: new Date().toISOString(),
        },
        { onConflict: "canonical_url" }
      )
      .select("id")
      .single();
    if (error || !data) {
      console.warn("[research] upsertBusiness error:", error);
      return null;
    }
    return data.id as string;
  } catch (err) {
    console.warn("[research] upsertBusiness exception:", err);
    return null;
  }
}

export async function insertSignals(
  businessId: string,
  profile: BusinessProfile,
  scrapeSource: "pipeline" | "script" | "manual" = "pipeline"
): Promise<void> {
  const db = getSupabaseClient();
  if (!db) return;
  try {
    const s = profile.signals;
    const blogPostCount = s.blogPostDates?.length ?? null;
    const latestBlogDate =
      s.blogPostDates && s.blogPostDates.length > 0 ? s.blogPostDates[0] : null;
    const faqQuestionCount = s.faqQuestions?.length ?? null;

    await db.from("research_signals").insert({
      business_id: businessId,
      has_schema: s.hasSchema,
      has_blog: s.hasBlog,
      has_faq: s.hasFAQ,
      has_meta_description: s.hasMetaDescription,
      has_maps_embed: s.hasMapsEmbed,
      has_google_business_profile: s.hasGoogleBusinessProfile,
      gbp_has_hours: s.gbpHasHours,
      gbp_photo_count: s.gbpPhotoCount,
      review_count: s.reviewCount,
      review_rating: s.reviewRating,
      social_link_count: s.socialLinks.length,
      social_links: s.socialLinks,
      title_tag: s.titleTag,
      blog_post_count: blogPostCount,
      latest_blog_post_date: latestBlogDate,
      faq_question_count: faqQuestionCount,
      scrape_source: scrapeSource,
    });
  } catch (err) {
    console.warn("[research] insertSignals error:", err);
  }
}

// ─── research_queries + research_mentions ─────────────────────────────────────

// Intent bucket labels, indexed by query position (same as score/route.ts)
const BUCKET_LABELS = [
  "Discovery",
  "Fit & Persona",
  "Constraints",
  "Quality & Trust",
  "Experience & Vibe",
  "Price & Value",
  "Comparison",
  "Logistics & Booking",
  "Goal-based searches",
];

function bucketForIndex(i: number): string {
  return BUCKET_LABELS[Math.min(i, BUCKET_LABELS.length - 1)];
}

export async function insertQueryResults(
  profile: BusinessProfile,
  queries: string[],
  debugEntries: DebugEntry[],
  scoreCacheId: string | null
): Promise<Map<string, string>> {
  // Returns a map of (query + llm) → research_query id for use in mention insertion
  const db = getSupabaseClient();
  const idMap = new Map<string, string>();
  if (!db) return idMap;

  try {
    const rows = debugEntries.map((entry) => {
      const queryIdx = queries.indexOf(entry.query);
      return {
        query_text: entry.query,
        query_type: "generated" as const,
        business_type: profile.type,
        location: profile.location,
        intent_bucket: queryIdx >= 0 ? bucketForIndex(queryIdx) : null,
        llm: entry.llm,
        response_text: entry.response,
        latency_ms: entry.latencyMs,
        source_score_id: scoreCacheId ?? null,
      };
    });

    if (rows.length === 0) return idMap;

    const { data, error } = await db
      .from("research_queries")
      .insert(rows)
      .select("id,query_text,llm");

    if (error || !data) {
      console.warn("[research] insertQueryResults error:", error);
      return idMap;
    }

    for (const row of data) {
      idMap.set(`${row.query_text}__${row.llm}`, row.id);
    }
  } catch (err) {
    console.warn("[research] insertQueryResults exception:", err);
  }
  return idMap;
}

export async function extractAndStoreMentions(
  debugEntries: DebugEntry[],
  queryIdMap: Map<string, string>
): Promise<void> {
  const db = getSupabaseClient();
  if (!db) return;

  // Group entries by LLM response text to batch the extraction call
  const nonEmptyEntries = debugEntries.filter((e) => e.response && e.response.length > 20);
  if (nonEmptyEntries.length === 0) return;

  try {
    // Single batched GPT-4o-mini call to extract all mentioned business names
    const batchText = nonEmptyEntries
      .map((e, i) => `[${i}] ${e.response.slice(0, 400)}`)
      .join("\n---\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You extract business names from text snippets.
Given numbered text snippets, return a JSON object where each key is the snippet index (as a string) and the value is an array of business names mentioned in that snippet.
Only include specific business names (gyms, restaurants, cafes, shops, studios, etc.). Exclude generic category descriptions.
If no businesses are mentioned in a snippet, use an empty array.
Example: { "0": ["Equinox", "Barry's Bootcamp"], "1": [], "2": ["F45 Training"] }`,
        },
        { role: "user", content: batchText },
      ],
      max_tokens: 800,
    });

    const parsed: Record<string, string[]> = JSON.parse(
      completion.choices[0].message.content ?? "{}"
    );

    const mentionRows: {
      query_id: string;
      business_name: string;
      match_confidence: string;
      extracted_by: string;
    }[] = [];

    for (let i = 0; i < nonEmptyEntries.length; i++) {
      const entry = nonEmptyEntries[i];
      const queryId = queryIdMap.get(`${entry.query}__${entry.llm}`);
      if (!queryId) continue;

      const names: string[] = parsed[String(i)] ?? [];
      for (const name of names) {
        if (name && name.trim()) {
          mentionRows.push({
            query_id: queryId,
            business_name: name.trim(),
            match_confidence: "fuzzy",
            extracted_by: "llm",
          });
        }
      }
    }

    if (mentionRows.length > 0) {
      await db.from("research_mentions").insert(mentionRows);
    }
  } catch (err) {
    console.warn("[research] extractAndStoreMentions error:", err);
  }
}
