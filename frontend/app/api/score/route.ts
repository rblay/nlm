import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import type {
  BusinessProfile,
  DebugEntry,
  LLMScore,
  LLMProvider,
  ScoreResult,
} from "@/lib/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

// ─── 1.3 Category detection + problem dictionaries (from GEO spec) ───────────

type BusinessCategory = "fitness" | "restaurant" | "beauty" | "other";

function detectCategory(businessType: string): BusinessCategory {
  const t = businessType.toLowerCase();
  if (/gym|fitness|studio|yoga|pilates|crossfit|boxing|hiit|spin|personal.train|pt\b/.test(t))
    return "fitness";
  if (/restaurant|cafe|bistro|bar|pub|food|dining|kitchen|eatery|takeaway/.test(t))
    return "restaurant";
  if (/spa|beauty|salon|clinic|aesthetic|massage|nail|brow|lash|facial/.test(t))
    return "beauty";
  return "other";
}

// Curated high-intent problem/goal queries per category (GEO spec §6)
const PROBLEM_DICTS: Record<BusinessCategory, string[]> = {
  fitness: [
    "beginner weight loss",
    "strength training for beginners",
    "post-injury friendly training",
    "getting fit for a marathon",
    "low-impact workouts",
    "stress relief and mental health",
    "women-only classes",
    "short workouts near work",
    "training with a personal trainer",
    "back-friendly workouts",
  ],
  restaurant: [
    "vegan-friendly dinner",
    "gluten-free options",
    "quick pre-theatre meal",
    "romantic date night",
    "family-friendly dinner",
    "group booking for 8–12",
    "quiet place to have a conversation",
    "great brunch spot",
    "late-night food",
    "best value lunch",
  ],
  beauty: [
    "stress relief massage",
    "back and neck tension relief",
    "glow-up facial",
    "facial for sensitive skin",
    "couples spa day",
    "pre-wedding beauty prep",
    "long-lasting nail treatment",
    "relaxation with sauna or steam",
  ],
  other: [
    "best value option",
    "highly rated local service",
    "good for beginners",
    "flexible booking",
  ],
};

const CITY_WIDE_TERMS = [
  "london",
  "greater london",
  "central london",
  "east london",
  "west london",
  "north london",
  "south london",
] as const;

function extractDistrictHint(location: string): string | null {
  const parts = location
    .split(/[,/;|]/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const normalized = part.toLowerCase().replace(/\s+/g, " ").trim();
    if (
      CITY_WIDE_TERMS.includes(normalized as (typeof CITY_WIDE_TERMS)[number]) ||
      normalized === "uk" ||
      normalized === "united kingdom" ||
      normalized === "england"
    ) {
      continue;
    }
    if (/\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(normalized)) continue; // skip postcodes
    return part;
  }

  return null;
}

function isCityWideQuery(query: string): boolean {
  return /\b(?:greater\s+)?london\b/i.test(query) || /\b(?:east|west|north|south|central)\s+london\b/i.test(query);
}

function enforceDistrictLevelQueries(queries: string[], districtHint: string | null): string[] {
  return queries.map((query) => {
    if (!isCityWideQuery(query)) return query;

    let updated = query;
    if (districtHint) {
      updated = updated
        .replace(/\b(in|around|across|near)\s+(?:greater\s+)?london\b/gi, `$1 ${districtHint}`)
        .replace(/\b(in|around|across|near)\s+(?:east|west|north|south|central)\s+london\b/gi, `$1 ${districtHint}`)
        .replace(/\b(?:east|west|north|south|central)\s+london\b/gi, districtHint)
        .replace(/\b(?:greater\s+)?london\b/gi, districtHint);
    } else {
      updated = updated
        .replace(/\b(in|around|across|near)\s+(?:greater\s+)?london\b/gi, "")
        .replace(/\b(in|around|across|near)\s+(?:east|west|north|south|central)\s+london\b/gi, "")
        .replace(/\b(?:east|west|north|south|central)\s+london\b/gi, "")
        .replace(/\b(?:greater\s+)?london\b/gi, "");
    }

    return updated.replace(/\s{2,}/g, " ").trim();
  });
}

// ─── 1.3 Step 1: Generate intents spanning the 9 GEO intent buckets ──────────

