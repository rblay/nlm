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
  { title: "Publish a blog or news section", whyItMatters: "Fresh content signals authority to LLMs, increasing the chance you're cited.", observed: "No blog or news section detected.", impact: "High", firstAction: "Write 2-3 posts covering common customer questions." },
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
  { id: "analyze",   label: "Reading your website",             status: "pending" },
  { id: "intents",   label: "Analysing key customer intent",    status: "pending" },
  { id: "chatgpt",   label: "Calculating ChatGPT visibility",   status: "pending" },
  { id: "claude",    label: "Calculating Claude visibility",    status: "pending" },
  { id: "gemini",    label: "Calculating Gemini visibility",    status: "pending" },
  { id: "recommend", label: "Generating recommendations",       status: "pending" },
  { id: "actions",   label: "Suggesting relevant actions",      status: "pending" },
];

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "loading")
    return <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 border-[#C9A644] border-t-transparent animate-spin" />;
  if (status === "done")
    return (
      <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-green-600 flex items-center justify-center">
        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 5l2.5 2.5L8 3" />
        </svg>
      </div>
    );
  if (status === "error")
    return (
      <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-red-600 flex items-center justify-center">
        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l4 4M7 3l-4 4" />
        </svg>
      </div>
    );
  return <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 border-white/20" />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LLM_META: Record<LLMProvider, { label: string; color: string }> = {
  openai:    { label: "ChatGPT", color: "bg-green-500" },
  anthropic: { label: "Claude",  color: "bg-blue-500"  },
  gemini:    { label: "Gemini",  color: "bg-[#C9A644]" },
};

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excellent", color: "text-green-400" };
  if (score >= 60) return { label: "Good",      color: "text-[#C9A644]" };
  if (score >= 40) return { label: "Fair",       color: "text-orange-400" };
  return { label: "Poor", color: "text-red-400" };
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
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="font-medium text-gray-300">
          {score}/100
          {mentions !== undefined && total !== undefined && (
            <span className="text-gray-600 font-normal ml-1">({mentions}/{total})</span>
          )}
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

const IMPACT_STYLES: Record<RecommendationImpact, string> = {
  High:   "bg-red-900/30 text-red-400 border border-red-800/30",
  Medium: "bg-amber-900/30 text-amber-400 border border-amber-800/30",
  Low:    "bg-white/[0.06] text-gray-400 border border-white/10",
};

// ─── Flip Card (Improvement) ──────────────────────────────────────────────────

