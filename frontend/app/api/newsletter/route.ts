import { NextRequest, NextResponse } from "next/server";
import type { BusinessProfile, ScoreResult, ActionCard, DebugEntry } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NewsletterRequest {
  profile: BusinessProfile;
  scoreResult: ScoreResult;
  actions: ActionCard[];
  url: string;
  weekOf?: string;
}

export interface NewsletterResponse {
  text: string;
}

// ─── Action ownership ─────────────────────────────────────────────────────────
// NLM implements these on behalf of the client.
// The rest are advice/steps the client carries out themselves.

const NLM_ACTION_IDS = new Set([
  "schema-json-ld",
  "meta-description",
  "title-tag",
  "blog-post-intro",
  "faq-draft",
]);

// ─── Query selection ──────────────────────────────────────────────────────────

const PROBLEM_KEYWORDS = [
  "struggling", "help", "looking for", "need", "best", "recommend",
  "where can i", "how do i", "find", "near me", "nearby", "good",
  "affordable", "cheap", "trying to", "want to",
];

function isProblemQuery(query: string): boolean {
  const q = query.toLowerCase();
  return PROBLEM_KEYWORDS.some((kw) => q.includes(kw));
}

function queryHitRate(query: string, debug: DebugEntry[]): number {
  const entries = debug.filter((e) => e.query === query);
  if (entries.length === 0) return 0;
  return entries.filter((e) => e.mentioned).length / entries.length;
}

function selectExampleQueries(debug: DebugEntry[]): { query: string; hit: boolean }[] {
  const seen = new Set<string>();
  const uniqueQueries: string[] = [];
  for (const e of debug) {
    if (!seen.has(e.query)) { seen.add(e.query); uniqueQueries.push(e.query); }
  }

  const annotated = uniqueQueries.map((q) => ({
    query: q,
    hitRate: queryHitRate(q, debug),
    isProblem: isProblemQuery(q),
  }));

  const problems = annotated.filter((q) => q.isProblem).sort((a, b) => a.hitRate - b.hitRate);
  const others   = annotated.filter((q) => !q.isProblem).sort((a, b) => a.hitRate - b.hitRate);

  const picked: typeof annotated = [];
  picked.push(...problems.slice(0, 2));
  picked.push(...others.slice(0, 4 - picked.length));
  if (picked.length < 4) picked.push(...problems.slice(2, 4 - picked.length));
  if (picked.length < 4) {
    for (const q of annotated) {
      if (!picked.includes(q)) picked.push(q);
      if (picked.length === 4) break;
    }
  }

  return picked.slice(0, 4).map((q) => ({ query: q.query, hit: q.hitRate > 0 }));
}

// ─── Signal summary ───────────────────────────────────────────────────────────

function signalLines(profile: BusinessProfile): { present: string[]; missing: string[] } {
  const { signals } = profile;
  const present: string[] = [];
  const missing: string[] = [];
  const check = (condition: boolean, label: string) =>
    (condition ? present : missing).push(label);

  check(!!signals.titleTag, `Title tag ("${signals.titleTag}")`);
  check(signals.hasMetaDescription, "Meta description");
  check(signals.hasSchema, "Schema.org / JSON-LD markup");
  check(signals.hasBlog, "Blog or news section");
  check(signals.hasFAQ, "FAQ page");
  check(signals.socialLinks.length > 0, `Social media links (${signals.socialLinks.length} found)`);
  check(signals.hasMapsEmbed, "Google Maps embed");
  check(signals.hasGoogleBusinessProfile, "Google Business Profile");
  if (signals.hasGoogleBusinessProfile) {
    check(signals.gbpHasHours, "GBP opening hours");
    if (signals.gbpPhotoCount !== null)
      check(signals.gbpPhotoCount >= 10, `GBP photos (${signals.gbpPhotoCount} found — aim for 10+)`);
  }
  if (signals.reviewCount !== null)
    check(signals.reviewCount >= 50, `Google reviews (${signals.reviewCount} reviews, aim for 50+)`);

  return { present, missing };
}

// ─── Content formatter ────────────────────────────────────────────────────────

function formatActionContent(action: ActionCard): string {
  const fence = action.contentType === "code" ? "```html" : "";
  const closeFence = action.contentType === "code" ? "```" : "";
  return fence ? `${fence}\n${action.content}\n${closeFence}` : action.content;
}

// ─── Main formatter ───────────────────────────────────────────────────────────

