import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import type {
  BusinessProfile,
  DebugEntry,
  LLMScore,
  LLMProvider,
  ScoreResult,
} from "@/lib/types";
import {
  computeScoreCacheKey,
  getCachedScore,
  setCachedScore,
} from "@/lib/db/cache";
import { insertQueryResults, extractAndStoreMentions } from "@/lib/db/research";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY ?? "",
  baseURL: "https://api.perplexity.ai",
});
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

// ─── Business category detection ─────────────────────────────────────────────

type BusinessCategory = "fitness" | "restaurant" | "beauty" | "retail" | "professional" | "other";

function detectCategory(businessType: string): BusinessCategory {
  const t = businessType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/gym|fitness|studio|yoga|pilates|crossfit|boxing|hiit|spin|personal.train|pt\b/.test(t))
    return "fitness";
  if (/restaurant|cafe|bistro|bar|pub|food|dining|kitchen|eatery|takeaway|seafood|pupusa|bakery|baker|bagel|patisserie|deli|sandwich|brunch|coffee.shop|juice.bar|pizz|sushi|ramen|burger|taco|burrito|noodle|dumpling|gelato|ice.cream|dessert|chocolate|confection/.test(t))
    return "restaurant";
  if (/spa|beauty|salon|clinic|aesthetic|massage|nail|brow|lash|facial/.test(t))
    return "beauty";
  if (/shop|store|boutique|retail|fashion|clothing|jewel|florist/.test(t))
    return "retail";
  if (/estate.agent|property|financial|advisor|accountant|solicitor|lawyer|mortgage|insurance/.test(t))
    return "professional";
  return "other";
}

// ─── Intent suggestion dictionaries ──────────────────────────────────────────
//
// Two dictionaries per category:
//   PROBLEM_DICTS    — specific goals or needs this type of business solves
//   LIFE_MOMENT_DICTS — life circumstances that trigger a search for this business
//
// Both are passed to the LLM as inspiration only — it must ground the actual
// intents in the specific business's description and services.

const PROBLEM_DICTS: Record<BusinessCategory, string[]> = {
  fitness: [
    "losing weight and getting fitter",
    "building strength from scratch",
    "recovering fitness after injury",
    "training for a specific sport or event",
    "low-impact workouts for joint problems",
    "improving mental health through exercise",
    "getting a personal trainer",
    "women-only or specialist classes",
  ],
  restaurant: [
    "finding gluten-free or allergy-friendly food",
    "eating vegan or plant-based",
    "a quick meal or snack before an event",
    "a quiet spot for a proper conversation",
    "the best local brunch or breakfast",
    "late-night dining options",
    "group bookings for a celebration",
    "best value lunch in the area",
    "freshly baked bread or pastries nearby",
    "nut-free or allergen-safe baked goods",
    "artisan or sourdough bread",
    "specialty coffee and a place to sit",
    "a healthy breakfast or morning routine spot",
  ],
  beauty: [
    "relieving stress and muscle tension",
    "improving skin for a big event",
    "long-lasting nail or lash treatments",
    "a full-body relaxation experience",
    "treating a specific skin condition",
    "a couples treatment or gift experience",
  ],
  retail: [
    "finding a unique or one-off gift",
    "sustainable or ethical shopping",
    "specialist items not found on the high street",
    "shopping locally instead of online",
    "finding the perfect outfit for an occasion",
  ],
  professional: [
    "getting expert advice for the first time",
    "understanding complex options clearly",
    "finding someone trustworthy and local",
    "navigating a major financial or legal decision",
    "support during a stressful life transition",
  ],
  other: [
    "finding the best local option",
    "getting started as a beginner",
    "finding a trustworthy provider",
    "solving a specific problem",
  ],
};

