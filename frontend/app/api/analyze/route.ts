import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { BusinessProfile, ObservableSignals } from "@/lib/types";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractSignals(html: string): ObservableSignals {
  const hasSchema = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
  const hasBlog = /href=["'][^"']*\/(blog|news)[/"']/i.test(html);
  const hasMapsEmbed = /maps\.google\.com|google\.com\/maps/i.test(html);

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

  return {
    hasSchema,
    hasBlog,
    socialLinks: [...new Set(socialLinks)],
    hasMapsEmbed,
    reviewCount: null,
    reviewRating: null,
  };
}

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Fetch the page HTML
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LLMRankBot/1.0)" },
    });
    html = await res.text();
  } catch (err) {
    console.error(`[analyze] Failed to fetch ${url}:`, err);
    return NextResponse.json({ error: "Failed to fetch URL" }, { status: 422 });
  }

  // Extract observable signals from raw HTML before stripping tags
  const signals = extractSignals(html);

  // Strip tags and collapse whitespace, cap at 3000 chars for the LLM
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);

  // Extract structured business info via GPT-4o-mini
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

  let extracted: { name: string; type: string; location: string; description: string; services: string[] };
  try {
    extracted = JSON.parse(completion.choices[0].message.content ?? "{}");
  } catch {
    return NextResponse.json({ error: "Failed to parse business profile" }, { status: 500 });
  }

  const profile: BusinessProfile = {
    name: extracted.name ?? "",
    type: extracted.type ?? "",
    location: extracted.location ?? "",
    description: extracted.description ?? "",
    services: extracted.services ?? [],
    signals,
  };

  console.log("\n========== BUSINESS PROFILE ==========");
  console.log(JSON.stringify(profile, null, 2));
  console.log("=======================================\n");

  return NextResponse.json({ profile });
}
