"use client";

import { useState } from "react";

const tiers = [
  {
    name: "Discover",
    price: "$49",
    goal: "See where you stand and what to fix.",
    description:
      "Get a clear picture of how AI assistants describe your business today, and a prioritised list of exactly what to improve.",
    features: [
      "Monthly AI visibility score across ChatGPT, Perplexity & Gemini",
      "Full recommendations report with gap analysis",
      "Ready-to-use action cards: schema markup, meta description, FAQ draft, blog post",
    ],
    cta: "Get started",
    highlight: false,
  },
  {
    name: "Optimize",
    price: "$99",
    goal: "Let the agent implement the fixes for you, automatically.",
    description:
      "Weekly monitoring plus an AI agent that writes, updates, and maintains your content so your score improves without manual effort.",
    features: [
      "Weekly AI visibility monitoring (4 score runs/month)",
      "2 AI-written blog posts per month",
      "Schema markup & meta updates applied automatically",
      "Review response drafts generated for new reviews",
      "Monthly progress report showing score movement",
    ],
    cta: "Get started",
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Grow",
    price: "$199",
    goal: "Maximum visibility velocity — agent on its most aggressive schedule.",
    description:
      "Daily monitoring and a high-frequency agent that keeps your content fresh, your reviews answered, and your AI presence ahead of competitors.",
    features: [
      "Daily AI visibility monitoring",
      "4 AI-written blog posts per month",
      "Weekly FAQ & schema refreshes",
      "Active review response drafting",
      "Priority support",
    ],
    cta: "Get started",
    highlight: false,
  },
];

function LeadCaptureModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="fixed inset-0 bg-[#1e2d4a]/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9aa3af] hover:text-[#1e2d4a] transition-colors text-lg leading-none"
        >
          ✕
        </button>

        {submitted ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1e2d4a]" style={{ fontFamily: "var(--font-playfair)" }}>
              You&apos;re on the list.
            </h2>
            <p className="text-sm text-[#6b7a8d] leading-relaxed">
              We&apos;ll be in touch shortly to discuss how NLM can improve your AI visibility.
            </p>
            <button
              onClick={onClose}
              className="mt-2 text-xs text-[#9aa3af] hover:text-[#1e2d4a] transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9aa3af] mb-2">
                NLM
              </p>
              <h2 className="text-2xl font-bold text-[#1e2d4a] leading-snug" style={{ fontFamily: "var(--font-playfair)" }}>
                Let the agent do it for you.
              </h2>
              <p className="text-sm text-[#6b7a8d] leading-relaxed mt-3">
                The NLM Marketing Agent handles your AI visibility improvements end-to-end — from publishing blog posts to updating your Schema markup. Leave your email and we&apos;ll reach out.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#1e2d4a]/15 bg-[#ece8e1]/40 text-[#1e2d4a] placeholder-[#9aa3af] focus:outline-none focus:ring-2 focus:ring-[#1e2d4a]/25 text-sm"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#1e2d4a] text-white font-semibold text-sm hover:bg-[#2c3e70] transition-colors"
              >
                Get early access →
              </button>
            </form>
            <p className="text-xs text-[#9aa3af] text-center">
              No spam. We&apos;ll only use this to follow up about NLM.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <main className="flex-1 px-6 py-20">
      {showModal && <LeadCaptureModal onClose={() => setShowModal(false)} />}

      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h1
          className="text-4xl font-bold text-[#1e2d4a] mb-4"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Simple, transparent pricing
        </h1>
        <p className="text-[#1e2d4a]/60 text-base leading-relaxed">
          Every plan includes a full AI visibility score across ChatGPT, Perplexity,
          and Gemini. Upgrade to let our agent handle the improvements for you.
        </p>
      </div>

      {/* Cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative flex flex-col rounded-2xl px-8 py-10 ${
              tier.highlight
                ? "bg-[#1e2d4a] text-white shadow-2xl"
                : "bg-white text-[#1e2d4a] shadow-md"
            }`}
          >
            {/* Badge */}
            {tier.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#c8a96e] text-white text-xs font-semibold px-4 py-1 rounded-full tracking-wide">
                {tier.badge}
              </span>
            )}

            {/* Tier name */}
            <p
              className={`text-xs font-semibold uppercase tracking-widest mb-2 ${
                tier.highlight ? "text-white/50" : "text-[#1e2d4a]/40"
              }`}
            >
              {tier.name}
            </p>

            {/* Price */}
            <div className="mb-6">
              <span
                className="text-5xl font-bold"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                {tier.price}
              </span>
              <span
                className={`text-sm ml-1 ${
                  tier.highlight ? "text-white/50" : "text-[#1e2d4a]/40"
                }`}
              >
                / month
              </span>
            </div>

            {/* Goal */}
            <div
              className={`mb-4 rounded-lg px-4 py-3 ${
                tier.highlight ? "bg-white/10" : "bg-[#1e2d4a]/5"
              }`}
            >
              <p
                className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${
                  tier.highlight ? "text-white/50" : "text-[#1e2d4a]/40"
                }`}
              >
                Goal
              </p>
              <p
                className={`text-sm font-medium leading-snug ${
                  tier.highlight ? "text-white" : "text-[#1e2d4a]"
                }`}
              >
                {tier.goal}
              </p>
            </div>

            {/* Description */}
            <p
              className={`text-sm leading-relaxed mb-6 ${
                tier.highlight ? "text-white/70" : "text-[#1e2d4a]/60"
              }`}
            >
              {tier.description}
            </p>

            {/* Features */}
            <ul className="space-y-3 mb-8 flex-1">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <span
                    className={`mt-0.5 shrink-0 text-base leading-none ${
                      tier.highlight ? "text-[#c8a96e]" : "text-[#1e2d4a]/40"
                    }`}
                  >
                    ✓
                  </span>
                  <span
                    className={
                      tier.highlight ? "text-white/80" : "text-[#1e2d4a]/80"
                    }
                  >
                    {f}
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={() => setShowModal(true)}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 cursor-pointer ${
                tier.highlight
                  ? "bg-white text-[#1e2d4a]"
                  : "bg-[#1e2d4a] text-white"
              }`}
            >
              {tier.cta} →
            </button>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-center text-[#1e2d4a]/40 text-xs mt-12">
        All plans start with a free scan — no card required.
      </p>
    </main>
  );
}
