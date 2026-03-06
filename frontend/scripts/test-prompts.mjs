/**
 * test-prompts.mjs
 *
 * Dry-run the intent + query generation pipeline.
 * No LLM scoring — just prints the intents and queries that would be sent.
 *
 * Usage:  node scripts/test-prompts.mjs
 */

import OpenAI from "openai";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env.local manually ──────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Replicated helpers (kept in sync with route.ts) ───────────────────────────

const NAME_STOP_WORDS = new Set([
  "the","and","of","at","in","a","an",
  "studio","studios","gym","gyms","fitness","health","club","clubs",
  "pt","personal","training","trainer","trainers",
  "restaurant","restaurants","cafe","bar","pub","kitchen","bistro",
  "salon","spa","clinic","centre","center","london","ltd","llc","co",
  // Beverage & food category words
  "coffee","roaster","roasters","roastery","bakery",
  // Wellness & venue category words
  "sauna","saunas","wellness","rooftop",
]);

const NAME_SUFFIXES = [
  " personal training studio"," personal training"," pt studio",
  " fitness studio"," fitness centre"," fitness center"," fitness club",
  " gym"," studio"," pt"," spa"," salon"," clinic",
  " restaurant"," cafe"," bar"," ltd"," llc",
];

function buildNameAliases(name) {
  const base = name.toLowerCase().trim();
  const aliases = [base];

  for (const suffix of NAME_SUFFIXES) {
    if (base.endsWith(suffix)) {
      const stripped = base.slice(0, -suffix.length).trim();
      if (stripped.length > 3) aliases.push(stripped);
      break;
    }
  }

  const tokens = base
    .split(/[\s\-&]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 3 && !NAME_STOP_WORDS.has(t));

  if (tokens.length >= 2) {
    for (let i = 0; i < tokens.length - 1; i++) {
      aliases.push(tokens[i] + " " + tokens[i + 1]);
    }
    for (const token of tokens) {
      if (token.length > 4) aliases.push(token);
    }
  } else if (tokens.length === 1 && tokens[0].length > 4) {
    aliases.push(tokens[0]);
  }

  return [...new Set(aliases)];
}

const CITY_WIDE_TERMS = new Set([
  "london","greater london","central london","east london",
  "west london","north london","south london",
]);
const COUNTRY_REGION_TERMS = new Set([
  "uk","united kingdom","england","scotland","wales",
  "usa","united states","us","america","canada","australia",
]);

function extractLocationParts(location) {
  function isMeaningful(p) {
    const norm = p.toLowerCase().replace(/\s+/g, " ").trim();
    if (CITY_WIDE_TERMS.has(norm)) return false;
    if (COUNTRY_REGION_TERMS.has(norm)) return false;
    if (/\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(norm)) return false; // UK postcodes
    if (/^\d{5}(-\d{4})?$/.test(norm)) return false; // US ZIP codes
    if (/^[a-z]{2}$/i.test(norm)) return false; // 2-letter codes
    return true;
  }

  const fragments = location.split("/").map((f) => f.trim()).filter(Boolean);
  const districts = [];
  let city = null;

  if (fragments.length > 1) {
    // Multi-venue: "/" separates co-equal locations
    for (const fragment of fragments) {
      const parts = fragment.split(",").map((p) => p.trim()).filter(isMeaningful);
      if (parts[0]) districts.push(parts[0]);
      if (!city && parts[1]) city = parts[1];
    }
  } else {
    // Single venue: "," separates hierarchy
    const parts = location.split(",").map((p) => p.trim()).filter(isMeaningful);
    if (parts[0]) districts.push(parts[0]);
    city = parts[1] ?? null;
  }

  return { districts, city };
}

function isCityWideQuery(query) {
  return /\b(?:greater\s+)?london\b/i.test(query) ||
    /\b(?:east|west|north|south|central)\s+london\b/i.test(query);
}