async function generateIntents(profile: BusinessProfile): Promise<string[]> {
  const category = detectCategory(profile.type);
  const problems = PROBLEM_DICTS[category].slice(0, 6).join("; ");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert in consumer search behaviour for local London businesses.

Generate exactly 12 customer intents for the business described below. Cover all 9 intent buckets to ensure strong query diversity:
  1. Discovery (1 intent) — finding what's available in the area
  2. Fit / Persona (1 intent) — suitability for a specific type of person
  3. Constraints (1 intent) — a hard filter (price, hours, amenities) this business ACTUALLY satisfies
  4. Quality / Trust (1 intent) — reviews, reputation, expertise — phrased generically for the area
  5. Experience / Vibe (1 intent) — atmosphere, environment, crowding, energy
  6. Price / Value (1 intent) — costs, deals, free trials — only if relevant to this business
  7. Comparison (1 intent) — alternatives or comparisons in the area (e.g. "best options for X in [area]")
  8. Logistics / Process (1 intent) — booking, cancellation, walk-ins, contracts
  9. Problem-based (3 intents) — specific goals or use-cases this business can solve; pick the 3 most relevant from: ${problems}

IMPORTANT:
- NEVER mention the business name in any intent — intents are generic customer questions.
- Constraints, Price/Value, and Problem-based intents must be grounded in the business's actual description and services — do not invent features it doesn't have.

Each intent is a short phrase (3–7 words). Return exactly 12 strings.

Return a JSON object: { "intents": ["...", ...] } — exactly 12 strings.`,
      },
      {
        role: "user",
        content: `Business type: ${profile.type}
Description: ${profile.description}
Services: ${profile.services.join(", ")}`,
      },
    ],
    max_tokens: 500,
  });
  const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
  return Array.isArray(parsed.intents) ? parsed.intents : [];
}

// ─── 1.3 Step 2: Turn intents into location-aware discovery queries ───────────

async function generateQueries(
  profile: BusinessProfile,
  intents: string[]
): Promise<string[]> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You generate natural language queries that a potential customer would type into an AI assistant when searching for a local business — someone who does not yet know this specific business exists.

You are given a list of customer intents spanning different search motivations. Write one query per intent, reflecting that intent naturally.

Rules:
1. NEVER include the business name in any query. These are pure discovery queries.
2. Geographic scope MUST be district/borough/neighbourhood level at most (e.g. "Soho", "Hammersmith", "South Kensington", "Shoreditch").
3. NEVER use city-wide or region-wide phrasing like "London", "Greater London", "West London", "East London", "Central London", "North London", or "South London".
4. If the business has multiple locations, anchor each query to a specific district/borough/neighbourhood — do NOT use proximity phrasing like "near me" or "near [postcode]".
5. If the business appears to have a single location, keep it specific to that district/borough/neighbourhood (e.g. "personal trainers in [district]").
6. If you cannot infer a specific district/borough/neighbourhood, prefer location-neutral phrasing over city-wide phrasing.
7. For problem-based or persona intents, write goal-first queries (e.g. "best gym in [district] for beginner weight loss", "personal trainer in [district] for post-injury rehab").
8. Make queries sound natural — like real things people type into ChatGPT or Google.

Return a JSON object with a single key "queries" containing an array of exactly 12 strings, one per intent.`,
      },
      {
        role: "user",
        content: `Business type: ${profile.type}
Location / areas: ${profile.location}
Description: ${profile.description}
Services: ${profile.services.join(", ")}

Customer intents to turn into queries (one query each):
${intents.map((intent, i) => `${i + 1}. ${intent}`).join("\n")}`,
      },
    ],
    max_tokens: 700,
  });
  const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
  const queries = Array.isArray(parsed.queries) ? parsed.queries : [];
  const districtHint = extractDistrictHint(profile.location);
  return enforceDistrictLevelQueries(queries, districtHint);
}

// ─── 1.4: Query each LLM with web search and return raw response + latency ────

async function queryOpenAI(
  query: string
): Promise<{ response: string; latencyMs: number }> {
  const start = Date.now();
  // Use Responses API with web_search tool so results match real ChatGPT behaviour
  const res = await openai.responses.create({
    model: "gpt-4o-mini",
    tools: [{ type: "web_search" }],
    input: query,
  });
  return {
    response: res.output_text ?? "",
    latencyMs: Date.now() - start,
  };
}