const LIFE_MOMENT_DICTS: Record<BusinessCategory, string[]> = {
  fitness: [
    "getting in shape before a wedding",
    "returning to fitness after having a baby",
    "starting over after a long break from exercise",
    "training for a marathon or triathlon",
    "getting fit before a holiday",
    "rebuilding fitness after an illness",
    "a mid-life commitment to health",
  ],
  restaurant: [
    "celebrating a birthday or anniversary",
    "a first date or romantic evening",
    "a business lunch or client dinner",
    "a graduation or promotion celebration",
    "a farewell dinner for someone leaving",
    "a family gathering or special occasion",
    "pre-theatre or pre-event dinner",
    "a lazy weekend brunch with friends",
    "picking up something special for a party or gathering",
    "a treat after a long week",
  ],
  beauty: [
    "preparing for a wedding day",
    "a hen party or group pamper day",
    "a birthday treat for yourself or a friend",
    "recovering after a particularly stressful period",
    "a mother's day or anniversary gift",
    "post-holiday skin recovery",
  ],
  retail: [
    "shopping for a wedding or special event outfit",
    "finding a meaningful gift for someone important",
    "treating yourself after a milestone",
    "refreshing a wardrobe for a new chapter",
  ],
  professional: [
    "buying a first home",
    "starting a new business",
    "planning for retirement",
    "going through a divorce or separation",
    "inheriting money or assets unexpectedly",
    "relocating to a new city",
  ],
  other: [
    "marking a major life change",
    "treating someone special",
    "starting something new",
    "a milestone worth celebrating",
  ],
};

// ─── Location anchor ──────────────────────────────────────────────────────────
//
// Resolves profile.location into clean, usable anchor strings.
// "/"  → co-equal venues (e.g. "Brixton / Hackney, London")
// ","  → hierarchy within one venue (e.g. "Clifton, Bristol")
//
// Output:
//   anchors  — one full "district, city" string per venue
//   primary  — the first anchor (used in single-venue logic)

interface LocationAnchor {
  anchors: string[];
  primary: string | null;
}

// These London terms are too broad to serve as a meaningful neighbourhood anchor.
const BROAD_DISTRICT_TERMS = new Set([
  "london", "greater london", "central london",
  "east london", "west london", "north london", "south london",
]);

// Country names recognised in location strings — extracted as a 3rd component.
// These are intentionally NOT stripped: they make queries globally unambiguous.
// e.g. "Clifton, Bristol, UK" → anchor "Clifton, Bristol, UK" (no Clifton NJ confusion)
const COUNTRY_RE = /^(UK|US|France|Germany|Australia|Canada|Spain|Italy|Ireland|Netherlands|Belgium|Portugal|Switzerland|Sweden|Norway|Denmark|Finland|New Zealand|South Africa|India|Japan|Singapore|Brazil|Mexico|UAE|Greece|Austria|Poland|Hungary|Thailand|Hong Kong)$/i;

function resolveLocationAnchor(location: string): LocationAnchor {
  if (!location.trim()) return { anchors: [], primary: null };

  // Strip only non-human-readable noise: postcodes and ISO alpha-2 codes (GB, FR, DE…).
  // Human-readable country names (UK, US, France…) are handled by COUNTRY_RE above.
  const isNoise = (p: string): boolean => {
    const n = p.trim();
    if (/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(n)) return true;  // UK postcodes: BS8 1AA
    if (/^\d{5}(-\d{4})?$/.test(n)) return true;                           // US ZIP codes: 10001
    if (/^[A-Z]{2,3}$/.test(n) && !COUNTRY_RE.test(n)) return true;        // ISO codes (GB, FR) not UK/US
    return false;
  };

  const isBroadDistrict = (p: string) =>
    BROAD_DISTRICT_TERMS.has(p.toLowerCase().replace(/\s+/g, " ").trim());

  const fragments = location.split("/").map(f => f.trim()).filter(Boolean);

  const parsed = fragments.map(fragment => {
    const parts = fragment.split(",").map(p => p.trim()).filter(p => p && !isNoise(p));
    let district: string | null = null;
    let city: string | null = null;
    let country: string | null = null;

    for (const part of parts) {
      // Country is identified first — prevents it being misassigned as district or city
      if (COUNTRY_RE.test(part)) {
        country = part;
        continue;
      }
      if (!district && !isBroadDistrict(part)) {
        district = part; // Most specific: neighbourhood, small town, borough
      } else if (!city) {
        city = part;     // City context: Bristol, London, San Francisco
      }
    }
    return { district, city, country };
  });

  // Share city and country across all venue fragments for multi-venue businesses.
  // e.g. "Brixton / Hackney, London, UK" → both get "London" and "UK"
  const sharedCity    = parsed.find(p => p.city)?.city       ?? null;
  const sharedCountry = parsed.find(p => p.country)?.country ?? null;

  const anchors = parsed
    .map(({ district, city, country }) => {
      const c  = city    ?? sharedCity;
      const co = country ?? sharedCountry;
      if (!district && !c) return null;
      let anchor: string;
      if (!district) anchor = c!;          // City-only fallback
      else if (!c)   anchor = district;    // Small town with no parent city (e.g. "Yeovil")
      else           anchor = `${district}, ${c}`;
      if (co) anchor = `${anchor}, ${co}`; // Append country: "Clifton, Bristol, UK"
      return anchor;
    })
    .filter((a): a is string => Boolean(a));

  const unique = [...new Set(anchors)];
  return { anchors: unique, primary: unique[0] ?? null };
}

