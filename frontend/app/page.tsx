"use client";

import React, { useState, useRef, useEffect } from "react";
import type {
  BusinessProfile,
  Recommendation,
  RecommendationImpact,
  ScoreResult,
  LLMProvider,
  ActionCard,
} from "@/lib/types";

// ─── Testing mode ─────────────────────────────────────────────────────────────

type TestingMode = "all" | "score-only" | "rec-only" | "fake";

const FAKE_PROFILE: BusinessProfile = {
  name: "Apex Fitness Studio",
  type: "Personal Training Studio",
  location: "Shoreditch, London",
  description: "A boutique personal training studio in the heart of Shoreditch offering bespoke strength and conditioning programmes for all fitness levels.",
  services: ["1-to-1 personal training", "Small group HIIT classes", "Nutrition coaching", "Body composition analysis"],
  signals: {
    hasSchema: false, hasBlog: false, hasFAQ: false, hasMetaDescription: true,
    titleTag: "Apex Fitness Studio | Personal Training Shoreditch",
    socialLinks: ["https://instagram.com/apexfitnesslondon"],
    hasMapsEmbed: false, hasGoogleBusinessProfile: true, gbpHasHours: true,
    gbpPhotoCount: 4, reviewCount: 31, reviewRating: 4.7,
  },
};

const FAKE_QUERIES = [
  "best personal training studios in Shoreditch",
  "beginner-friendly gyms in East London",
  "strength training classes for women Shoreditch",
  "HIIT classes near Shoreditch London",
];

const FAKE_INTENTS = [
  "find a personal trainer in Shoreditch",
  "beginner gym options in East London",
  "strength training for women",
  "high-intensity interval training classes nearby",
];

const FAKE_SCORE_RESULT: ScoreResult = {
  overallScore: 42,
  perLLM: [
    { llm: "openai",    score: 50, mentions: 2, totalQueries: 4 },
    { llm: "anthropic", score: 25, mentions: 1, totalQueries: 4 },
    { llm: "gemini",    score: 50, mentions: 2, totalQueries: 4 },
  ],
  intents: FAKE_INTENTS,
  queries: FAKE_QUERIES,
  debug: [
    { query: FAKE_QUERIES[0], llm: "openai",    response: "Top PT studios in Shoreditch include Apex Fitness Studio, known for bespoke strength programmes.", mentioned: true,  latencyMs: 1240 },
    { query: FAKE_QUERIES[0], llm: "anthropic", response: "In Shoreditch you'll find Third Space and F45. Smaller boutique studios are less commonly cited.", mentioned: false, latencyMs: 2100 },
    { query: FAKE_QUERIES[0], llm: "gemini",    response: "Apex Fitness Studio in Shoreditch is well-regarded for personal training.", mentioned: true,  latencyMs: 980  },
    { query: FAKE_QUERIES[1], llm: "openai",    response: "For beginners in East London, PureGym and Nuffield Health are popular choices.", mentioned: false, latencyMs: 1150 },
    { query: FAKE_QUERIES[1], llm: "anthropic", response: "East London has many gyms for beginners including several boutique studios.", mentioned: false, latencyMs: 1890 },
    { query: FAKE_QUERIES[1], llm: "gemini",    response: "Beginners in East London often choose Apex Fitness Studio for structured onboarding.", mentioned: true,  latencyMs: 1020 },
    { query: FAKE_QUERIES[2], llm: "openai",    response: "Apex Fitness Studio offers women-focused strength programmes in Shoreditch.", mentioned: true,  latencyMs: 1310 },
    { query: FAKE_QUERIES[2], llm: "anthropic", response: "There are several studios offering women's strength training in East London.", mentioned: false, latencyMs: 2050 },
    { query: FAKE_QUERIES[2], llm: "gemini",    response: "For women's strength training in Shoreditch, options include F45 and boutique studios.", mentioned: false, latencyMs: 1100 },
    { query: FAKE_QUERIES[3], llm: "openai",    response: "HIIT classes in Shoreditch are offered by Barry's Bootcamp and independent studios.", mentioned: false, latencyMs: 1200 },
    { query: FAKE_QUERIES[3], llm: "anthropic", response: "Apex Fitness Studio offers HIIT classes in Shoreditch alongside personal training.", mentioned: true,  latencyMs: 1980 },
    { query: FAKE_QUERIES[3], llm: "gemini",    response: "Popular HIIT options in Shoreditch include F45, Barry's and smaller boutique studios.", mentioned: false, latencyMs: 950  },
  ],
  summary: "Apex Fitness Studio appears in roughly half of AI responses for branded queries but is rarely surfaced for generic discovery searches. ChatGPT and Gemini mention it for strength-focused queries, while Claude rarely surfaces it. The business is missing from high-volume beginner and HIIT queries, pointing to low content authority and absent Schema markup.",
};