function enforceDistrictLevelQueries(queries, districts, city = null) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cityRegex = city && city.length > 3
    ? new RegExp(`\\b(in|around|across|near)\\s+${esc(city)}\\b`, "gi") : null;
  const cityStandaloneRegex = city && city.length > 3
    ? new RegExp(`\\b${esc(city)}\\b`, "gi") : null;

  const queriesPerBlock = districts.length > 1
    ? Math.ceil(queries.length / districts.length)
    : queries.length;

  return queries.map((query, i) => {
    const blockIdx = Math.min(Math.floor(i / queriesPerBlock), districts.length - 1);
    const targetDistrict = districts[blockIdx] ?? null;
    let updated = query;

    // 1. London-wide terms → target district
    if (isCityWideQuery(query)) {
      if (targetDistrict) {
        updated = updated
          .replace(/\b(in|around|across|near)\s+(?:greater\s+)?london\b/gi, `$1 ${targetDistrict}`)
          .replace(/\b(in|around|across|near)\s+(?:east|west|north|south|central)\s+london\b/gi, `$1 ${targetDistrict}`)
          .replace(/\b(?:east|west|north|south|central)\s+london\b/gi, targetDistrict)
          .replace(/\b(?:greater\s+)?london\b/gi, targetDistrict);
      } else {
        updated = updated
          .replace(/\b(in|around|across|near)\s+(?:greater\s+)?london\b/gi, "")
          .replace(/\b(in|around|across|near)\s+(?:east|west|north|south|central)\s+london\b/gi, "")
          .replace(/\b(?:east|west|north|south|central)\s+london\b/gi, "")
          .replace(/\b(?:greater\s+)?london\b/gi, "");
      }
    }

    // 2. Sibling district names → target district (fixes wrong-venue queries)
    if (districts.length > 1 && targetDistrict) {
      for (const d of districts) {
        if (d === targetDistrict) continue;
        updated = updated
          .replace(new RegExp(`\\b(in|around|across|near)\\s+${esc(d)}\\b`, "gi"), `$1 ${targetDistrict}`)
          .replace(new RegExp(`\\b${esc(d)}\\b`, "gi"), targetDistrict);
      }
    }

    // 3. City name → target district
    if (cityRegex && cityStandaloneRegex) {
      if (targetDistrict) {
        updated = updated.replace(cityRegex, `$1 ${targetDistrict}`).replace(cityStandaloneRegex, targetDistrict);
      } else {
        updated = updated.replace(cityRegex, "").replace(cityStandaloneRegex, "");
      }
    }

    return updated.replace(/\s{2,}/g, " ").trim();
  });
}

const PROBLEM_DICTS = {
  fitness: ["beginner weight loss","strength training for beginners","post-injury friendly training","getting fit for a marathon","low-impact workouts","stress relief and mental health","women-only classes","short workouts near work","training with a personal trainer","back-friendly workouts"],
  restaurant: ["vegan-friendly dinner","gluten-free options","quick pre-theatre meal","romantic date night","family-friendly dinner","group booking for 8–12","quiet place to have a conversation","great brunch spot","late-night food","best value lunch"],
  beauty: ["stress relief massage","back and neck tension relief","glow-up facial","facial for sensitive skin","couples spa day","pre-wedding beauty prep","long-lasting nail treatment","relaxation with sauna or steam"],
  other: ["best value option","highly rated local service","good for beginners","flexible booking"],
};

function detectCategory(businessType) {
  // Normalise accents so "café" matches "cafe", etc.
  const t = businessType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/gym|fitness|studio|yoga|pilates|crossfit|boxing|hiit|spin|personal.train|pt\b/.test(t)) return "fitness";
  if (/restaurant|cafe|bistro|bar|pub|food|dining|kitchen|eatery|takeaway/.test(t)) return "restaurant";
  if (/spa|beauty|salon|clinic|aesthetic|massage|nail|brow|lash|facial/.test(t)) return "beauty";
  return "other";
}

async function generateIntents(profile) {
  const category = detectCategory(profile.type);
  const problems = PROBLEM_DICTS[category].slice(0, 6).join("; ");
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert in consumer search behaviour for local businesses.

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
        content: `Business type: ${profile.type}\nDescription: ${profile.description}\nServices: ${profile.services.join(", ")}`,
      },
    ],
    max_tokens: 500,
  });
  const parsed = JSON.parse(res.choices[0].message.content ?? "{}");
  return Array.isArray(parsed.intents) ? parsed.intents : [];
}