function buildNewsletterText(
  profile: BusinessProfile,
  scoreResult: ScoreResult,
  actions: ActionCard[],
  weekOf: string,
): string {
  const { overallScore, perLLM, summary, debug } = scoreResult;
  const exampleQueries = selectExampleQueries(debug);
  const { present, missing } = signalLines(profile);
  const top3 = actions.slice(0, 3);

  // Split top 3 into NLM-implemented vs client-action
  const nlmActions    = top3.filter((a) => NLM_ACTION_IDS.has(a.id));
  const clientActions = top3.filter((a) => !NLM_ACTION_IDS.has(a.id));

  const llmNames: Record<string, string> = {
    openai: "ChatGPT", perplexity: "Perplexity", gemini: "Gemini",
  };

  const scoreBar  = Math.round(overallScore / 10);
  const scoreFill = "█".repeat(scoreBar) + "░".repeat(10 - scoreBar);
  const biz = profile.name;

  const lines: string[] = [];

  // ── Header ──────────────────────────────────────────────────────────────
  lines.push(`Subject: ${biz} — AI Visibility Update — Week of ${weekOf}`);
  lines.push("");
  lines.push("─".repeat(60));
  lines.push("");
  lines.push("Hi,");
  lines.push("");
  lines.push(`Here's this week's AI visibility update for ${biz}. Below you'll find ${biz}'s current score, a snapshot of what's already working, and the actions we're carrying out this week.`);
  lines.push("");

  // ── Score ────────────────────────────────────────────────────────────────
  lines.push("─".repeat(60));
  lines.push(`AI VISIBILITY SCORE: ${overallScore}/100`);
  lines.push(`[${scoreFill}] ${overallScore}%`);
  lines.push("");
  lines.push("By AI assistant:");
  for (const s of perLLM) {
    const name = llmNames[s.llm] ?? s.llm;
    lines.push(`  ${name.padEnd(12)} ${s.score}%  (${s.mentions}/${s.totalQueries} queries)`);
  }
  lines.push("");
  lines.push(summary);
  lines.push("");

  // ── Example queries ──────────────────────────────────────────────────────
  lines.push("─".repeat(60));
  lines.push(`HOW ${biz.toUpperCase()} SHOWS UP — EXAMPLE QUERIES`);
  lines.push("");
  lines.push(`We tested ${biz} across ChatGPT, Perplexity, and Gemini using real customer search queries. Here are 4 examples:`);
  lines.push("");
  for (let i = 0; i < exampleQueries.length; i++) {
    const { query, hit } = exampleQueries[i];
    const status = hit
      ? `✓ ${biz} was mentioned by at least one AI`
      : `✗ ${biz} was not found by any AI`;
    lines.push(`${i + 1}. "${query}"`);
    lines.push(`   ${status}`);
  }
  lines.push("");

  // ── Signals ──────────────────────────────────────────────────────────────
  lines.push("─".repeat(60));
  lines.push(`${biz.toUpperCase()}'S ONLINE SIGNALS`);
  lines.push("");
  lines.push(`Here's what we found when we scanned ${biz}'s online presence:`);
  lines.push("");
  if (present.length > 0) {
    lines.push(`✓ ${biz} already has these in place:`);
    for (const p of present) lines.push(`   • ${p}`);
    lines.push("");
  }
  if (missing.length > 0) {
    lines.push(`✗ ${biz}'s website is missing or incomplete on:`);
    for (const m of missing) lines.push(`   • ${m}`);
    lines.push("");
  }

  // ── NLM-implemented actions ──────────────────────────────────────────────
  if (nlmActions.length > 0) {
    lines.push("─".repeat(60));
    lines.push(`WHAT WE'RE IMPLEMENTING FOR ${biz.toUpperCase()} THIS WEEK`);
    lines.push("");
    lines.push(`The following items will be built and added to ${biz}'s website by our team. We'll let you know once each is live.`);
    lines.push("");

    for (let i = 0; i < nlmActions.length; i++) {
      const action = nlmActions[i];
      lines.push(`${i + 1}. ${action.title.toUpperCase()}  [Impact: ${action.impact}]`);
      lines.push("");
      lines.push(action.whyItMatters);
      lines.push("");
      lines.push(formatActionContent(action));
      lines.push("");
      if (i < nlmActions.length - 1) lines.push("· · ·");
      lines.push("");
    }
  }

  // ── Client-action items ──────────────────────────────────────────────────
  if (clientActions.length > 0) {
    lines.push("─".repeat(60));
    lines.push(`YOUR ACTION ITEMS THIS WEEK`);
    lines.push("");
    lines.push(`These are things only ${biz} can do directly — we've put together everything you need to make them as straightforward as possible.`);
    lines.push("");

    for (let i = 0; i < clientActions.length; i++) {
      const action = clientActions[i];
      lines.push(`${i + 1}. ${action.title.toUpperCase()}  [Impact: ${action.impact}]`);
      lines.push("");
      lines.push(action.whyItMatters);
      lines.push("");
      lines.push(formatActionContent(action));
      lines.push("");
      if (i < clientActions.length - 1) lines.push("· · ·");
      lines.push("");
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  lines.push("─".repeat(60));
  lines.push(`Any questions about ${biz}'s update, or want to reprioritise anything? Just reply to this email and we'll get back to you.`);
  lines.push("");
  lines.push("Best,");
  lines.push("The NLM Team");
  lines.push("");
  lines.push("─".repeat(60));
  lines.push("LLMRank · AI visibility for local businesses");
  lines.push(`Next update for ${biz}: in approx. 1–2 weeks`);

  return lines.join("\n");
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { profile, scoreResult, actions, url, weekOf } = (await req.json()) as NewsletterRequest;

    if (!profile || !scoreResult || !actions || !url) {
      return NextResponse.json(
        { error: "profile, scoreResult, actions, and url are required" },
        { status: 400 },
      );
    }

    const date = weekOf
      ? new Date(weekOf).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const text = buildNewsletterText(profile, scoreResult, actions, date);
    return NextResponse.json({ text } satisfies NewsletterResponse);
  } catch {
    return NextResponse.json({ error: "Failed to generate newsletter" }, { status: 500 });
  }
}