async function queryAnthropic(
  query: string
): Promise<{ response: string; latencyMs: number }> {
  const start = Date.now();

  const callAnthropic = async () => {
    // web_search_20250305 is a server-side tool — Anthropic manages the search loop
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      tools: [{ name: "web_search", type: "web_search_20250305" }],
      messages: [{ role: "user", content: query }],
    });
    // Extract text blocks only (tool_use / tool_result blocks are intermediate steps)
    return message.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");
  };

  try {
    const text = await callAnthropic();
    return { response: text, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    // On 429, read retry-after header and wait before one retry
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      const headers = (err as { headers?: { get?: (k: string) => string | null } })?.headers;
      const retryAfterRaw = headers?.get?.("retry-after") ?? "30";
      const waitMs = Math.min(parseInt(retryAfterRaw, 10) * 1000, 60_000);
      console.warn(`[score] Anthropic 429 — waiting ${waitMs / 1000}s before retry`);
      await new Promise((r) => setTimeout(r, waitMs));
      const text = await callAnthropic();
      return { response: text, latencyMs: Date.now() - start };
    }
    throw err;
  }
}

async function queryGemini(
  query: string
): Promise<{ response: string; latencyMs: number }> {
  const start = Date.now();
  // gemini-2.5-flash — current generation, available on free-tier AI Studio keys
  const result = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: query,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  return {
    response: result.text ?? "",
    latencyMs: Date.now() - start,
  };
}

// ─── 1.5 Bucket-level hit analysis + plain-English summary ───────────────────

// Maps query index → one of 9 intent buckets (indices 8+ all collapse to "Goal-based")
const BUCKET_LABELS = [
  "Discovery",
  "Fit & Persona",
  "Constraints",
  "Quality & Trust",
  "Experience & Vibe",
  "Price & Value",
  "Comparison",
  "Logistics & Booking",
  "Goal-based searches",   // covers query indices 8, 9, 10 (the 3 problem-based intents)
] as const;

type BucketLabel = typeof BUCKET_LABELS[number];

interface BucketScore {
  bucket: BucketLabel;
  mentions: number;   // how many (query × LLM) pairs returned a mention
  total: number;      // max possible = LLMs × queries in this bucket
}

function computeBucketScores(
  queries: string[],
  debug: DebugEntry[]
): BucketScore[] {
  const data: { mentions: number; total: number }[] = BUCKET_LABELS.map(() => ({
    mentions: 0,
    total: 0,
  }));

  queries.forEach((query, qi) => {
    const bucketIdx = Math.min(qi, 8); // indices 8+ → bucket 8 (Goal-based)
    const forQuery = debug.filter((e) => e.query === query);
    data[bucketIdx].mentions += forQuery.filter((e) => e.mentioned).length;
    data[bucketIdx].total += forQuery.length; // typically 3 (one per LLM)
  });

  return BUCKET_LABELS.map((bucket, i) => ({
    bucket,
    mentions: data[i].mentions,
    total: data[i].total,
  }));
}

