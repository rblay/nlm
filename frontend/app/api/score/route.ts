import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  BusinessProfile,
  DebugEntry,
  LLMScore,
  LLMProvider,
  ScoreResult,
} from "@/lib/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// ─── 1.3: Generate contextual queries from the business profile ───────────────

async function generateQueries(profile: BusinessProfile): Promise<string[]> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You generate natural language queries that real customers would ask an AI assistant when looking for a local business.
Generate exactly 8 queries that vary in phrasing, intent, and specificity — mix broad ("best gyms in London") and narrow ("personal trainer near W6 with evening classes").
Return a JSON object with a single key "queries" containing an array of 8 strings.`,
      },
      {
        role: "user",
        content: `Business name: ${profile.name}
Type: ${profile.type}
Location: ${profile.location}
Description: ${profile.description}
Services: ${profile.services.join(", ")}`,
      },
    ],
    max_tokens: 500,
  });
  const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
  return Array.isArray(parsed.queries) ? parsed.queries : [];
}

// ─── 1.4: Query each LLM and return raw response + latency ───────────────────

async function queryOpenAI(
  query: string
): Promise<{ response: string; latencyMs: number }> {
  const start = Date.now();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: query }],
    max_tokens: 400,
  });
  return {
    response: completion.choices[0].message.content ?? "",
    latencyMs: Date.now() - start,
  };
}

async function queryAnthropic(
  query: string
): Promise<{ response: string; latencyMs: number }> {
  const start = Date.now();
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    messages: [{ role: "user", content: query }],
  });
  return {
    response:
      message.content[0].type === "text" ? message.content[0].text : "",
    latencyMs: Date.now() - start,
  };
}

async function queryGemini(
  query: string
): Promise<{ response: string; latencyMs: number }> {
  const start = Date.now();
  const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(query);
  return {
    response: result.response.text(),
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
  const { url, profile } = body as { url: string; profile: BusinessProfile };

  if (!url || !profile) {
    return NextResponse.json(
      { error: "url and profile are required" },
      { status: 400 }
    );
  }

  // 1.3 — generate queries
  let queries: string[];
  try {
    queries = await generateQueries(profile);
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

  console.log(`\n[score] Generated ${queries.length} queries for "${profile.name}"`);
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
