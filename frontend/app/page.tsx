"use client";

import { useState } from "react";
import type { BusinessProfile, Recommendation, RecommendationImpact } from "@/lib/types";

const FAKE_SCORES = {
  overall: 62,
  breakdown: [
    { model: "ChatGPT", score: 71, color: "bg-green-500" },
    { model: "Claude", score: 58, color: "bg-blue-500" },
    { model: "Gemini", score: 55, color: "bg-yellow-500" },
    { model: "Perplexity", score: 64, color: "bg-purple-500" },
  ],
};

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-medium text-gray-700">{score}/100</span>
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

function ScoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excellent", color: "text-green-600" };
  if (score >= 60) return { label: "Fair", color: "text-yellow-600" };
  return { label: "Poor", color: "text-red-500" };
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitted(true);
    setLoading(true);
    setProfile(null);
    setError(null);
    setRecommendations([]);
    setRecommendationsLoading(false);
    setRecommendationsError(false);

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
      setProfile(data.profile);

      // Kick off recommendations in the background after profile is ready
      setRecommendationsLoading(true);
      fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: data.profile }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.recommendations) setRecommendations(d.recommendations);
        })
        .catch(() => setRecommendationsError(true))
        .finally(() => setRecommendationsLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

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
              className="mt-8 flex flex-col sm:flex-row gap-3"
            >
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
            </form>
          ) : (
            <div className="mt-8 space-y-4 text-left">
              {/* URL confirmed */}
              <div className="px-4 py-3 rounded-lg border border-blue-100 bg-blue-50 flex items-center gap-3">
                <span className="text-blue-500 text-base">🔗</span>
                <p className="text-sm text-blue-700 break-all flex-1">{url}</p>
                <button
                  onClick={() => { setSubmitted(false); setProfile(null); setError(null); setRecommendations([]); setRecommendationsLoading(false); setRecommendationsError(false); }}
                  className="text-xs text-blue-400 hover:text-blue-600 whitespace-nowrap"
                >
                  Change
                </button>
              </div>

              {/* Loading state */}
              {loading && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-6 py-8 flex flex-col items-center gap-3 text-center">
                  <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                  <p className="text-sm text-gray-500">Extracting business info...</p>
                </div>
              )}

              {/* Error state */}
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
                        <h2 className="text-lg font-bold text-gray-900">{profile.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          {profile.type && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium capitalize">
                              {profile.type}
                            </span>
                          )}
                          {profile.location && (
                            <span className="text-xs text-gray-400">{profile.location}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-3 leading-relaxed">{profile.description}</p>
                  </div>

                  {profile.services.length > 0 && (
                    <div className="px-6 py-4 border-b border-gray-100">
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Services</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.services.map((s) => (
                          <span key={s} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="px-6 py-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Signals detected</p>
                    <div className="flex flex-wrap gap-2">
                      {[
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

              {/* Debug panel */}
              {profile && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setDebugOpen((o) => !o)}
                    className="w-full px-6 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Debug — Raw Profile</span>
                    <span className="text-xs text-gray-400">{debugOpen ? "▲ hide" : "▼ show"}</span>
                  </button>
                  {debugOpen && (
                    <pre className="px-6 py-4 text-xs text-gray-600 bg-white overflow-x-auto leading-relaxed">
                      {JSON.stringify(profile, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Recommendations section */}
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

              {/* Score card */}
              {profile && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                        LLM Relevance Score
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Fake data · scoring pipeline coming soon</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-gray-900">
                        {FAKE_SCORES.overall}
                        <span className="text-base font-normal text-gray-400">/100</span>
                      </p>
                      <p className={`text-xs font-semibold ${ScoreLabel(FAKE_SCORES.overall).color}`}>
                        {ScoreLabel(FAKE_SCORES.overall).label}
                      </p>
                    </div>
                  </div>

                  {/* Overall bar */}
                  <div className="px-6 py-4 border-b border-gray-100">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-700"
                        style={{ width: `${FAKE_SCORES.overall}%` }}
                      />
                    </div>
                  </div>

                  {/* Per-model breakdown */}
                  <div className="px-6 py-4 space-y-3">
                    {FAKE_SCORES.breakdown.map(({ model, score, color }) => (
                      <ScoreBar key={model} label={model} score={score} color={color} />
                    ))}
                  </div>
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