function ImprovementFlipCard({
  recommendation,
  action,
  isFlipped,
  onFlip,
}: {
  recommendation: Recommendation;
  action?: ActionCard;
  isFlipped: boolean;
  onFlip: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  function handleCopy() {
    if (!action) return;
    navigator.clipboard.writeText(action.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flip-container w-full" style={{ height: "420px" }}>
      <div className={`flip-card-inner w-full h-full${isFlipped ? " is-flipped" : ""}`}>

        {/* Front: Problem */}
        <div className="flip-card-face flip-card-front bg-[#131720] border border-white/[0.08] rounded-2xl p-6 flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h3 className="text-white font-semibold text-base leading-snug">
              {recommendation.title}
            </h3>
            <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-medium flex-shrink-0 ${IMPACT_STYLES[recommendation.impact]}`}>
              {recommendation.impact}
            </span>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            {recommendation.whyItMatters}
          </p>
          <div className="text-xs text-gray-500 bg-white/[0.04] rounded-xl px-4 py-3 leading-relaxed">
            <span className="text-gray-400 font-medium">Observed: </span>
            {recommendation.observed}
          </div>
          <div className="flex-1" />
          <button
            onClick={onFlip}
            className="mt-6 w-full py-3 rounded-xl bg-[#C9A644] text-black font-semibold text-sm hover:bg-[#D4B44F] transition-colors"
          >
            What to do next →
          </button>
        </div>

        {/* Back: Action */}
        <div className="flip-card-face flip-card-back bg-[#131720] border border-[#C9A644]/20 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#C9A644]">
              Action plan
            </p>
            <button
              onClick={onFlip}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Back
            </button>
          </div>
          {action ? (
            <>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                {action.whyItMatters}
              </p>
              <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden">
                <pre
                  className={`text-xs px-4 py-4 h-full overflow-auto whitespace-pre-wrap leading-relaxed ${
                    action.contentType === "code"
                      ? "bg-black text-gray-300 font-mono"
                      : "bg-white/[0.04] text-gray-300"
                  }`}
                >
                  {action.content}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 text-xs px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              {action.isPlaceholder && (
                <p className="text-xs text-amber-500/60 mt-2 italic">
                  Template — customise before using.
                </p>
              )}
            </>
          ) : (
            <div className="bg-white/[0.04] rounded-xl px-4 py-4 flex-1">
              <p className="text-gray-300 text-sm leading-relaxed">
                {recommendation.firstAction}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  // New UI state
  const [profileCollapsed, setProfileCollapsed] = useState(true);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [signalsExpanded, setSignalsExpanded] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const carouselRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(0);

  const runScore = testingMode === "all" || testingMode === "score-only";
  const runRecommendations = testingMode === "all" || testingMode === "rec-only";

  // Measure carousel container width for card sizing
  useEffect(() => {
    if (!carouselRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setCardWidth(entry.contentRect.width * 0.88);
    });
    obs.observe(carouselRef.current);
    return () => obs.disconnect();
  }, [submitted]);

  // Auto-close modal when all steps finish
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

  function flipCard(i: number) {
    setFlippedCards((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function resetState() {
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
    setCarouselIndex(0);
    setFlippedCards(new Set());
    setProfileCollapsed(true);
    setServicesExpanded(false);
    setSignalsExpanded(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

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
    setCarouselIndex(0);
    setFlippedCards(new Set());

    const activeSteps: PipelineStep[] = [
      { id: "analyze",   label: "Reading your website",             status: "pending" },
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

    // Step 1: Read website & extract profile
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

    // Recommendations + actions (background)
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

    // Score
    if (runScore) {
      setStep("intents", { status: "loading" });
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

  // Combine recommendations + actions into a single carousel data source
  const improvements = recommendations.map((rec, i) => ({
    recommendation: rec,
    action: actions[i],
  }));

  return (
    <main className="min-h-screen bg-[#0c0e14] text-white flex flex-col">

      {/* Progress modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#131720] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-white">Analysing your business</h2>
              <p className="text-xs text-gray-500 mt-0.5 break-all">{url}</p>
            </div>
            <ul className="space-y-3">
              {steps.map((step) => (
                <li key={step.id} className="flex items-start gap-3">
                  <StepIcon status={step.status} />
                  <div className="min-w-0">
                    <span className={`text-sm ${
                      step.status === "pending" ? "text-gray-500" :
                      step.status === "error"   ? "text-red-400"  : "text-gray-200"
                    }`}>
                      {step.label}
                    </span>
                    {step.error && (
                      <p className="text-xs text-red-400 mt-1 font-mono break-words">{step.error}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {hasStepError && !isRunning && (
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2 text-sm text-gray-400 border border-white/10 rounded-xl hover:bg-white/[0.05] transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="px-8 py-5 flex items-center justify-between border-b border-white/[0.06]">
        <span
          className="font-bold text-[#C9A644] text-xl tracking-tight"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          NLM
        </span>
      </nav>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center px-4 py-20">
        <div className="max-w-xl w-full text-center space-y-6">

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C9A644]">
            Translating your business value into AI visibility
          </p>

          <h1
            className="text-5xl font-bold text-white leading-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Can people find you on LLMs?
          </h1>

          <p className="text-gray-400 text-lg leading-relaxed">
            Enter your website URL and we&apos;ll analyze how visible and accurately
            represented your business is across leading AI models, then suggest how
            to improve it.
          </p>

          {/* ── Pre-submit ── */}
          {!submitted ? (
            <>
              <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://yourbusiness.com"
                    required
                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#C9A644]/50 focus:border-[#C9A644]/50 text-sm"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#C9A644] text-black rounded-xl font-semibold text-sm hover:bg-[#D4B44F] transition-colors whitespace-nowrap"
                  >
                    Analyze →
                  </button>
                </div>
                <div className="flex items-center gap-3 px-1 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 whitespace-nowrap">Testing mode</span>
                    <select
                      value={testingMode}
                      onChange={(e) => setTestingMode(e.target.value as TestingMode)}
                      className="text-xs border border-white/10 rounded-lg px-2 py-1.5 text-gray-400 bg-[#131720] focus:outline-none focus:ring-2 focus:ring-[#C9A644]/40"
                    >
                      <option value="all">All</option>
                      <option value="score-only">LLM Score Only</option>
                      <option value="rec-only">Recommendations + Actions Only</option>
                      <option value="fake">Fake Data</option>
                    </select>
                  </div>
                  {(testingMode === "all" || testingMode === "score-only") && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 whitespace-nowrap">Queries per LLM</span>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={queryCount}
                        onChange={(e) => setQueryCount(Math.min(12, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 text-xs border border-white/10 rounded-lg px-2 py-1.5 text-center text-gray-400 bg-[#131720] focus:outline-none focus:ring-2 focus:ring-[#C9A644]/40"
                      />
                    </div>
                  )}
                </div>
              </form>

              {/* Analyze, Measure, Improve — only visible before submission */}
              <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
                {[
                  {
                    step: "01",
                    title: "Analyze",
                    desc: "We examine your website to understand your business, products, and positioning.",
                  },
                  {
                    step: "02",
                    title: "Measure",
                    desc: "We query multiple LLMs to see how, and if, they mention your business.",
                  },
                  {
                    step: "03",
                    title: "Improve",
                    desc: "We deliver tailored recommendations to boost your AI visibility.",
                  },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="space-y-2">
                    <span className="text-xs font-mono text-[#C9A644]">{step}</span>
                    <h3 className="font-semibold text-white">{title}</h3>
                    <p className="text-sm text-gray-500">{desc}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (

            /* ── Post-submit ── */
            <div className="mt-8 space-y-4 text-left">

              {/* URL chip */}
              <div className="px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04] flex items-center gap-3">
                <span className="text-[#C9A644] text-base">🔗</span>
                <p className="text-sm text-gray-300 break-all flex-1">{url}</p>
                <button
                  onClick={resetState}
                  className="text-xs text-gray-500 hover:text-gray-300 whitespace-nowrap transition-colors"
                >
                  Change
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-900/40 bg-red-900/20 px-6 py-4">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* ── Your Business (collapsed by default) ── */}
              {profile && (
                <div className="rounded-2xl border border-white/[0.08] bg-[#131720] overflow-hidden">
                  <button
                    onClick={() => setProfileCollapsed((c) => !c)}
                    className="w-full px-6 py-4 flex items-center gap-3 hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">
                      Your Business
                    </p>
                    <span className="text-sm font-semibold text-white truncate">{profile.name}</span>
                    {profile.type && (
                      <span className="text-xs bg-[#C9A644]/10 text-[#C9A644] px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0">
                        {profile.type}
                      </span>
                    )}
                    {profile.location && (
                      <span className="text-xs text-gray-500 truncate flex-shrink-0 hidden sm:block">{profile.location}</span>
                    )}
                    <span className="text-xs text-gray-600 ml-auto flex-shrink-0">
                      {profileCollapsed ? "▼" : "▲"}
                    </span>
                  </button>

                  {!profileCollapsed && (
                    <div className="border-t border-white/[0.06]">
                      <div className="px-6 py-4 border-b border-white/[0.06]">
                        <p className="text-sm text-gray-400 leading-relaxed">{profile.description}</p>
                      </div>

                      {profile.services.length > 0 && (
                        <div className="px-6 py-4 border-b border-white/[0.06]">
                          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                            Services
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(servicesExpanded ? profile.services : profile.services.slice(0, 4)).map((s) => (
                              <span
                                key={s}
                                className="text-xs bg-white/[0.05] text-gray-300 px-3 py-1.5 rounded-lg"
                              >
                                {s}
                              </span>
                            ))}
                            {!servicesExpanded && profile.services.length > 4 && (
                              <button
                                onClick={() => setServicesExpanded(true)}
                                className="text-xs text-[#C9A644] hover:text-[#D4B44F] px-2 py-1.5 transition-colors"
                              >
                                +{profile.services.length - 4} more
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="px-6 py-4">
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                          Signals detected
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const allSignals = [
                              { label: "Title tag",              active: !!profile.signals.titleTag },
                              { label: "Meta description",       active: profile.signals.hasMetaDescription },
                              { label: "Schema markup",          active: profile.signals.hasSchema },
                              { label: "Blog / News",            active: profile.signals.hasBlog },
                              { label: "FAQ page",               active: profile.signals.hasFAQ },
                              { label: "Social links",           active: profile.signals.socialLinks.length > 0 },
                              { label: "Google Maps embed",      active: profile.signals.hasMapsEmbed },
                              { label: "Google Business Profile", active: profile.signals.hasGoogleBusinessProfile },
                              ...(profile.signals.hasGoogleBusinessProfile ? [
                                { label: "GBP hours set",        active: profile.signals.gbpHasHours },
                                { label: `GBP photos (${profile.signals.gbpPhotoCount ?? 0})`, active: (profile.signals.gbpPhotoCount ?? 0) >= 10 },
                              ] : []),
                            ];
                            const visible = signalsExpanded ? allSignals : allSignals.slice(0, 5);
                            return (
                              <>
                                {visible.map(({ label, active }) => (
                                  <span
                                    key={label}
                                    className={`text-xs px-2.5 py-1.5 rounded-lg font-medium ${
                                      active
                                        ? "bg-green-900/30 text-green-400"
                                        : "bg-white/[0.04] text-gray-500"
                                    }`}
                                  >
                                    {active ? "✓" : "✗"} {label}
                                  </span>
                                ))}
                                {!signalsExpanded && allSignals.length > 5 && (
                                  <button
                                    onClick={() => setSignalsExpanded(true)}
                                    className="text-xs text-[#C9A644] hover:text-[#D4B44F] px-2 py-1.5 transition-colors"
                                  >
                                    +{allSignals.length - 5} more
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── AI Visibility Score — two-column layout ── */}
              {scoreResult && (
                <div className="rounded-2xl border border-white/[0.08] bg-[#131720] overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                      AI Visibility Score
                    </p>
                    <p className="text-xs text-gray-600">
                      {scoreResult.queries.length} queries · 3 AI models
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-white/[0.06]">
                    {/* Left: scores */}
                    <div className="px-6 py-5 space-y-5">
                      <div className="flex items-end gap-3">
                        <p className="text-5xl font-bold text-white leading-none">
                          {scoreResult.overallScore}
                        </p>
                        <div className="pb-1">
                          <span className="text-gray-500 text-sm">/100</span>
                          <p className={`text-xs font-semibold ${scoreLabel(scoreResult.overallScore).color}`}>
                            {scoreLabel(scoreResult.overallScore).label}
                          </p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#C9A644] transition-all duration-700"
                          style={{ width: `${scoreResult.overallScore}%` }}
                        />
                      </div>
                      <div className="space-y-3 pt-1">
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
                    </div>

                    {/* Right: what this means */}
                    <div className="px-6 py-5 border-t sm:border-t-0 border-white/[0.06]">
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                        What this means
                      </p>
                      {scoreResult.summary ? (
                        <p className="text-sm text-gray-400 leading-relaxed">
                          {scoreResult.summary}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-600 italic">No summary available.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Recommended Improvements carousel ── */}
              {profile && (
                recommendationsError ? (
                  <div className="rounded-xl border border-red-900/30 bg-red-900/10 px-5 py-3">
                    <p className="text-xs text-red-400">
                      Could not generate recommendations, check your OPENAI_API_KEY.
                    </p>
                  </div>
                ) : (recommendationsLoading || improvements.length > 0) && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                          Recommended Improvements
                        </p>
                        {!recommendationsLoading && improvements.length > 0 && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            {actionsLoading
                              ? "Generating action plans..."
                              : "Flip a card to see the action plan"}
                          </p>
                        )}
                      </div>
                      {(recommendationsLoading || actionsLoading) && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-700 border-t-[#C9A644] animate-spin" />
                          {recommendationsLoading ? "Analysing gaps..." : "Generating..."}
                        </div>
                      )}
                    </div>

                    {improvements.length > 0 && (
                      <>
                        {/* Carousel with next-card peek */}
                        <div ref={carouselRef} className="overflow-hidden w-full">
                          <div
                            className="flex transition-transform duration-300 ease-in-out"
                            style={{
                              transform:
                                cardWidth > 0
                                  ? `translateX(-${carouselIndex * (cardWidth + 16)}px)`
                                  : "none",
                            }}
                          >
                            {improvements.map((item, i) => (
                              <div
                                key={i}
                                style={{
                                  width: cardWidth > 0 ? `${cardWidth}px` : "88%",
                                  flexShrink: 0,
                                  marginRight: "16px",
                                }}
                              >
                                <ImprovementFlipCard
                                  recommendation={item.recommendation}
                                  action={item.action}
                                  isFlipped={flippedCards.has(i)}
                                  onFlip={() => flipCard(i)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Navigation dots */}
                        {improvements.length > 1 && (
                          <div className="flex items-center justify-center gap-2 pt-2">
                            {improvements.map((_, i) => (
                              <button
                                key={i}
                                onClick={() => setCarouselIndex(i)}
                                className={`rounded-full transition-all duration-200 ${
                                  i === carouselIndex
                                    ? "bg-[#C9A644] w-5 h-2"
                                    : "bg-white/20 hover:bg-white/35 w-2 h-2"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              )}

              {/* ── Debug panel ── */}
              {scoreResult && (
                <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
                  <button
                    onClick={() => setDebugOpen((o) => !o)}
                    className="w-full px-6 py-3 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="text-xs font-mono text-gray-600 uppercase tracking-widest">
                      Debug, Query x LLM Results
                    </span>
                    <span className="text-xs text-gray-600">
                      {debugOpen ? "▲ hide" : "▼ show"}
                    </span>
                  </button>

                  {debugOpen && (
                    <div className="overflow-x-auto">
                      <div className="px-6 py-4 border-b border-white/[0.06] bg-[#131720] grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
                            Common Customer Intents
                          </p>
                          <ol className="space-y-1">
                            {scoreResult.intents.map((intent, i) => (
                              <li key={i} className="text-xs text-gray-500">
                                <span className="font-mono text-gray-700 mr-2">
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                                {intent}
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
                            Generated Queries
                          </p>
                          <ol className="space-y-1">
                            {scoreResult.queries.map((q, i) => (
                              <li key={i} className="text-xs text-gray-400">
                                <span className="font-mono text-gray-700 mr-2">
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                                {q}
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>

                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                            <th className="text-left px-4 py-2 text-gray-600 font-medium w-1/2">Query</th>
                            <th className="text-left px-4 py-2 text-gray-600 font-medium">LLM</th>
                            <th className="text-left px-4 py-2 text-gray-600 font-medium">Mentioned</th>
                            <th className="text-left px-4 py-2 text-gray-600 font-medium">Latency</th>
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
                                  className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer"
                                  onClick={() => toggleRow(rowKey)}
                                >
                                  <td className="px-4 py-2 text-gray-400 max-w-xs truncate">{entry.query}</td>
                                  <td className="px-4 py-2 text-gray-500">{meta.label}</td>
                                  <td className="px-4 py-2">
                                    {entry.error ? (
                                      <span className="px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 font-medium">error</span>
                                    ) : entry.mentioned ? (
                                      <span className="px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 font-medium">yes</span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-600">no</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-gray-600 font-mono">
                                    {entry.error ? "—" : entry.latencyMs > 0 ? `${(entry.latencyMs / 1000).toFixed(1)}s` : "—"}
                                  </td>
                                  <td className="px-4 py-2 text-gray-600">{isExpanded ? "▲" : "▼"}</td>
                                </tr>
                                {isExpanded && (
                                  <tr className="bg-white/[0.02] border-b border-white/[0.04]">
                                    <td colSpan={5} className="px-4 py-3 leading-relaxed whitespace-pre-wrap">
                                      {entry.error
                                        ? <span className="text-red-400 font-mono text-xs">{entry.errorMessage ?? "Unknown error"}</span>
                                        : <span className="text-gray-500 text-xs">{entry.response || <span className="italic">No response</span>}</span>}
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
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6 text-center text-xs text-gray-600">
        NLM · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