const FAKE_RECOMMENDATIONS: Recommendation[] = [
  { title: "Add Schema.org markup", whyItMatters: "Without structured data, AI models struggle to extract accurate business details from your website.", observed: "No JSON-LD schema detected.", impact: "High", firstAction: "Add a LocalBusiness JSON-LD snippet to your homepage <head>." },
  { title: "Publish a blog or news section", whyItMatters: "Fresh content signals authority to LLMs, increasing the chance you're cited.", observed: "No blog or news section detected.", impact: "High", firstAction: "Write 2–3 posts covering common customer questions." },
  { title: "Add more Google Business Profile photos", whyItMatters: "Listings with 10+ photos rank higher in local packs.", observed: "Only 4 photos on GBP (target: 10+).", impact: "Medium", firstAction: "Upload at least 6 more photos: studio interior, trainers in action, equipment." },
];

const FAKE_ACTIONS: ActionCard[] = [
  {
    id: "schema", title: "Schema.org JSON-LD snippet", impact: "High",
    whyItMatters: "Paste into your homepage <head> so AI models can reliably extract your business details.",
    content: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "HealthClub",\n  "name": "Apex Fitness Studio",\n  "url": "https://apexfitness.co.uk",\n  "address": { "@type": "PostalAddress", "addressLocality": "Shoreditch", "addressCountry": "GB" }\n}\n</script>`,
    contentType: "code",
  },
  {
    id: "meta", title: "Optimised meta description", impact: "Medium",
    whyItMatters: "A clear, keyword-rich meta description helps LLMs understand and cite your business accurately.",
    content: "Apex Fitness Studio — boutique personal training in Shoreditch, London. 1-to-1 coaching, HIIT classes and nutrition programmes. Book a free taster session today.",
    contentType: "text",
  },
];

// ─── Pipeline steps ───────────────────────────────────────────────────────────

type StepStatus = "pending" | "loading" | "done" | "error";
type PipelineStep = { id: string; label: string; status: StepStatus; error?: string };

const INITIAL_STEPS: PipelineStep[] = [
  { id: "analyze",   label: "Extracting business from URL",    status: "pending" },
  { id: "intents",   label: "Analysing key customer intent",   status: "pending" },
  { id: "chatgpt",   label: "Calculating ChatGPT visibility",  status: "pending" },
  { id: "claude",    label: "Calculating Claude visibility",   status: "pending" },
  { id: "gemini",    label: "Calculating Gemini visibility",   status: "pending" },
  { id: "recommend", label: "Generating recommendations",      status: "pending" },
  { id: "actions",   label: "Suggesting relevant actions",     status: "pending" },
];

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "loading")
    return <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />;
  if (status === "done")
    return (
      <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-green-500 flex items-center justify-center">
        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 5l2.5 2.5L8 3" />
        </svg>
      </div>
    );
  if (status === "error")
    return (
      <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-red-500 flex items-center justify-center">
        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l4 4M7 3l-4 4" />
        </svg>
      </div>
    );
  return <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 border-gray-200" />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LLM_META: Record<LLMProvider, { label: string; color: string }> = {
  openai: { label: "ChatGPT", color: "bg-green-500" },
  anthropic: { label: "Claude", color: "bg-blue-500" },
  gemini: { label: "Gemini", color: "bg-yellow-500" },
};

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excellent", color: "text-green-600" };
  if (score >= 60) return { label: "Good", color: "text-yellow-600" };
  if (score >= 40) return { label: "Fair", color: "text-orange-500" };
  return { label: "Poor", color: "text-red-500" };
}

function ScoreBar({
  label,
  score,
  color,
  mentions,
  total,
}: {
  label: string;
  score: number;
  color: string;
  mentions?: number;
  total?: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-medium text-gray-700">
          {score}/100
          {mentions !== undefined && total !== undefined && (
            <span className="text-gray-400 font-normal ml-1">
              ({mentions}/{total} queries)
            </span>
          )}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

const IMPACT_STYLES: Record<RecommendationImpact, string> = {
  High: "bg-red-50 text-red-700",
  Medium: "bg-yellow-50 text-yellow-700",
  Low: "bg-gray-100 text-gray-600",
};

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 leading-snug">{rec.title}</h3>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${IMPACT_STYLES[rec.impact]}`}>
          {rec.impact} impact
        </span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{rec.whyItMatters}</p>
      <div className="text-xs text-gray-400 bg-gray-50 rounded-md px-3 py-2 leading-relaxed">
        <span className="font-medium text-gray-500">Observed: </span>{rec.observed}
      </div>
      <div className="text-xs bg-blue-50 text-blue-800 rounded-md px-3 py-2 leading-relaxed">
        <span className="font-medium">First action: </span>{rec.firstAction}
      </div>
    </div>
  );
}

