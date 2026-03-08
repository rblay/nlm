import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { BusinessProfile, ObservableSignals } from "@/lib/types";

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
}

const PLACES_FALLBACK: PlacesResult = {
  hasGoogleBusinessProfile: false,
  gbpHasHours: false,
  gbpPhotoCount: null,
  reviewCount: null,
  reviewRating: null,
};

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
        "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.regularOpeningHours,places.photos",
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

    return {
      hasGoogleBusinessProfile: true,
      gbpHasHours: !!place.regularOpeningHours,
      gbpPhotoCount: Array.isArray(place.photos) ? place.photos.length : null,
      reviewCount: place.userRatingCount ?? null,
      reviewRating: place.rating ?? null,
    };
  } catch (err) {
    console.warn("[analyze] Places API lookup failed:", err);
    return PLACES_FALLBACK;
  }
}

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Fetch homepage + secondary pages in parallel
  let html: string;
  let blogHtml: string | null = null;
  let faqHtml: string | null = null;
  try {
    const baseOrigin = new URL(url).origin;
    const [homepageRes, rawBlog, rawNews, rawFaq] = await Promise.all([
      fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; LLMRankBot/1.0)" } }),
      fetchSecondary(`${baseOrigin}/blog`),
      fetchSecondary(`${baseOrigin}/news`),
      fetchSecondary(`${baseOrigin}/faq`),
    ]);
    html = await homepageRes.text();
    blogHtml = rawBlog ?? rawNews ?? null;
    faqHtml = rawFaq;
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

  // Strip tags and collapse whitespace, cap at 3000 chars for the LLM
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);

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
- location: city and/or neighbourhood if detectable, otherwise empty string (string)
- description: a factual 2-3 sentence summary of what the business does, who it serves, and what makes it distinctive (string)
- services: an array of 3-6 key services or offerings (string[])`,
        },
        {
          role: "user",
          content: `URL: ${url}\n\nWebpage content:\n${text}`,
        },
      ],
      max_tokens: 400,
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

  const profile: BusinessProfile = {
    name: extracted.name ?? "",
    type: extracted.type ?? "",
    location: extracted.location ?? "",
    description: extracted.description ?? "",
    services: extracted.services ?? [],
    signals: enrichedSignals,
  };

  console.log("\n========== BUSINESS PROFILE ==========");
  console.log(JSON.stringify(profile, null, 2));
  console.log("=======================================\n");

  return NextResponse.json({ profile });
}
