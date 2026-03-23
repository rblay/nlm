import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { BusinessProfile, ObservableSignals } from "@/lib/types";
import {
  computeAnalyseCacheKey,
  getCachedProfile,
  setCachedProfile,
} from "@/lib/db/cache";
import { upsertBusiness, insertSignals } from "@/lib/db/research";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function fetchSecondary(url: string, timeoutMs = 3000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LLMRankBot/1.0)" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractBlogPostDates(html: string): string[] {
  const dates: string[] = [];
  const today = new Date();

  // 1. <time datetime="2025-03-01"> — most reliable
  const timeMatches = html.matchAll(/<time[^>]+datetime=["']([^"']+)["']/gi);
  for (const match of timeMatches) {
    if (/^\d{4}-\d{2}-\d{2}/.test(match[1])) {
      dates.push(match[1].slice(0, 10));
    }
  }

  // 2. data-date / data-publish-date attributes
  const dataMatches = html.matchAll(/data-(?:date|publish-?date|post-date|created)=["'](\d{4}-\d{2}-\d{2})/gi);
  for (const match of dataMatches) {
    dates.push(match[1]);
  }

  // 3. Relative dates ("3 days ago", "2 weeks ago", "1 month ago")
  //    Common on Wix, Squarespace and similar platforms
  const relMatches = html.matchAll(/(\d+)\s+(day|week|month)s?\s+ago/gi);
  for (const match of relMatches) {
    const n = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const d = new Date(today);
    if (unit === "day")   d.setDate(d.getDate() - n);
    else if (unit === "week")  d.setDate(d.getDate() - n * 7);
    else if (unit === "month") d.setMonth(d.getMonth() - n);
    dates.push(d.toISOString().slice(0, 10));
  }

  return [...new Set(dates)].sort().reverse().slice(0, 10);
}

function extractFaqQuestions(html: string): string[] {
  const questions: string[] = [];

  // Try JSON-LD FAQPage schema first
  const ldMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of ldMatches) {
    try {
      const json = JSON.parse(match[1]);
      const entities =
        json["@type"] === "FAQPage" ? json.mainEntity :
        Array.isArray(json) ? json.find((j: { "@type": string }) => j["@type"] === "FAQPage")?.mainEntity :
        null;
      if (Array.isArray(entities)) {
        for (const item of entities) {
          if (item.name) questions.push(item.name);
        }
      }
    } catch { /* ignore */ }
  }
  if (questions.length > 0) return questions.slice(0, 10);

  // Fallback: scan <h3>/<dt> for question-like text
  const headingMatches = html.matchAll(/<(?:h3|dt)[^>]*>([^<]{10,200})<\/(?:h3|dt)>/gi);
  for (const match of headingMatches) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text.includes("?") || /^(what|how|when|where|why|can|do|is|are|will|should)/i.test(text)) {
      questions.push(text);
    }
  }
  return questions.slice(0, 10);
}

