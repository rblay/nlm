"use client";

import React, { useState } from "react";
import type {
  BusinessProfile,
  Recommendation,
  RecommendationImpact,
  ScoreResult,
  LLMProvider,
  ActionCard,
} from "@/lib/types";

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
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
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
  const [runScore, setRunScore] = useState(true);
  const [runRecommendations, setRunRecommendations] = useState(true);

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

    // ── Step 1: Extract business profile ────────────────────────────────────
    setLoadingStatus("Extracting business info...");
    let fetchedProfile: BusinessProfile;
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server error (${res.status}) — check your .env.local API keys`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      fetchedProfile = data.profile;
      setProfile(fetchedProfile);

      // Kick off recommendations + actions in the background after profile is ready
      if (runRecommendations) {
        setRecommendationsLoading(true);
        fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: fetchedProfile }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.recommendations) setRecommendations(d.recommendations);
          })
          .catch(() => setRecommendationsError(true))
          .finally(() => setRecommendationsLoading(false));

        setActionsLoading(true);
        fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: fetchedProfile, url }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.actions) setActions(d.actions);
          })
          .catch(() => {})
          .finally(() => setActionsLoading(false));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoadingStatus(null);
      return;
    }

    // ── Step 2: Generate queries + score across LLMs ─────────────────────────
    if (runScore) {
      setLoadingStatus("Generating customer queries...");
      try {
        await new Promise((r) => setTimeout(r, 400));
        setLoadingStatus("Querying AI models with live web search... (this takes ~30s)");

        const res = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, profile: fetchedProfile }),
        });
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error(`Scoring error (${res.status}) — check your API keys`);
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Scoring failed");
        setScoreResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scoring failed");
      } finally {
        setLoadingStatus(null);
      }
    } else {
      setLoadingStatus(null);
    }
  }

  const isLoading = loadingStatus !== null;

  return (
    <main className="min-h-screen bg-white flex flex-col">
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
              <div className="flex items-center gap-5 px-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={runScore}
                    onChange={(e) => setRunScore(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500">AI Visibility Score</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={runRecommendations}
                    onChange={(e) => setRunRecommendations(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500">Recommendations & Actions</span>
                </label>
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
                    setLoadingStatus(null);
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

              {/* Loading state */}
              {isLoading && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-6 py-8 flex flex-col items-center gap-3 text-center">
                  <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                  <p className="text-sm text-gray-500">{loadingStatus}</p>
                </div>
              )}

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