// ─── Location injection ───────────────────────────────────────────────────────
//
// The LLM writes query seeds containing a [LOCATION] placeholder where the
// location naturally belongs in the sentence. This function replaces that
// placeholder with the real anchor string — we own location completely.
//
// For multi-venue businesses the queries are split into equal blocks,
// each block assigned to one venue anchor.
//
// Safety net: if the LLM omitted [LOCATION] entirely, we append "in [anchor]".

function injectLocations(seeds: string[], location: LocationAnchor): string[] {
  if (location.anchors.length === 0) {
    // No location available — strip any leftover placeholder and return
    return seeds.map(s => s.replace(/\s*\[LOCATION\]/gi, "").replace(/\s{2,}/g, " ").trim());
  }

  const { anchors } = location;
  const queriesPerBlock = anchors.length > 1
    ? Math.ceil(seeds.length / anchors.length)
    : seeds.length;

  return seeds.map((seed, i) => {
    const blockIdx = Math.min(Math.floor(i / queriesPerBlock), anchors.length - 1);
    const anchor = anchors[blockIdx];

    if (/\[LOCATION\]/i.test(seed)) {
      // Happy path: substitute the placeholder the LLM placed naturally
      return seed.replace(/\[LOCATION\]/gi, anchor).replace(/\s{2,}/g, " ").trim();
    }

    // Safety net: no placeholder — append location using a natural preposition
    const punct = seed.match(/[?!.]$/)?.[0] ?? "";
    const base = punct ? seed.slice(0, -1).trim() : seed.trim();
    // Vary the preposition based on query structure for naturalness
    const prep = /^where\b/i.test(base) ? "near" : /^how\b/i.test(base) ? "near" : "around";
    return `${base} ${prep} ${anchor}${punct}`;
  });
}

// ─── Relevance gate ───────────────────────────────────────────────────────────
//
// Filters out query seeds that are off-topic — things a customer would search
// when they want to cook, learn, or read, not when they want to visit a business.
// Patterns are intentionally specific: "how to cook" is caught, "how to book" is not.

const IRRELEVANT_PATTERNS = [
  /\brecipes?\b/i,
  /\bhow[\s-]?to\s+(cook|make|bake|brew|prepare|fry|grill)\b/i,
  /\bcooking\s+tips?\b/i,
  /\betiquette\b/i,
  /\bculinary\s+tips?\b/i,
  /\bwine\s+pairing\b/i,
  /\bfor\s+home\s+cooking\b/i,
  /\beat\s+at\s+home\b/i,
  /\bchef\s+tips?\b/i,
  /\bingredients?\s+for\b/i,
  /\bhow\s+to\s+season\b/i,
];

function filterRelevantQueries(queries: string[]): string[] {
  const kept: string[] = [];
  for (const q of queries) {
    if (IRRELEVANT_PATTERNS.some(p => p.test(q))) {
      console.log(`[score] Relevance gate removed: "${q}"`);
    } else {
      kept.push(q);
    }
  }
  return kept;
}

// ─── Step 1: Generate intents ─────────────────────────────────────────────────
//
// Produces 12 short intent phrases covering all 9 buckets.
// Intents describe what the customer wants — no location, no business name.
// The LLM uses PROBLEM_DICTS and LIFE_MOMENT_DICTS as inspiration but must
// ground its choices in the actual business description and services.