function extractSignals(html: string): ObservableSignals {
  const hasSchema = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
  const hasBlog = /href=["'][^"']*\/(blog|news)[/"']/i.test(html);
  const hasMapsEmbed = /maps\.google\.com|google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(html);

  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const hasMetaDescription = !!(metaDescMatch?.[1]?.trim());

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const titleTag = titleMatch?.[1]?.trim() ?? null;

  const socialPatterns: RegExp[] = [
    /https?:\/\/(www\.)?(facebook\.com|fb\.com)\/[^\s"'<>]+/gi,
    /https?:\/\/(www\.)?twitter\.com\/[^\s"'<>]+/gi,
    /https?:\/\/(www\.)?x\.com\/[^\s"'<>]+/gi,
    /https?:\/\/(www\.)?instagram\.com\/[^\s"'<>]+/gi,
    /https?:\/\/(www\.)?linkedin\.com\/[^\s"'<>]+/gi,
    /https?:\/\/(www\.)?tiktok\.com\/[^\s"'<>]+/gi,
  ];

  const socialLinks: string[] = [];
  for (const pattern of socialPatterns) {
    const matches = html.match(pattern);
    if (matches) socialLinks.push(matches[0]);
  }

  const hasFAQ =
    /href=["'][^"']*\/faq[/"']/i.test(html) ||
    /"@type"\s*:\s*"FAQPage"/i.test(html) ||
    /<details[\s>]/i.test(html);

  return {
    hasSchema,
    hasBlog,
    hasFAQ,
    hasMetaDescription,
    titleTag,
    socialLinks: [...new Set(socialLinks)],
    hasMapsEmbed,
    hasGoogleBusinessProfile: false, // enriched later via Places API
    gbpHasHours: false,
    gbpPhotoCount: null,
    reviewCount: null,
    reviewRating: null,
    blogPostDates: null, // enriched later via secondary fetch
    faqQuestions: null,  // enriched later via secondary fetch
  };
}

interface PlacesResult {
  hasGoogleBusinessProfile: boolean;
  gbpHasHours: boolean;
  gbpPhotoCount: number | null;
  reviewCount: number | null;
  reviewRating: number | null;
  location: string | null;   // "Neighbourhood, City" — from addressComponents
  country: string | null;    // e.g. "UK", "US", "France" — appended to location anchor
}

const PLACES_FALLBACK: PlacesResult = {
  hasGoogleBusinessProfile: false,
  gbpHasHours: false,
  gbpPhotoCount: null,
  reviewCount: null,
  reviewRating: null,
  location: null,
  country: null,
};

interface AddressComponent {
  longText: string;
  types: string[];
}

// Normalize verbose country names from Places API to short, query-friendly forms.
const COUNTRY_SHORT_NAMES: Record<string, string> = {
  "united kingdom": "UK",
  "united states": "US",
  "united states of america": "US",
};

function normalizeCountry(longText: string): string {
  return COUNTRY_SHORT_NAMES[longText.toLowerCase().trim()] ?? longText;
}

function locationFromComponents(components: AddressComponent[]): string | null {
  const get = (...types: string[]) =>
    components.find((c) => types.some((t) => c.types.includes(t)))?.longText ?? null;

  const neighbourhood = get("sublocality_level_1", "sublocality", "neighborhood");
  const city = get("locality", "postal_town", "administrative_area_level_2");

  if (neighbourhood && city) return `${neighbourhood}, ${city}`;
  if (city) return city;
  if (neighbourhood) return neighbourhood;
  return null;
}

async function lookupGooglePlace(name: string, location: string): Promise<PlacesResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return PLACES_FALLBACK;

  const query = [name, location].filter(Boolean).join(" ");
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.regularOpeningHours,places.photos,places.addressComponents",
      },
      body: JSON.stringify({ textQuery: query, pageSize: 1 }),
    });

    if (!res.ok) {
      console.warn(`[analyze] Places API error: ${res.status}`);
      return PLACES_FALLBACK;
    }

    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return PLACES_FALLBACK;

    const derivedLocation = Array.isArray(place.addressComponents)
      ? locationFromComponents(place.addressComponents)
      : null;

    const countryComponent = Array.isArray(place.addressComponents)
      ? place.addressComponents.find((c: AddressComponent) => c.types.includes("country"))
      : null;
    const derivedCountry = countryComponent ? normalizeCountry(countryComponent.longText) : null;

    return {
      hasGoogleBusinessProfile: true,
      gbpHasHours: !!place.regularOpeningHours,
      gbpPhotoCount: Array.isArray(place.photos) ? place.photos.length : null,
      reviewCount: place.userRatingCount ?? null,
      reviewRating: place.rating ?? null,
      location: derivedLocation,
      country: derivedCountry,
    };
  } catch (err) {
    console.warn("[analyze] Places API lookup failed:", err);
    return PLACES_FALLBACK;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, force_refresh } = body as { url: string; force_refresh?: boolean };

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Check cache (skip if ?force_refresh=true)
  const cacheKey = computeAnalyseCacheKey(url);
  if (!force_refresh) {
    const cached = await getCachedProfile(cacheKey);
    if (cached) {
      console.log(`[analyze] Cache HIT for ${url}`);
      return NextResponse.json({ profile: cached }, { headers: { "X-Cache": "HIT" } });
    }
  }

  // Fetch homepage + secondary pages in parallel
  let html: string;
  let blogHtml: string | null = null;
  let faqHtml: string | null = null;
  let locationHtml: string | null = null;
  try {
    const baseOrigin = new URL(url).origin;
    const [homepageRes, rawBlog, rawNews, rawFaq,
      rawContact, rawAbout, rawOurStory, rawFindUs] = await Promise.all([
      fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; LLMRankBot/1.0)" } }),
      fetchSecondary(`${baseOrigin}/blog`),
      fetchSecondary(`${baseOrigin}/news`),
      fetchSecondary(`${baseOrigin}/faq`),
      fetchSecondary(`${baseOrigin}/contact`),
      fetchSecondary(`${baseOrigin}/about`),
      fetchSecondary(`${baseOrigin}/our-story`),
      fetchSecondary(`${baseOrigin}/find-us`),
    ]);
    html = await homepageRes.text();
    blogHtml = rawBlog ?? rawNews ?? null;
    faqHtml = rawFaq;
    // Use the first location-bearing page we find
    locationHtml = rawContact ?? rawAbout ?? rawOurStory ?? rawFindUs ?? null;
  } catch (err) {
    console.error(`[analyze] Failed to fetch ${url}:`, err);
    return NextResponse.json({ error: "Failed to fetch URL" }, { status: 422 });
  }

  // Extract observable signals from raw HTML before stripping tags
  const signals = extractSignals(html);

  // Enrich with secondary page data
  if (blogHtml) {
    const dates = extractBlogPostDates(blogHtml);
    if (dates.length > 0) signals.blogPostDates = dates;
  }
  if (faqHtml) {
    const questions = extractFaqQuestions(faqHtml);
    if (questions.length > 0) signals.faqQuestions = questions;
  } else {
    // Fallback: try to extract FAQ questions from the homepage itself
    const questions = extractFaqQuestions(html);
    if (questions.length > 0) signals.faqQuestions = questions;
  }

  // Strip tags and collapse whitespace for the LLM
  const stripHtml = (raw: string) =>
    raw
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const text = stripHtml(html).slice(0, 3000);
  // Include a snippet from the location page (contact/about/our-story) so GPT can find the address
  const locationText = locationHtml ? stripHtml(locationHtml).slice(0, 1000) : null;

  // Extract structured business info via GPT-4o-mini
  let extracted: { name: string; type: string; location: string; description: string; services: string[] };
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a business analyst. Extract structured information about the business from the webpage content.
Return a JSON object with exactly these fields:
- name: the business name (string)
- type: the business type in 1-2 words, e.g. "gym", "restaurant", "boutique" (string)
- location: ALWAYS return in "Neighbourhood, City" format when both are detectable (e.g. "Clifton, Bristol", "South Kensington, London", "Mission District, San Francisco"). If you can only find one level, return what you have (e.g. just "Bristol" or just "Clifton"). Look in the address, footer, contact page, street name, postcode area, or any geographic reference. Never return a country or region. Return empty string only if truly nothing is detectable (string)
- description: a factual 2-3 sentence summary of what the business does, who it serves, and what makes it distinctive (string)
- services: an array of 3-6 key services or offerings (string[])`,
        },
        {
          role: "user",
          content: `URL: ${url}\n\nHomepage content:\n${text}${locationText ? `\n\nContact/About page content (use this to find the address):\n${locationText}` : ""}`,
        },
      ],
      max_tokens: 500,
    });
    extracted = JSON.parse(completion.choices[0].message.content ?? "{}");
  } catch (err) {
    console.error("[analyze] OpenAI call failed:", err);
    return NextResponse.json({ error: "Failed to analyse business — check your OPENAI_API_KEY" }, { status: 500 });
  }

  // Enrich signals with real Google Places data (non-blocking — falls back gracefully if key is missing)
  const placesData = await lookupGooglePlace(extracted.name ?? "", extracted.location ?? "");
  const enrichedSignals = {
    ...signals,
    hasGoogleBusinessProfile: placesData.hasGoogleBusinessProfile,
    gbpHasHours: placesData.gbpHasHours,
    gbpPhotoCount: placesData.gbpPhotoCount,
    reviewCount: placesData.reviewCount,
    reviewRating: placesData.reviewRating,
  };

  // Build the best possible "Neighbourhood, City" string.
  //
  // Places API is authoritative — it returns Google's verified business address.
  // GPT is useful for extracting the neighbourhood when Places only returns the city.
  //
  // Priority:
  //   1. Places has "Neighbourhood, City" (comma present) → use directly, most reliable
  //   2. GPT found a neighbourhood + Places confirmed a city → combine them
  //   3. GPT has "Neighbourhood, City" from page text → use GPT
  //   4. Places has city only → use it (verified, even if not neighbourhood-level)
  //   5. Places unavailable → fall back to whatever GPT found
  const gptLocation = (extracted.location ?? "").trim();
  const placesLocation = placesData.location ?? "";

  // Parse Places result into its components
  const placesHasComma = placesLocation.includes(",");
  const placesCity = placesHasComma
    ? placesLocation.split(",").slice(-1)[0].trim()
    : placesLocation;
  const gptNeighbourhood = gptLocation.includes(",")
    ? gptLocation.split(",")[0].trim()
    : gptLocation;

  console.log(`[analyze] Location sources — GPT: "${gptLocation}" | Places: "${placesLocation}"`);

  let resolvedLocation: string;
  if (placesHasComma) {
    // Places returned a full "Neighbourhood, City" — most authoritative
    resolvedLocation = placesLocation;
  } else if (gptNeighbourhood && placesCity && gptNeighbourhood.toLowerCase() !== placesCity.toLowerCase()) {
    // GPT found the neighbourhood, Places confirmed the city — combine them
    resolvedLocation = `${gptNeighbourhood}, ${placesCity}`;
  } else if (gptLocation.includes(",")) {
    // GPT managed to extract full "Neighbourhood, City" from page text
    resolvedLocation = gptLocation;
  } else if (placesCity) {
    // Places has city only — verified, use it
    resolvedLocation = placesCity;
  } else {
    // Places offline or failed — fall back to GPT
    resolvedLocation = gptLocation;
  }

  // Append country from Places API to make the location globally unambiguous.
  // e.g. "Clifton, Bristol" → "Clifton, Bristol, UK"
  // This eliminates LLM confusion between e.g. Clifton Bristol vs Clifton NJ.
  const country = placesData.country;
  if (country && resolvedLocation && !resolvedLocation.toLowerCase().includes(country.toLowerCase())) {
    resolvedLocation = `${resolvedLocation}, ${country}`;
  }

  console.log(`[analyze] Resolved location: "${resolvedLocation}" (country from Places: "${country ?? "none"}")`);

  const profile: BusinessProfile = {
    name: extracted.name ?? "",
    type: extracted.type ?? "",
    location: resolvedLocation,
    description: extracted.description ?? "",
    services: extracted.services ?? [],
    signals: enrichedSignals,
  };

  console.log("\n========== BUSINESS PROFILE ==========");
  console.log(JSON.stringify(profile, null, 2));
  console.log("=======================================\n");

  // Persist to cache + research dataset (fire and forget — don't block the response)
  Promise.all([
    setCachedProfile(url, cacheKey, profile),
    upsertBusiness(url, profile, "pipeline").then((businessId) => {
      if (businessId) return insertSignals(businessId, profile, "pipeline");
    }),
  ]).catch((err) => console.warn("[analyze] Background DB write failed:", err));

  return NextResponse.json({ profile });
}