async function generateSummary(
  profile: BusinessProfile,
  bucketScores: BucketScore[]
): Promise<string> {
  // Build a plain-text breakdown for the LLM prompt
  const lines = bucketScores
    .filter((b) => b.total > 0)
    .map((b) => {
      const pct = Math.round((b.mentions / b.total) * 100);
      const tag = pct >= 67 ? "✓ strong" : pct >= 34 ? "~ partial" : "✗ weak";
      return `- ${b.bucket}: ${b.mentions}/${b.total} (${pct}%) ${tag}`;
    })
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You write concise, plain-English AI visibility summaries for small business owners.

Rules:
- Write 100–150 words, no more
- Open with one overall verdict sentence
- Name 1–2 areas they perform well (only if score is strong/partial)
- Name 1–2 specific gaps (weak or missing buckets) — describe what type of search they're invisible for, in plain terms the owner understands
- End with one practical nudge
- Use second person: "you" / "your business"
- Never say: "buckets", "LLM", "ChatGPT", "Claude", "Gemini", "AI models"
- Instead say: "AI assistants", "when someone searches for...", "AI recommendations"
- Translate technical bucket names into plain language:
    Discovery → when people are browsing what's available nearby
    Fit & Persona → when someone is looking for the right fit for their situation
    Constraints → when people filter by opening hours, price, or specific amenities
    Quality & Trust → when people ask about reviews or the best-rated options
    Experience & Vibe → when people ask about atmosphere or what it's like
    Price & Value → when people ask about cost, deals, or trials
    Comparison → when people compare options in the area
    Logistics & Booking → when people ask how to book or what the process is
    Goal-based searches → when someone has a specific goal (e.g. losing weight, recovering from injury)
- Be specific and useful — avoid generic filler like "there is room for improvement"`,
      },
      {
        role: "user",
        content: `Business: ${profile.name} — ${profile.type} in ${profile.location}

Visibility by search intent (mentions out of tests run; ✓ = strong, ~ = partial, ✗ = weak):
${lines}

Write the summary now.`,
      },
    ],
    max_tokens: 250,
  });

  return completion.choices[0].message.content?.trim() ?? "";
}

// ─── Detection: does the response mention this business? ─────────────────────

// Generic business-type words that shouldn't count as distinctive name tokens
const NAME_STOP_WORDS = new Set([
  "the", "and", "of", "at", "in", "a", "an",
  "studio", "studios", "gym", "gyms", "fitness", "health", "club", "clubs",
  "pt", "personal", "training", "trainer", "trainers",
  "restaurant", "restaurants", "cafe", "bar", "pub", "kitchen", "bistro",
  "salon", "spa", "clinic", "centre", "center", "london", "ltd", "llc", "co",
]);

// Common suffixes to strip from business names to find a shorter alias
const NAME_SUFFIXES = [
  " personal training studio", " personal training", " pt studio",
  " fitness studio", " fitness centre", " fitness center", " fitness club",
  " gym", " studio", " pt", " spa", " salon", " clinic",
  " restaurant", " cafe", " bar", " ltd", " llc",
];

function buildNameAliases(name: string): string[] {
  const base = name.toLowerCase().trim();
  const aliases: string[] = [base];

  // Try stripping known suffixes to get a shorter brand name (e.g. "Revival PT Studio" → "Revival")
  for (const suffix of NAME_SUFFIXES) {
    if (base.endsWith(suffix)) {
      const stripped = base.slice(0, -suffix.length).trim();
      if (stripped.length > 3) {
        aliases.push(stripped);
      }
      break;
    }
  }

  // Also try meaningful multi-word tokens (filter stop words, keep words >3 chars)
  const tokens = base
    .split(/[\s\-&]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 3 && !NAME_STOP_WORDS.has(t));

  if (tokens.length >= 2) {
    // Add consecutive two-token phrases (e.g. "revival training")
    for (let i = 0; i < tokens.length - 1; i++) {
      aliases.push(tokens[i] + " " + tokens[i + 1]);
    }
  } else if (tokens.length === 1 && tokens[0].length > 4) {
    // Single distinctive token (e.g. "revival", "gymbox") — safe if >4 chars
    aliases.push(tokens[0]);
  }

  // Deduplicate
  return [...new Set(aliases)];
}

function mentionsBusiness(
  response: string,
  profile: BusinessProfile,
  url: string
): boolean {
  const text = response.toLowerCase();

  // 1. Domain match (strip www. and TLD for partial match too)
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (hostname.length > 3 && text.includes(hostname)) return true;
    // Also check just the domain stem (e.g. "revivalptstudio" from "revivalptstudio.co.uk")
    const stem = hostname.split(".")[0];
    if (stem.length > 5 && text.includes(stem)) return true;
  } catch {
    // ignore malformed URL
  }

  // 2. Name alias matching
  const aliases = buildNameAliases(profile.name);
  return aliases.some((alias) => text.includes(alias));
}

// ─── API route ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, profile, queryCount = 12 } = body as { url: string; profile: BusinessProfile; queryCount?: number };

  if (!url || !profile) {
    return NextResponse.json(
      { error: "url and profile are required" },
      { status: 400 }
    );
  }

  // 1.3 Step 1 — identify common customer intents for this business type
  let intents: string[];
  try {
    intents = await generateIntents(profile);
  } catch (err) {
    console.error("[score] Intent generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate intents — check your OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  console.log(`\n[score] Intents for "${profile.name}" (${profile.type}):`);
  intents.forEach((intent, i) => console.log(`  ${i + 1}. ${intent}`));

  // 1.3 Step 2 — generate location-aware queries grounded in those intents
  let queries: string[];
  try {
    queries = await generateQueries(profile, intents);
  } catch (err) {
    console.error("[score] Query generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate queries — check your OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  if (queries.length === 0) {
    return NextResponse.json(
      { error: "No queries generated" },
      { status: 500 }
    );
  }

  console.log(`\n[score] Generated ${queries.length} queries for "${profile.name}":`);
  queries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));

  // Slice to queryCount — generate all intents/queries but only send top N to LLMs
  const queriesToRun = queries.slice(0, Math.min(queryCount, queries.length));
  console.log(`\n[score] Running ${queriesToRun.length}/${queries.length} queries against LLMs (queryCount=${queryCount})`);

  // 1.4 — query all 3 LLMs for every query
  // All three providers start simultaneously.
  // OpenAI and Gemini run all queries fully in parallel.
  // Anthropic is batched in groups of 3 with a 2s gap to stay under its
  // 50k input-tokens-per-minute and concurrent-connection rate limits,
  // but its batched loop runs concurrently with OpenAI + Gemini (not after).
  const allDebugEntries: DebugEntry[] = [];

  const ANTHROPIC_BATCH = 3;
  type QueryResult = PromiseSettledResult<{ response: string; latencyMs: number }>;
  const anthropicResults = new Map<string, QueryResult>();

  // Kick off Anthropic batches immediately (non-blocking — runs in parallel below)
  const anthropicPromise = (async () => {
    for (let i = 0; i < queriesToRun.length; i += ANTHROPIC_BATCH) {
      const batch = queriesToRun.slice(i, i + ANTHROPIC_BATCH);
      const settled = await Promise.allSettled(batch.map(queryAnthropic));
      batch.forEach((q, idx) => anthropicResults.set(q, settled[idx]));
      if (i + ANTHROPIC_BATCH < queriesToRun.length) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  })();

  // Kick off OpenAI + Gemini simultaneously (all queries in parallel)
  const openaiGeminiPromise = Promise.all(
    queriesToRun.map(async (query) => {
      const [openaiResult, geminiResult] = await Promise.allSettled([
        queryOpenAI(query),
        queryGemini(query),
      ]);
      return { query, openaiResult, geminiResult };
    })
  );

  // Wait for all three providers to finish
  const [openaiGeminiResults] = await Promise.all([openaiGeminiPromise, anthropicPromise]);

  // Collate results
  for (const { query, openaiResult, geminiResult } of openaiGeminiResults) {
    const anthropicResult = anthropicResults.get(query)!;

    const results: { llm: LLMProvider; settled: typeof openaiResult }[] = [
      { llm: "openai", settled: openaiResult },
      { llm: "anthropic", settled: anthropicResult },
      { llm: "gemini", settled: geminiResult },
    ];

    for (const { llm, settled } of results) {
      if (settled.status === "fulfilled") {
        const { response, latencyMs } = settled.value;
        allDebugEntries.push({
          query,
          llm,
          response,
          mentioned: mentionsBusiness(response, profile, url),
          latencyMs,
        });
      } else {
        console.error(`[score] ${llm} failed for query "${query}":`, settled.reason);
        allDebugEntries.push({
          query,
          llm,
          response: "",
          mentioned: false,
          latencyMs: 0,
        });
      }
    }
  }

  // 1.4 — compute per-LLM scores
  const providers: LLMProvider[] = ["openai", "anthropic", "gemini"];
  const perLLM: LLMScore[] = providers.map((llm) => {
    const entries = allDebugEntries.filter((e) => e.llm === llm);
    const mentions = entries.filter((e) => e.mentioned).length;
    return {
      llm,
      score:
        entries.length > 0
          ? Math.round((mentions / entries.length) * 100)
          : 0,
      mentions,
      totalQueries: entries.length,
    };
  });

  const overallScore = Math.round(
    perLLM.reduce((sum, s) => sum + s.score, 0) / perLLM.length
  );

  // 1.5 — bucket analysis + plain-English summary
  const bucketScores = computeBucketScores(queries, allDebugEntries);

  let summary = "";
  try {
    summary = await generateSummary(profile, bucketScores);
  } catch (err) {
    console.error("[score] Summary generation failed:", err);
    // Non-fatal — we still return the score without a summary
  }

  const scoreResult: ScoreResult = {
    overallScore,
    perLLM,
    intents,
    queries,
    debug: allDebugEntries,
    summary,
  };

  console.log("\n========== SCORE RESULT ==========");
  console.log(`Overall: ${overallScore}/100`);
  perLLM.forEach((s) =>
    console.log(`  ${s.llm}: ${s.score}/100 (${s.mentions}/${s.totalQueries} mentions)`)
  );
  console.log("===================================\n");

  return NextResponse.json(scoreResult);
}