async function generateIntents(profile: BusinessProfile): Promise<string[]> {
  const category = detectCategory(profile.type);
  const problemSuggestions = PROBLEM_DICTS[category].slice(0, 5).join("; ");
  const momentSuggestions = LIFE_MOMENT_DICTS[category].slice(0, 4).join("; ");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert in consumer search behaviour for local businesses.

Generate exactly 12 customer intents for the business described. Each intent is a short phrase (4–8 words) describing what a potential customer wants — written from the customer's perspective, with no business name and no location.

Cover all 9 intent buckets, one intent per bucket except bucket 9 which gets 3:
  1. Discovery       — USE BROAD CATEGORY ONLY (e.g. "restaurant", "gym", "cafe") — the customer is browsing, not filtering by niche yet
  2. Fit / Persona   — suited to a specific type of person or group; use broad category terms here too
  3. Constraints     — a hard filter (hours, dietary, accessibility, price tier) this business ACTUALLY meets; niche can appear if relevant
  4. Quality / Trust — reviews, reputation, awards, expertise; niche can appear if it's a genuine differentiator
  5. Experience / Vibe — atmosphere, energy, setting, ambience; focus on the feeling, not the cuisine/specialism
  6. Price / Value   — cost, deals, membership, free trial; use broad category terms
  7. Comparison      — USE BROAD CATEGORY ONLY (e.g. "best restaurants in the area") — real customers compare all options, not just within a niche
  8. Life Moment     — a specific life circumstance that drives the search (e.g. birthday, wedding, new job, moving home). Use these as inspiration, grounded in what this business can genuinely deliver: ${momentSuggestions}
  9. Problem-based   — 3 intents for specific goals or needs this business solves. Use these as inspiration, grounded in its actual services: ${problemSuggestions}

Rules:
- NEVER use the business name
- NEVER use second-person language (no "your", "you", "do you")
- Constraints, Price/Value, and Problem-based intents must reflect what this business actually offers — do not invent
- Buckets 1 and 7 MUST use broad category language — a customer searching "best restaurants in the area" is just as relevant as one searching for a specific cuisine type
- Niche specifics (e.g. "Italian", "seafood", "CrossFit") can appear in buckets 3, 4, and 9 only when they genuinely describe what the customer is filtering for

Return JSON: { "intents": ["...", ...] } — exactly 12 strings.`,
      },
      {
        role: "user",
        content: `Business type: ${profile.type}
Location: ${profile.location || "unknown"}
Description: ${profile.description}
Services: ${profile.services.join(", ")}`,
      },
    ],
    max_tokens: 600,
  });

  const messages = completion.choices[0].message.content ?? "{}";
  console.log("\n────── INTENT GENERATION PROMPT ──────");
  console.log("SYSTEM:", completion.model);
  console.log("USER INPUT:");
  console.log(`  Business type: ${profile.type}`);
  console.log(`  Location: ${profile.location || "unknown"}`);
  console.log(`  Description: ${profile.description}`);
  console.log(`  Services: ${profile.services.join(", ")}`);
  console.log("RESPONSE:", messages);
  console.log("──────────────────────────────────────\n");

  const parsed = JSON.parse(messages);
  return Array.isArray(parsed.intents) ? parsed.intents : [];
}

// ─── Step 2: Generate query seeds ────────────────────────────────────────────
//
// Turns each intent into a natural discovery query a customer would type into
// an AI assistant. The LLM's only job is business-specific phrasing — it does
// NOT decide the location. Instead it writes [LOCATION] wherever the location
// naturally belongs in the sentence.
//
// injectLocations() then substitutes [LOCATION] with the real anchor string.
// This gives us natural word order ("best seafood in [LOCATION] for a date")
// without relying on the LLM to know or correctly use the location.

async function generateQuerySeeds(
  profile: BusinessProfile,
  intents: string[]
): Promise<string[]> {
  const location = resolveLocationAnchor(profile.location);

  const locationNote = location.primary
    ? `The location anchor is "${location.primary}". You do not need to know the actual location — just write [LOCATION] wherever the location naturally fits in each query sentence.`
    : `No specific location is known for this business. Do not include [LOCATION] or any geographic reference in the queries.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You write natural discovery queries — the kind of thing someone types into ChatGPT or Google when looking for a local business they don't yet know exists.

For each customer intent given, write one query. Follow these rules:

1. NEVER include the business name — these are pure discovery queries.
2. LOCATION: Write [LOCATION] wherever the location naturally fits, always preceded by a natural preposition. ${locationNote}
   Prefer broader prepositions — "near" and "around" feel more natural than "in" for most searches.
   Use variety: mix "near", "around", "close to", and occasionally "in" depending on what sounds most natural.
   Examples of good placement:
     "best seafood restaurant near [LOCATION] for a special occasion"
     "where to eat fresh lobster around [LOCATION]"
     "top-rated spa close to [LOCATION] for a couples day"
     "affordable personal trainer near [LOCATION] for weight loss"
     "good gluten-free food around [LOCATION]"
     "where to go for a birthday dinner near [LOCATION]"
3. Make each query sound like something a real person would type — natural, conversational.
4. Each query should be specific enough that an AI would name 2–3 businesses in response.
5. Do NOT use "near me", postcodes, or vague terms like "in the area".
6. Vary the category specificity across queries — roughly half should use the broad category (e.g. "restaurant", "gym", "cafe") because real customers often don't pre-filter by niche. The other half can reference the specific niche when it genuinely fits the intent (e.g. "seafood restaurant" for a quality/trust query). Do not force the niche into every query.

Return JSON: { "seeds": ["...", ...] } — exactly ${intents.length} strings.`,
      },
      {
        role: "user",
        content: `Business type: ${profile.type}
Description: ${profile.description}
Services: ${profile.services.join(", ")}

Customer intents (write one query seed per intent):
${intents.map((intent, i) => `${i + 1}. ${intent}`).join("\n")}`,
      },
    ],
    max_tokens: 700,
  });

  const seedsRaw = completion.choices[0].message.content ?? "{}";

  console.log("\n────── QUERY SEED GENERATION PROMPT ──────");
  console.log(`LOCATION ANCHOR: ${location.primary ?? "none"}`);
  console.log(`LOCATION NOTE: ${locationNote}`);
  console.log("USER INPUT:");
  console.log(`  Business type: ${profile.type}`);
  console.log(`  Description: ${profile.description}`);
  console.log(`  Services: ${profile.services.join(", ")}`);
  console.log("  Intents sent:");
  intents.forEach((intent, i) => console.log(`    ${i + 1}. ${intent}`));
  console.log("RAW SEEDS FROM LLM:", seedsRaw);

  const parsed = JSON.parse(seedsRaw);
  const seeds = Array.isArray(parsed.seeds) ? parsed.seeds : [];
  const injected = injectLocations(seeds, location);
  const queries = filterRelevantQueries(injected);

  console.log("FINAL QUERIES AFTER INJECTION + RELEVANCE GATE:");
  queries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
  console.log("───────────────────────────────────────────\n");

  return queries;
}

// ─── LLM querying ─────────────────────────────────────────────────────────────

async function queryOpenAI(
  query: string
): Promise<{ response: string; latencyMs: number; modelVersion: string }> {
  const start = Date.now();
  const model = "gpt-4o-mini";
  const res = await openai.responses.create({
    model,
    tools: [{ type: "web_search" }],
    input: query,
  });
  return { response: res.output_text ?? "", latencyMs: Date.now() - start, modelVersion: model };
}

async function queryPerplexity(
  query: string
): Promise<{ response: string; latencyMs: number; modelVersion: string }> {
  const start = Date.now();
  const model = "sonar";
  const completion = await perplexity.chat.completions.create({
    model,
    messages: [{ role: "user", content: query }],
  });
  return {
    response: completion.choices[0]?.message?.content ?? "",
    latencyMs: Date.now() - start,
    modelVersion: model,
  };
}

async function queryGemini(
  query: string
): Promise<{ response: string; latencyMs: number; modelVersion: string }> {
  const start = Date.now();
  const model = "gemini-2.5-flash";
  const result = await genai.models.generateContent({
    model,
    contents: query,
    config: { tools: [{ googleSearch: {} }] },
  });
  return { response: result.text ?? "", latencyMs: Date.now() - start, modelVersion: model };
}

// ─── Bucket scoring + plain-English summary ───────────────────────────────────
//
// 9 buckets map directly to the 9 intent categories above.
// Queries 0–7 map 1:1 to buckets 0–7.
// Queries 8, 9, 10 all collapse into bucket 8 (Problem-based).

const BUCKET_LABELS = [
  "Discovery",
  "Fit & Persona",
  "Constraints",
  "Quality & Trust",
  "Experience & Vibe",
  "Price & Value",
  "Comparison",
  "Life Moment",
  "Goal-based searches",
] as const;

type BucketLabel = typeof BUCKET_LABELS[number];

interface BucketScore {
  bucket: BucketLabel;
  mentions: number;
  total: number;
}

function computeBucketScores(queries: string[], debug: DebugEntry[]): BucketScore[] {
  const data: { mentions: number; total: number }[] = BUCKET_LABELS.map(() => ({
    mentions: 0,
    total: 0,
  }));

  queries.forEach((query, qi) => {
    const bucketIdx = Math.min(qi, 8);
    const forQuery = debug.filter((e) => e.query === query);
    data[bucketIdx].mentions += forQuery.filter((e) => e.mentioned).length;
    data[bucketIdx].total += forQuery.length;
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
- Name 1–2 specific gaps (weak or missing buckets) — describe the search type in plain terms the owner understands
- End with one practical nudge
- Use second person: "you" / "your business"
- Never say: "buckets", "LLM", "ChatGPT", "Claude", "Gemini", "AI models"
- Instead say: "AI assistants", "when someone searches for...", "AI recommendations"
- Translate bucket names into plain language:
    Discovery         → when people browse what's available nearby
    Fit & Persona     → when someone looks for the right fit for their situation
    Constraints       → when people filter by hours, dietary needs, or specific requirements
    Quality & Trust   → when people ask about reviews or the best-rated options
    Experience & Vibe → when people ask about atmosphere or what it feels like
    Price & Value     → when people ask about cost, deals, or trials
    Comparison        → when people compare options in the area
    Life Moment       → when someone is planning around a specific event or life change
    Goal-based        → when someone has a specific goal (e.g. losing weight, recovering from injury)
- Be specific and useful — avoid generic filler`,
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

// ─── Business mention detection ───────────────────────────────────────────────

const NAME_STOP_WORDS = new Set([
  "the", "and", "of", "at", "in", "a", "an",
  "studio", "studios", "gym", "gyms", "fitness", "health", "club", "clubs",
  "pt", "personal", "training", "trainer", "trainers",
  "restaurant", "restaurants", "cafe", "bar", "pub", "kitchen", "bistro",
  "salon", "spa", "clinic", "centre", "center", "london", "ltd", "llc", "co",
  "coffee", "roaster", "roasters", "roastery", "bakery",
  "sauna", "saunas", "wellness", "rooftop",
]);

const NAME_SUFFIXES = [
  " personal training studio", " personal training", " pt studio",
  " fitness studio", " fitness centre", " fitness center", " fitness club",
  " gym", " studio", " pt", " spa", " salon", " clinic",
  " restaurant", " cafe", " bar", " ltd", " llc",
];

function buildNameAliases(name: string): string[] {
  const base = name.toLowerCase().trim();
  const aliases: string[] = [base];

  // Only add a suffix-stripped version if the result is still a multi-word name.
  // e.g. "Modern Bread and Bagel Bakery" → "Modern Bread and Bagel" ✓
  //      "Revival PT Studio" → "Revival" ✗ (single generic word, too loose)
  for (const suffix of NAME_SUFFIXES) {
    if (base.endsWith(suffix)) {
      const stripped = base.slice(0, -suffix.length).trim();
      if (stripped.includes(" ") && stripped.length > 6) {
        aliases.push(stripped);
      }
      break;
    }
  }

  // No individual token or token-pair matching — generic words like "bread",
  // "bagel", "revival" would produce false positives on unrelated businesses.
  // Domain stem matching in mentionsBusiness() handles the URL case.

  return [...new Set(aliases)];
}

function mentionsBusiness(
  response: string,
  profile: BusinessProfile,
  url: string,
  extraNames: string[] = []
): boolean {
  const text = response.toLowerCase();

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (hostname.length > 3 && text.includes(hostname)) return true;
    const stem = hostname.split(".")[0];
    if (stem.length > 5 && text.includes(stem)) return true;
  } catch {
    // ignore malformed URL
  }

  // Profile name: use alias expansion (full name + suffix-stripped multi-word version)
  const profileAliases = buildNameAliases(profile.name);

  // User-supplied names: match exactly as entered — the user knows what they typed.
  // "Revival" → must find "revival"; "Modern Bread and Bagel" → must find that exact phrase.
  const userAliases = extraNames.map((n) => n.toLowerCase().trim()).filter(Boolean);

  const aliases = [...profileAliases, ...userAliases];
  return aliases.some((alias) => text.includes(alias));
}

