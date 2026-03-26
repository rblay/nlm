"use client";

import { useState, useEffect } from "react";
import type { BusinessProfile, ScoreResult, ActionCard } from "@/lib/types";
import type { CachedClient } from "@/app/api/admin/clients/route";

type Stage =
  | { id: "idle" }
  | { id: "loading-actions" }
  | { id: "analyzing" }
  | { id: "scoring" }
  | { id: "generating" }
  | { id: "done" }
  | { id: "error"; message: string };

interface PipelineResult {
  profile: BusinessProfile;
  scoreResult: ScoreResult;
  actions: ActionCard[];
  newsletter: string;
}

const STAGE_LABELS: Record<string, string> = {
  "loading-actions": "Loading actions…",
  analyzing:         "Scanning website…",
  scoring:           "Querying ChatGPT, Perplexity & Gemini…",
  generating:        "Generating newsletter…",
};

function scoreColour(score: number) {
  if (score >= 60) return "text-emerald-600";
  if (score >= 35) return "text-amber-500";
  return "text-red-500";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminNewsletterPage() {
  const [clients, setClients] = useState<CachedClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [url, setUrl] = useState("");
  const [businessNames, setBusinessNames] = useState("");
  const [queryCount, setQueryCount] = useState(6);

  const [stage, setStage] = useState<Stage>({ id: "idle" });
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Load known clients from DB on mount
  useEffect(() => {
    fetch("/api/admin/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []))
      .catch(() => setClients([]))
      .finally(() => setClientsLoading(false));
  }, []);

  // ── Load a cached client directly ────────────────────────────────────────
  async function handleSelectClient(client: CachedClient) {
    setResult(null);
    setCopied(false);
    setUrl(client.url);

    const profile = client.profileSnapshot as BusinessProfile;
    const scoreResult: ScoreResult = {
      overallScore: client.overallScore,
      perLLM: client.perLLM as ScoreResult["perLLM"],
      intents: client.intents as string[],
      queries: client.queries as string[],
      debug: client.debug as ScoreResult["debug"],
      summary: client.summary,
    };

    try {
      setStage({ id: "loading-actions" });
      const actionsRes = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, url: client.url }),
      });
      if (!actionsRes.ok) throw new Error("Failed to generate actions");
      const { actions }: { actions: ActionCard[] } = await actionsRes.json();

      setStage({ id: "generating" });
      const newsletterRes = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, scoreResult, actions, url: client.url }),
      });
      if (!newsletterRes.ok) throw new Error("Failed to generate newsletter");
      const { text }: { text: string } = await newsletterRes.json();

      setResult({ profile, scoreResult, actions, newsletter: text });
      setStage({ id: "done" });
    } catch (err) {
      setStage({ id: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  // ── Run full pipeline for a new URL ──────────────────────────────────────
  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setResult(null);
    setCopied(false);

    try {
      setStage({ id: "analyzing" });
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!analyzeRes.ok) throw new Error("Failed to analyze website");
      const { profile }: { profile: BusinessProfile } = await analyzeRes.json();

      setStage({ id: "scoring" });
      const [scoreRes, actionsRes] = await Promise.all([
        fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim(),
            profile,
            queryCount,
            businessNames: businessNames.trim() || undefined,
          }),
        }),
        fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, url: url.trim() }),
        }),
      ]);
      if (!scoreRes.ok) throw new Error("Scoring failed — check your API keys");
      if (!actionsRes.ok) throw new Error("Failed to generate actions");
      const scoreResult: ScoreResult = await scoreRes.json();
      const { actions }: { actions: ActionCard[] } = await actionsRes.json();

      setStage({ id: "generating" });
      const newsletterRes = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, scoreResult, actions, url: url.trim() }),
      });
      if (!newsletterRes.ok) throw new Error("Failed to generate newsletter");
      const { text }: { text: string } = await newsletterRes.json();

      setResult({ profile, scoreResult, actions, newsletter: text });
      setStage({ id: "done" });

      // Refresh client list so new business appears
      fetch("/api/admin/clients")
        .then((r) => r.json())
        .then((d) => setClients(d.clients ?? []));
    } catch (err) {
      setStage({ id: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.newsletter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const isRunning = ["loading-actions", "analyzing", "scoring", "generating"].includes(stage.id);

  return (
    <main className="min-h-screen bg-[#ece8e1] text-[#1e2d4a]">
      <div className="max-w-6xl mx-auto p-8 space-y-6">

        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#9aa3af]">NLM Internal</p>
          <h1 className="text-2xl font-bold mt-1" style={{ fontFamily: "var(--font-playfair)" }}>
            Client Newsletter Generator
          </h1>
        </div>

        <div className="grid grid-cols-[320px_1fr] gap-6 items-start">

          {/* ── Left: client list + new URL form ──────────────────────────── */}
          <div className="space-y-4">

            {/* Known clients */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e0dbd3]">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#9aa3af]">
                  Known clients
                </p>
                <p className="text-xs text-[#b0b8c3] mt-0.5">From cache — click to generate</p>
              </div>

              {clientsLoading ? (
                <div className="px-4 py-6 text-center text-sm text-[#b0b8c3]">Loading…</div>
              ) : clients.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[#b0b8c3]">
                  No cached clients yet.<br />Run a URL below to add one.
                </div>
              ) : (
                <ul className="divide-y divide-[#e0dbd3]">
                  {clients.map((client) => (
                    <li key={client.id}>
                      <button
                        onClick={() => handleSelectClient(client)}
                        disabled={isRunning}
                        className="w-full text-left px-4 py-3 hover:bg-[#f7f5f2] transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#1e2d4a] truncate">{client.businessName}</p>
                          <span className={`text-sm font-bold flex-shrink-0 ${scoreColour(client.overallScore)}`}>
                            {client.overallScore}
                          </span>
                        </div>
                        <p className="text-xs text-[#9aa3af] truncate mt-0.5">{client.url}</p>
                        <p className="text-xs text-[#b0b8c3] mt-0.5">
                          Scanned {timeAgo(client.cachedAt)} · {client.queryCount} queries
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* New URL form */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#9aa3af]">New client</p>
              <form onSubmit={handleGenerate} className="space-y-3">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.example.com"
                  required
                  className="w-full rounded-xl border border-[#e0dbd3] px-3 py-2 text-sm text-[#1e2d4a] placeholder:text-[#b0b8c3] focus:outline-none focus:ring-2 focus:ring-[#1e2d4a]/20"
                />
                <input
                  type="text"
                  value={businessNames}
                  onChange={(e) => setBusinessNames(e.target.value)}
                  placeholder="Extra names (optional)"
                  className="w-full rounded-xl border border-[#e0dbd3] px-3 py-2 text-sm text-[#1e2d4a] placeholder:text-[#b0b8c3] focus:outline-none focus:ring-2 focus:ring-[#1e2d4a]/20"
                />
                <div className="flex gap-2">
                  <select
                    value={queryCount}
                    onChange={(e) => setQueryCount(Number(e.target.value))}
                    className="rounded-xl border border-[#e0dbd3] px-3 py-2 text-sm text-[#1e2d4a] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e2d4a]/20"
                  >
                    {[3, 6, 9, 12].map((n) => (
                      <option key={n} value={n}>{n} queries</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={isRunning || !url.trim()}
                    className="flex-1 py-2 rounded-xl bg-[#1e2d4a] text-white font-semibold text-sm hover:bg-[#2c3e70] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRunning ? "Running…" : "Run"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* ── Right: output ─────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Idle state */}
            {stage.id === "idle" && !result && (
              <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-[#b0b8c3]">
                <p className="text-sm">Select a client from the list or enter a new URL to generate their newsletter.</p>
              </div>
            )}

            {/* Progress */}
            {isRunning && (
              <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
                {(["analyzing", "scoring", "loading-actions", "generating"] as const)
                  .filter((s) => {
                    // For cached flow, skip analyze/scoring steps
                    if (stage.id === "loading-actions" || stage.id === "generating") {
                      return s === "loading-actions" || s === "generating";
                    }
                    return s === "analyzing" || s === "scoring" || s === "generating";
                  })
                  .map((s) => {
                    const order = ["analyzing", "scoring", "loading-actions", "generating"];
                    const currentIdx = order.indexOf(stage.id);
                    const thisIdx = order.indexOf(s);
                    const current = stage.id === s;
                    const done = thisIdx < currentIdx;
                    return (
                      <div key={s} className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full flex-shrink-0 transition-all ${
                          done    ? "bg-emerald-500" :
                          current ? "bg-[#1e2d4a] animate-pulse" :
                                    "bg-[#e0dbd3]"
                        }`} />
                        <span className={`text-sm ${current ? "text-[#1e2d4a] font-medium" : done ? "text-[#6b7a8d]" : "text-[#b0b8c3]"}`}>
                          {STAGE_LABELS[s]}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Error */}
            {stage.id === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                <p className="text-sm text-red-600 font-medium">{stage.message}</p>
              </div>
            )}

            {/* Result */}
            {result && (
              <>
                {/* Score strip */}
                <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between gap-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#9aa3af]">Business</p>
                    <p className="text-lg font-bold text-[#1e2d4a] mt-0.5">{result.profile.name}</p>
                    <p className="text-sm text-[#6b7a8d]">
                      {result.profile.type}{result.profile.location ? ` · ${result.profile.location}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#9aa3af]">AI Visibility</p>
                    <p className={`text-4xl font-bold mt-0.5 ${scoreColour(result.scoreResult.overallScore)}`}>
                      {result.scoreResult.overallScore}
                      <span className="text-lg font-normal text-[#9aa3af]">/100</span>
                    </p>
                  </div>
                  <div className="flex-shrink-0 space-y-1.5">
                    {result.scoreResult.perLLM.map((s) => (
                      <div key={s.llm} className="flex items-center gap-2">
                        <span className="text-xs text-[#9aa3af] w-20">
                          {s.llm === "openai" ? "ChatGPT" : s.llm.charAt(0).toUpperCase() + s.llm.slice(1)}
                        </span>
                        <div className="w-28 h-1.5 bg-[#e0dbd3] rounded-full overflow-hidden">
                          <div className="h-full bg-[#1e2d4a] rounded-full transition-all" style={{ width: `${s.score}%` }} />
                        </div>
                        <span className="text-xs text-[#6b7a8d] w-8 text-right">{s.score}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Newsletter */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e0dbd3]">
                    <p className="text-sm font-semibold text-[#1e2d4a]">Newsletter — ready to copy</p>
                    <button
                      onClick={handleCopy}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        copied
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-[#1e2d4a] text-white hover:bg-[#2c3e70]"
                      }`}
                    >
                      {copied ? "Copied!" : "Copy to clipboard"}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={result.newsletter}
                    className="w-full h-[640px] px-5 py-4 text-xs font-mono text-[#1e2d4a] leading-relaxed resize-none focus:outline-none bg-white"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