function ActionCardComponent({ action }: { action: ActionCard }) {
  const [copied, setCopied] = React.useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(action.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isCode = action.contentType === "code";
  const isSteps = action.contentType === "steps";

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 leading-snug">{action.title}</h3>
          {action.isPlaceholder && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium whitespace-nowrap flex-shrink-0">
              template
            </span>
          )}
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${IMPACT_STYLES[action.impact]}`}>
          {action.impact} impact
        </span>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">{action.whyItMatters}</p>

      <div className="relative">
        <pre className={`text-xs rounded-md px-3 py-3 overflow-x-auto whitespace-pre-wrap leading-relaxed ${
          isCode ? "bg-gray-900 text-gray-100 font-mono" : "bg-gray-50 text-gray-700"
        }`}>
          {action.content}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-400 hover:text-gray-200 transition-colors border border-gray-200/20"
          title="Copy to clipboard"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {isSteps && (
        <p className="text-xs text-gray-400 italic">Follow the steps above — no code required.</p>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Home() {
  const [url, setUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [showModal, setShowModal] = useState(false);
  const intentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState(false);
  const [actions, setActions] = useState<ActionCard[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [testingMode, setTestingMode] = useState<TestingMode>("all");
  const [queryCount, setQueryCount] = useState(12);

  const runScore = testingMode === "all" || testingMode === "score-only";
  const runRecommendations = testingMode === "all" || testingMode === "rec-only";

  // Auto-close modal when all steps finish successfully
  useEffect(() => {
    if (showModal && steps.every((s) => s.status === "done")) {
      const t = setTimeout(() => setShowModal(false), 800);
      return () => clearTimeout(t);
    }
  }, [steps, showModal]);

  const setStep = (id: string, update: Partial<PipelineStep>) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));

  function toggleRow(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    // Fake data — no API calls
    if (testingMode === "fake") {
      setSubmitted(true);
      setProfile(FAKE_PROFILE);
      setScoreResult(FAKE_SCORE_RESULT);
      setRecommendations(FAKE_RECOMMENDATIONS);
      setActions(FAKE_ACTIONS);
      return;
    }

    if (intentTimeoutRef.current) clearTimeout(intentTimeoutRef.current);
    setSubmitted(true);
    setProfile(null);
    setScoreResult(null);
    setError(null);
    setDebugOpen(false);
    setExpandedRows(new Set());
    setRecommendations([]);
    setRecommendationsLoading(false);
    setRecommendationsError(false);
    setActions([]);
    setActionsLoading(false);

    // Build step list based on what's actually being run (skip unchecked sections)
    const activeSteps: PipelineStep[] = [
      { id: "analyze",   label: "Extracting business from URL",    status: "pending" },
      ...(runScore ? [
        { id: "intents",   label: "Analysing key customer intent",   status: "pending" as StepStatus },
        { id: "chatgpt",   label: "Calculating ChatGPT visibility",  status: "pending" as StepStatus },
        { id: "claude",    label: "Calculating Claude visibility",   status: "pending" as StepStatus },
        { id: "gemini",    label: "Calculating Gemini visibility",   status: "pending" as StepStatus },
      ] : []),
      ...(runRecommendations ? [
        { id: "recommend", label: "Generating recommendations",      status: "pending" as StepStatus },
        { id: "actions",   label: "Suggesting relevant actions",     status: "pending" as StepStatus },
      ] : []),
    ];
    setSteps(activeSteps);
    setShowModal(true);

    // ── Step 1: Extract business profile ────────────────────────────────────
    setStep("analyze", { status: "loading" });
    let fetchedProfile: BusinessProfile;
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json"))
        throw new Error(`Server error (${res.status}) — check your .env.local API keys`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      fetchedProfile = data.profile;
      setProfile(fetchedProfile);
      setStep("analyze", { status: "done" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setStep("analyze", { status: "error", error: msg });
      setError(msg);
      return;
    }

    // ── Recommendations + actions (background, if enabled) ───────────────────
    if (runRecommendations) {
      setStep("recommend", { status: "loading" });
      setRecommendationsLoading(true);
      fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: fetchedProfile }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.recommendations) setRecommendations(d.recommendations);
          setStep("recommend", { status: "done" });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : "Recommendations failed";
          setStep("recommend", { status: "error", error: msg });
          setRecommendationsError(true);
        })
        .finally(() => setRecommendationsLoading(false));

      setStep("actions", { status: "loading" });
      setActionsLoading(true);
      fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: fetchedProfile, url }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.actions) setActions(d.actions);
          setStep("actions", { status: "done" });
        })
        .catch(() => setStep("actions", { status: "error" }))
        .finally(() => setActionsLoading(false));
    }

    // ── Step 2–5: Generate intents + query all 3 LLMs ────────────────────────
    if (runScore) {
      setStep("intents", { status: "loading" });
      // After ~3s the intent phase is likely done server-side; show LLMs as loading
      intentTimeoutRef.current = setTimeout(() => {
        setStep("intents", { status: "done" });
        setStep("chatgpt", { status: "loading" });
        setStep("claude", { status: "loading" });
        setStep("gemini", { status: "loading" });
      }, 3000);
      try {
        const res = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, profile: fetchedProfile, queryCount }),
        });
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json"))
          throw new Error(`Scoring error (${res.status}) — check your API keys`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Scoring failed");
        if (intentTimeoutRef.current) clearTimeout(intentTimeoutRef.current);
        setStep("intents", { status: "done" });
        setStep("chatgpt", { status: "done" });
        setStep("claude", { status: "done" });
        setStep("gemini", { status: "done" });
        setScoreResult(data);
      } catch (err) {
        if (intentTimeoutRef.current) clearTimeout(intentTimeoutRef.current);
        const msg = err instanceof Error ? err.message : "Scoring failed";
        setStep("intents", { status: "error", error: msg });
        setStep("chatgpt", { status: "error" });
        setStep("claude", { status: "error" });
        setStep("gemini", { status: "error" });
        setError(msg);
      }
    }
  }

  const hasStepError = steps.some((s) => s.status === "error");
  const isRunning = steps.some((s) => s.status === "loading");

  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Progress modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Analysing your business</h2>
              <p className="text-xs text-gray-400 mt-0.5 break-all">{url}</p>
            </div>
            <ul className="space-y-3">
              {steps.map((step) => (
                <li key={step.id} className="flex items-start gap-3">
                  <StepIcon status={step.status} />
                  <div className="min-w-0">
                    <span className={`text-sm ${
                      step.status === "pending" ? "text-gray-400" :
                      step.status === "error"   ? "text-red-600"  : "text-gray-800"
                    }`}>
                      {step.label}
                    </span>
                    {step.error && (
                      <p className="text-xs text-red-500 mt-1 font-mono break-words">{step.error}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {hasStepError && !isRunning && (
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <span className="font-semibold text-gray-900 tracking-tight">
          LLM<span className="text-blue-600">Rank</span>
        </span>
        <span className="text-xs text-gray-400 uppercase tracking-widest">
          MBA Project
        </span>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-24">
        <div className="max-w-xl w-full text-center space-y-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            AI Visibility for Small Business
          </p>

          <h1 className="text-4xl font-bold text-gray-900 leading-tight">
            How do AI assistants describe your business?
          </h1>

          <p className="text-gray-500 text-lg">
            Enter your website URL and we&apos;ll analyze how visible and
            accurately represented your business is across leading AI models —
            then suggest how to improve it.
          </p>

          {/* URL Input */}
          {!submitted ? (
            <form
              onSubmit={handleSubmit}
              className="mt-8 flex flex-col gap-3"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourbusiness.com"
                  required
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  Analyze →
                </button>
              </div>
              <div className="flex items-center gap-3 px-1 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 whitespace-nowrap">Testing mode</span>
                  <select
                    value={testingMode}
                    onChange={(e) => setTestingMode(e.target.value as TestingMode)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="score-only">LLM Score Only</option>
                    <option value="rec-only">Recommendations + Actions Only</option>
                    <option value="fake">Fake Data</option>
                  </select>
                </div>
                {(testingMode === "all" || testingMode === "score-only") && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 whitespace-nowrap">Queries per LLM</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={queryCount}
                      onChange={(e) => setQueryCount(Math.min(12, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-center text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </form>
          ) : (
            <div className="mt-8 space-y-4 text-left">
              {/* URL chip */}
              <div className="px-4 py-3 rounded-lg border border-blue-100 bg-blue-50 flex items-center gap-3">
                <span className="text-blue-500 text-base">🔗</span>
                <p className="text-sm text-blue-700 break-all flex-1">{url}</p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setProfile(null);
                    setScoreResult(null);
                    setError(null);
                    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
                    setShowModal(false);
                    setRecommendations([]);
                    setRecommendationsLoading(false);
                    setRecommendationsError(false);
                    setActions([]);
                    setActionsLoading(false);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-600 whitespace-nowrap"
                >
                  Change
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Business profile card */}
              {profile && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                      Business Detected
                    </p>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">
                          {profile.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                          {profile.type && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium capitalize">
                              {profile.type}
                            </span>
                          )}
                          {profile.location && (
                            <span className="text-xs text-gray-400">
                              {profile.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                      {profile.description}
                    </p>
                  </div>

                  {profile.services.length > 0 && (
                    <div className="px-6 py-4 border-b border-gray-100">
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                        Services
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {profile.services.map((s) => (
                          <span
                            key={s}
                            className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="px-6 py-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                      Signals detected
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "Title tag", active: !!profile.signals.titleTag },
                        { label: "Meta description", active: profile.signals.hasMetaDescription },
                        { label: "Schema markup", active: profile.signals.hasSchema },
                        { label: "Blog / News", active: profile.signals.hasBlog },
                        { label: "FAQ page", active: profile.signals.hasFAQ },
                        { label: "Social links", active: profile.signals.socialLinks.length > 0 },
                        { label: "Google Maps embed", active: profile.signals.hasMapsEmbed },
                        { label: "Google Business Profile", active: profile.signals.hasGoogleBusinessProfile },
                        ...(profile.signals.hasGoogleBusinessProfile ? [
                          { label: "GBP hours set", active: profile.signals.gbpHasHours },
                          { label: `GBP photos (${profile.signals.gbpPhotoCount ?? 0})`, active: (profile.signals.gbpPhotoCount ?? 0) >= 10 },
                        ] : []),
                      ].map(({ label, active }) => (
                        <span
                          key={label}
                          className={`text-xs px-2 py-1 rounded-md font-medium ${
                            active
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-50 text-gray-400"
                          }`}
                        >
                          {active ? "✓" : "✗"} {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Score card — real data */}
              {scoreResult && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                        LLM Visibility Score
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Based on {scoreResult.queries.length} queries across 3 AI models
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-gray-900">
                        {scoreResult.overallScore}
                        <span className="text-base font-normal text-gray-400">/100</span>
                      </p>
                      <p className={`text-xs font-semibold ${scoreLabel(scoreResult.overallScore).color}`}>
                        {scoreLabel(scoreResult.overallScore).label}
                      </p>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-b border-gray-100">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-700"
                        style={{ width: `${scoreResult.overallScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="px-6 py-4 space-y-3">
                    {scoreResult.perLLM.map((s) => {
                      const meta = LLM_META[s.llm];
                      return (
                        <ScoreBar
                          key={s.llm}
                          label={meta.label}
                          score={s.score}
                          color={meta.color}
                          mentions={s.mentions}
                          total={s.totalQueries}
                        />
                      );
                    })}
                  </div>

                  {scoreResult.summary && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                        What this means
                      </p>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {scoreResult.summary}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Recommendations */}
              {profile && recommendationsError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-3">
                  <p className="text-xs text-red-500">Could not generate recommendations — check your OPENAI_API_KEY.</p>
                </div>
              )}
              {profile && (recommendationsLoading || recommendations.length > 0) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                      Recommendations
                    </p>
                    {recommendationsLoading && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
                        Analysing gaps...
                      </div>
                    )}
                  </div>
                  {recommendations.map((rec, i) => (
                    <RecommendationCard key={i} rec={rec} />
                  ))}
                </div>
              )}

              {/* Actions */}
              {profile && (actionsLoading || actions.length > 0) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                        Actions
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Ready-to-use content and fixes for your biggest gaps
                      </p>
                    </div>
                    {actionsLoading && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
                        Generating...
                      </div>
                    )}
                  </div>
                  {actions.map((action) => (
                    <ActionCardComponent key={action.id} action={action} />
                  ))}
                </div>
              )}

              {/* Debug panel */}
              {scoreResult && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setDebugOpen((o) => !o)}
                    className="w-full px-6 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                      Debug — Query × LLM Results
                    </span>
                    <span className="text-xs text-gray-400">
                      {debugOpen ? "▲ hide" : "▼ show"}
                    </span>
                  </button>

                  {debugOpen && (
                    <div className="overflow-x-auto">
                      {/* Intents + Queries side by side */}
                      <div className="px-6 py-4 border-b border-gray-100 bg-white grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                            Common Customer Intents
                          </p>
                          <ol className="space-y-1">
                            {scoreResult.intents.map((intent, i) => (
                              <li key={i} className="text-xs text-gray-500">
                                <span className="font-mono text-gray-300 mr-2">
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                                {intent}
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                            Generated Queries
                          </p>
                          <ol className="space-y-1">
                            {scoreResult.queries.map((q, i) => (
                              <li key={i} className="text-xs text-gray-600">
                                <span className="font-mono text-gray-300 mr-2">
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                                {q}
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>

                      {/* Results table */}
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-4 py-2 text-gray-400 font-medium w-1/2">Query</th>
                            <th className="text-left px-4 py-2 text-gray-400 font-medium">LLM</th>
                            <th className="text-left px-4 py-2 text-gray-400 font-medium">Mentioned</th>
                            <th className="text-left px-4 py-2 text-gray-400 font-medium">Latency</th>
                            <th className="px-4 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {scoreResult.debug.map((entry, i) => {
                            const rowKey = `${i}-${entry.llm}`;
                            const isExpanded = expandedRows.has(rowKey);
                            const meta = LLM_META[entry.llm];
                            return (
                              <React.Fragment key={rowKey}>
                                <tr
                                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                  onClick={() => toggleRow(rowKey)}
                                >
                                  <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{entry.query}</td>
                                  <td className="px-4 py-2 text-gray-500">{meta.label}</td>
                                  <td className="px-4 py-2">
                                    {entry.error ? (
                                      <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-500 font-medium">error</span>
                                    ) : entry.mentioned ? (
                                      <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">yes</span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">no</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-gray-400 font-mono">
                                    {entry.error ? "—" : entry.latencyMs > 0 ? `${(entry.latencyMs / 1000).toFixed(1)}s` : "—"}
                                  </td>
                                  <td className="px-4 py-2 text-gray-400">{isExpanded ? "▲" : "▼"}</td>
                                </tr>
                                {isExpanded && (
                                  <tr className="bg-gray-50 border-b border-gray-100">
                                    <td colSpan={5} className="px-4 py-3 leading-relaxed whitespace-pre-wrap">
                                      {entry.error
                                        ? <span className="text-red-500 font-mono text-xs">{entry.errorMessage ?? "Unknown error"}</span>
                                        : entry.response || <span className="text-gray-400 italic">No response</span>}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Steps preview */}
        <div className="mt-20 max-w-2xl w-full grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          {[
            {
              step: "01",
              title: "Extract",
              desc: "We scrape your website to understand your business, products, and positioning.",
            },
            {
              step: "02",
              title: "Measure",
              desc: "We query multiple LLMs to see how — and if — they mention your business.",
            },
            {
              step: "03",
              title: "Improve",
              desc: "We deliver tailored recommendations to boost your AI and web visibility.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="space-y-2">
              <span className="text-xs font-mono text-blue-500">{step}</span>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        LLMRank · MBA Project · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
