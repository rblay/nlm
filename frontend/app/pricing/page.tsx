const tiers = [
  {
    name: "Discover",
    price: "$49",
    goal: "See where you stand and what to fix.",
    description:
      "Get a clear picture of how AI assistants describe your business today, and a prioritised list of exactly what to improve.",
    features: [
      "Monthly AI visibility score across ChatGPT, Claude & Gemini",
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

export default function PricingPage() {
  return (
    <main className="flex-1 px-6 py-20">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h1
          className="text-4xl font-bold text-[#1e2d4a] mb-4"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Simple, transparent pricing
        </h1>
        <p className="text-[#1e2d4a]/60 text-base leading-relaxed">
          Every plan includes a full AI visibility score across ChatGPT, Claude,
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
