const roles = [
  {
    title: "Sales",
    emoji: "💼",
    tagline: "For people who love hearing 'yes' and can't hear 'maybe'.",
    description:
      "We're building a category from scratch, which means you'll spend a lot of time explaining what AI visibility even is before you can sell it. You're a natural educator, a mild optimist, and you've never once described yourself as a 'closer' on a first date. You'll own the full SME sales motion — outreach, demos, pipeline — and report directly to the founders.",
    lookingFor: [
      "Experience selling SaaS or digital products to small businesses",
      "Comfortable with short sales cycles and high-volume outreach",
      "Fluent in 'let me show you a quick demo' energy",
    ],
  },
  {
    title: "AI Engineer",
    emoji: "🤖",
    tagline: "LLMs are your friends. Prompt injection is not.",
    description:
      "You'll be the person who makes our scoring engine smarter, faster, and less likely to embarrass us in a live demo. We're calling multiple LLMs, parsing unstructured outputs, and building recommendation logic that has to be useful, not just technically correct. If you've ever muttered 'the model is hallucinating again' while sounding totally calm, you'll fit right in.",
    lookingFor: [
      "Hands-on experience with LLM APIs (OpenAI, Anthropic, Gemini — bonus if all three)",
      "Ability to build robust pipelines that fail gracefully, not loudly",
      "Opinionated about evals, pragmatic about shipping",
    ],
  },
  {
    title: "Product Marketing Manager",
    emoji: "📣",
    tagline: "Translate 'AI visibility score' into something a gym owner cares about.",
    description:
      "Our target customer is a brilliant small business owner who has never once wondered how AI chatbots describe them — until now. Your job is to make them wonder, and then panic, and then buy our product. You'll own positioning, messaging, and go-to-market for a genuinely novel product category. If you enjoy making the complex feel obvious, this is your moment.",
    lookingFor: [
      "Experience positioning technical products to non-technical buyers",
      "A portfolio of copy that made people feel something (ideally mild urgency)",
      "Able to spot when a product demo is doing the marketing's job for it",
    ],
  },
];

export default function CareersPage() {
  return (
    <main className="flex-1 px-6 py-24 max-w-4xl mx-auto w-full">
      <div className="mb-16 text-center">
        <h1
          className="text-4xl font-bold text-[#1e2d4a] mb-4"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Join Us
        </h1>
        <p className="text-[#1e2d4a]/60 text-base max-w-xl mx-auto">
          We&apos;re a small team doing something genuinely new. If you&apos;re
          the kind of person who reads job descriptions looking for red flags and
          didn&apos;t find any here, that&apos;s probably a good sign.
        </p>
      </div>

      <div className="space-y-10">
        {roles.map((role) => (
          <div
            key={role.title}
            className="border border-[#1e2d4a]/10 rounded-2xl p-8 bg-white shadow-sm"
          >
            <div className="flex items-start gap-4 mb-4">
              <span className="text-3xl">{role.emoji}</span>
              <div>
                <h2
                  className="text-2xl font-semibold text-[#1e2d4a]"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  {role.title}
                </h2>
                <p className="text-[#1e2d4a]/50 text-sm italic mt-0.5">
                  {role.tagline}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[#1e2d4a] text-xs font-semibold uppercase tracking-widest mb-3">
                We&apos;re looking for
              </p>
              <ul className="space-y-2">
                {role.lookingFor.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[#1e2d4a]/70">
                    <span className="mt-0.5 text-[#1e2d4a]/30">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <p className="text-[#1e2d4a]/50 text-sm">
          Interested? Send a short note to{" "}
          <a
            href="mailto:careers@llmrank.ai"
            className="text-[#1e2d4a] underline underline-offset-2 hover:opacity-70 transition-opacity"
          >
            careers@llmrank.ai
          </a>{" "}
          — no cover letter required, just tell us why you.
        </p>
      </div>
    </main>
  );
}