// ─── API route ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, profile, queryCount = 12, businessNames, force_refresh } = body as {
    url: string;
    profile: BusinessProfile;
    queryCount?: number;
    businessNames?: string;
    force_refresh?: boolean;
  };

  const extraNames = businessNames
    ? businessNames.split(",").map((n) => n.trim()).filter(Boolean)
    : [];

  if (!url || !profile) {
    return NextResponse.json({ error: "url and profile are required" }, { status: 400 });
  }

  if (extraNames.length > 0) {
    console.log(`[score] User-supplied names for detection: ${extraNames.join(", ")}`);
  }

  // Cache check
  const cacheKey = computeScoreCacheKey(url, queryCount);
  if (!force_refresh) {
    const cached = await getCachedScore(cacheKey);
    if (cached) {
      console.log(`[score] Cache HIT for ${url} (queryCount=${queryCount})`);
      const { profileSnapshot: _snap, ...scoreResult } = cached;
      return NextResponse.json(scoreResult, { headers: { "X-Cache": "HIT" } });
    }
  }

  // Step 1 — generate intents
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

  // Step 2 — generate query seeds and inject location
  let queries: string[];
  try {
    queries = await generateQuerySeeds(profile, intents);
  } catch (err) {
    console.error("[score] Query generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate queries — check your OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  if (queries.length === 0) {
    return NextResponse.json({ error: "No queries generated" }, { status: 500 });
  }

  console.log(`\n[score] Generated ${queries.length} queries for "${profile.name}":`);
  queries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));

  const queriesToRun = queries.slice(0, Math.min(queryCount, queries.length));
  console.log(`\n[score] Running ${queriesToRun.length}/${queries.length} queries against LLMs`);

  // Step 3 — query all 3 LLMs in parallel
  const allDebugEntries: DebugEntry[] = [];

  await Promise.all(
    queriesToRun.map(async (query) => {
      const [openaiResult, perplexityResult, geminiResult] = await Promise.allSettled([
        queryOpenAI(query),
        queryPerplexity(query),
        queryGemini(query),
      ]);

      const results: { llm: LLMProvider; settled: typeof openaiResult }[] = [
        { llm: "openai",     settled: openaiResult },
        { llm: "perplexity", settled: perplexityResult },
        { llm: "gemini",     settled: geminiResult },
      ];

      for (const { llm, settled } of results) {
        if (settled.status === "fulfilled") {
          const { response, latencyMs, modelVersion } = settled.value;
          allDebugEntries.push({
            query,
            llm,
            modelVersion,
            response,
            mentioned: mentionsBusiness(response, profile, url, extraNames),
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
    })
  );

  // Step 4 — compute scores
  const providers: LLMProvider[] = ["openai", "perplexity", "gemini"];
  const perLLM: LLMScore[] = providers.map((llm) => {
    const entries = allDebugEntries.filter((e) => e.llm === llm);
    const mentions = entries.filter((e) => e.mentioned).length;
    return {
      llm,
      score: entries.length > 0 ? Math.round((mentions / entries.length) * 100) : 0,
      mentions,
      totalQueries: entries.length,
    };
  });

  const overallScore = Math.round(
    perLLM.reduce((sum, s) => sum + s.score, 0) / perLLM.length
  );

  // Step 5 — bucket analysis + summary
  const bucketScores = computeBucketScores(queries, allDebugEntries);

  let summary = "";
  try {
    summary = await generateSummary(profile, bucketScores);
  } catch (err) {
    console.error("[score] Summary generation failed:", err);
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

  // Persist to cache + research dataset
  try {
    const scoreCacheId = await setCachedScore(url, cacheKey, queryCount, scoreResult, profile);
    const queryIdMap = await insertQueryResults(profile, queriesToRun, allDebugEntries, scoreCacheId);
    await extractAndStoreMentions(allDebugEntries, queryIdMap);
  } catch (err) {
    console.warn("[score] DB persistence failed:", err);
  }

  return NextResponse.json(scoreResult);
}
