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

// ─── 1.3 Step 1: Identify the most common customer intents for this business type

async function generateIntents(businessType: string, count: number): Promise<string[]> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert in consumer search behaviour. Your job is to identify the most common things potential customers want to know when searching for a local business of a given type.

Return the ${count} most frequently searched intents — ordered from most to least common. Each intent should be a short phrase describing what the customer wants to find out (e.g. "membership prices", "class timetable", "free trial availability").

Return a JSON object with a single key "intents" containing an array of exactly ${count} strings.`,
      },
      {
        role: "user",
        content: `Business type: ${businessType}`,
      },
    ],
    max_tokens: 300,
  });
  const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
  return Array.isArray(parsed.intents) ? parsed.intents : [];
}

// ─── 1.3 Step 2: Turn intents into location-aware discovery queries ───────────

async function generateQueries(
  profile: BusinessProfile,
  intents: string[]
): Promise<string[]> {
  const count = intents.length;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You generate natural language queries that a potential customer would type into an AI assistant when searching for a local business — someone who does not yet know this specific business exists.

You are given a list of the most common customer intents for this business type. Write one query per intent, making each query reflect that intent naturally.

Rules:
1. NEVER include the business name in any query. These are pure discovery queries.
2. If the business has multiple locations across different areas, anchor queries to specific neighbourhoods or areas (e.g. "boxing classes in East London", "best gyms in Notting Hill") — do NOT use proximity phrasing like "near me" or "near [postcode]".
3. If the business appears to have a single location, you may occasionally use proximity phrasing (e.g. "gyms near Hammersmith").
4. Make queries sound natural — like real things people type into ChatGPT or Google.

Return a JSON object with a single key "queries" containing an array of exactly ${count} strings, one per intent.`,
      },
      {
        role: "user",
        content: `Business type: ${profile.type}
Location / areas: ${profile.location}
Description: ${profile.description}
Services: ${profile.services.join(", ")}

Customer intents to cover (one query each):
${intents.map((intent, i) => `${i + 1}. ${intent}`).join("\n")}`,
      },
    ],
    max_tokens: 500,
  });
  const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
  return Array.isArray(parsed.queries) ? parsed.queries : [];
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
  // web_search_20250305 is a server-side tool — Anthropic manages the search loop
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    tools: [{ name: "web_search", type: "web_search_20250305" }],
    messages: [{ role: "user", content: query }],
  });
  // Extract text blocks only (tool_use / tool_result blocks are intermediate steps)
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("");
  return { response: text, latencyMs: Date.now() - start };
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

// ─── Detection: does the response mention this business? ─────────────────────

function mentionsBusiness(
  response: string,
  profile: BusinessProfile,
  url: string
): boolean {
  const text = response.toLowerCase();
  const name = profile.name.toLowerCase();

  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    // ignore malformed URL
  }

  return text.includes(name) || (domain.length > 0 && text.includes(domain));
}

// ─── API route ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, profile, queryCount = 3 } = body as { url: string; profile: BusinessProfile; queryCount?: number };

  if (!url || !profile) {
    return NextResponse.json(
      { error: "url and profile are required" },
      { status: 400 }
    );
  }

  // 1.3 Step 1 — identify common customer intents for this business type
  let intents: string[];
  try {
    intents = await generateIntents(profile.type, queryCount);
  } catch (err) {
    console.error("[score] Intent generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate intents — check your OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  console.log(`\n[score] Intents for "${profile.type}":`);
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

  // 1.4 — query all 3 LLMs in parallel for every query
  const allDebugEntries: DebugEntry[] = [];

  await Promise.all(
    queries.map(async (query) => {
      const [openaiResult, anthropicResult, geminiResult] =
        await Promise.allSettled([
          queryOpenAI(query),
          queryAnthropic(query),
          queryGemini(query),
        ]);

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
            error: true,
          });
        }
      }
    })
  );

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

  const scoreResult: ScoreResult = {
    overallScore,
    perLLM,
    intents,
    queries,
    debug: allDebugEntries,
  };

  console.log("\n========== SCORE RESULT ==========");
  console.log(`Overall: ${overallScore}/100`);
  perLLM.forEach((s) =>
    console.log(`  ${s.llm}: ${s.score}/100 (${s.mentions}/${s.totalQueries} mentions)`)
  );
  console.log("===================================\n");

  return NextResponse.json(scoreResult);
}