async function generateQueries(profile, intents) {
  const { districts, city } = extractLocationParts(profile.location);
  const primaryDistrict = districts[0] ?? null;
  const areaExample = primaryDistrict ?? profile.location.split(/[,/;|]/)[0].trim();

  const half = Math.ceil(intents.length / 2);
  const locationRule = districts.length > 1
    ? `The business has ${districts.length} locations. Write the first ${half} queries (intents 1–${half}) anchored to "${districts[0]}" and the remaining ${intents.length - half} queries (intents ${half + 1}–${intents.length}) anchored to "${districts[1]}". Each set must cover a variety of the intent types given.`
    : `The business has a single location. Anchor all queries to "${areaExample}".`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You generate natural language queries that a potential customer would type into an AI assistant when searching for a local business — someone who does not yet know this specific business exists.

You are given a list of customer intents spanning different search motivations. Write one query per intent, reflecting that intent naturally.

Rules:
1. NEVER include the business name in any query. These are pure discovery queries.
2. Geographic scope MUST be neighbourhood/district/borough level at most (e.g. "${areaExample}"). Never use just the city name or a broad region.
3. NEVER use city-wide or region-wide phrasing (e.g. the full city name alone, compass directions + city, "Greater [City]").
4. Do NOT use proximity phrasing like "near me" or "near [postcode]".
5. ${locationRule}
6. If you cannot infer a specific neighbourhood/district, prefer location-neutral phrasing over city-wide phrasing.
7. For problem-based or persona intents, write goal-first queries (e.g. "best gym in ${areaExample} for beginner weight loss").
8. Make queries sound natural — like real things people type into ChatGPT or Google.

Return a JSON object with a single key "queries" containing an array of exactly ${intents.length} strings, one per intent.`,
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
  const parsed = JSON.parse(res.choices[0].message.content ?? "{}");
  const queries = Array.isArray(parsed.queries) ? parsed.queries : [];
  return { queries: enforceDistrictLevelQueries(queries, districts, city), districts, city };
}

// ── Test cases ────────────────────────────────────────────────────────────────

const TEST_CASES = [
  {
    label: "Wogan Coffee — specialty coffee roaster & brew bar, Bristol",
    url: "https://wogancoffee.com",
    profile: {
      name: "Wogan Coffee",
      type: "specialty coffee roaster and café",
      location: "Stokes Croft, Bristol",
      description: "Third-generation family-owned specialty coffee roaster based in Bristol. Hand-roasts ethically sourced single-origin and blended coffees. Runs a brew bar, SCA barista training campus, wholesale, and subscription service.",
      services: [
        "coffee beans (single-origin & blends)", "coffee pods", "decaf", "loose-leaf tea",
        "coffee equipment & accessories", "gift bundles & vouchers", "subscription (10% off)",
        "wholesale & white-label", "bespoke custom blends", "SCA training & certification",
        "machine servicing", "brew bar experiences",
      ],
    },
  },
  {
    label: "Rooftop Saunas — private sauna & cold plunge, Brixton + Hackney London",
    url: "https://rooftopsaunas.com",
    profile: {
      name: "Rooftop Saunas",
      type: "wellness spa / sauna venue",
      location: "Brixton / Hackney, London",
      description: "Premium rooftop wellness venue with private saunas, cold plunge pools, cool-down rooms and waterfall features. Two London sites: Brixton (International House, SW9, north-facing city views) and Hackney (Netil Corner, E8, East London skyline views). Bookable by session for individuals or groups.",
      services: [
        "private sauna sessions", "cold plunge pools", "cool-down rooms",
        "waterfall features", "group bookings", "membership / portal access",
      ],
    },
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function runTest({ label, url, profile }) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`TEST: ${label}`);
  console.log("═".repeat(70));

  // Alias detection
  const aliases = buildNameAliases(profile.name);
  console.log(`\n📛 Name aliases for "${profile.name}":`);
  aliases.forEach((a) => console.log(`   • "${a}"`));

  // Location extraction
  const { districts: parsedDistricts, city: parsedCity } = extractLocationParts(profile.location);
  console.log(`\n📍 Location parsing for "${profile.location}":`);
  console.log(`   districts → [${parsedDistricts.map(d => `"${d}"`).join(", ")}]`);
  console.log(`   city      → ${parsedCity ? `"${parsedCity}"` : "null"}`);

  // Intents
  console.log(`\n⏳ Generating intents...`);
  const intents = await generateIntents(profile);
  console.log(`\n🎯 Intents (${intents.length}):`);
  intents.forEach((intent, i) => console.log(`   ${String(i + 1).padStart(2)}. ${intent}`));

  // Queries
  console.log(`\n⏳ Generating queries...`);
  const { queries, districts: qDistricts, city: detectedCity } = await generateQueries(profile, intents);
  const districtLabel = qDistricts.length > 1
    ? `districts: [${qDistricts.map(d => `"${d}"`).join(", ")}]`
    : `district: "${qDistricts[0]}"`;
  console.log(`\n🔍 Queries that would be sent to LLMs (${districtLabel}, city: ${detectedCity ? `"${detectedCity}"` : "null"}):`);

  // For multi-location, show the block boundary
  const queriesPerBlock = qDistricts.length > 1 ? Math.ceil(queries.length / qDistricts.length) : queries.length;
  queries.forEach((q, i) => {
    const blockLabel = qDistricts.length > 1 ? ` [${qDistricts[Math.min(Math.floor(i / queriesPerBlock), qDistricts.length - 1)]}]` : "";
    console.log(`   ${String(i + 1).padStart(2)}.${blockLabel} ${q}`);
  });

  // Flag any query that still contains a broad city name
  const cityName = (detectedCity ?? "").toLowerCase();
  const broadHits = queries.filter((q) => cityName && q.toLowerCase().includes(cityName));
  if (broadHits.length) {
    console.log(`\n⚠️  Queries still containing city-level term "${detectedCity}":`);
    broadHits.forEach((q) => console.log(`   • ${q}`));
  } else {
    console.log(`\n✅ No city-wide terms found in queries.`);
  }
}

for (const tc of TEST_CASES) {
  await runTest(tc);
}

console.log(`\n${"═".repeat(70)}\nDone.\n`);
