import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    console.error(`[LLM Analysis] Failed to fetch ${url}:`, err);
    return NextResponse.json({ error: "Failed to fetch URL" }, { status: 422 });
  }

  // Strip HTML tags and collapse whitespace, cap at 3000 chars
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);

  // Call GPT-4o-mini
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a business analyst. Based on webpage content, write a concise 2-3 sentence summary of what the business does, who it serves, and what makes it distinctive. Be factual and specific.",
      },
      {
        role: "user",
        content: `URL: ${url}\n\nWebpage content:\n${text}`,
      },
    ],
    max_tokens: 200,
  });

  const summary = completion.choices[0].message.content;

  console.log("\n========== LLM BUSINESS ANALYSIS ==========");
  console.log(`URL:     ${url}`);
  console.log(`Summary: ${summary}`);
  console.log("============================================\n");

  return NextResponse.json({ ok: true });
}
