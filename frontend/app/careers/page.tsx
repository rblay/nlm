const team = [
  {
    name: "Nicolas Raffel Torrebiarte",
    role: "Co-founder",
    bio: "Former founder with experience in scaling small businesses, from early traction to sustainable revenue. Nicolas leads NLM's strategy and go-to-market.",
    photo: "/nicolas.jpg",
    linkedin: "https://www.linkedin.com/in/nicolas-raffel-torrebiarte-680629173/",
  },
  {
    name: "Rafael Caspary Blay",
    role: "Co-founder",
    bio: "Data Scientist with a track record in marketing optimisation, from predictive modelling to multi-channel attribution. Rafael leads the scoring engine and LLM infrastructure at NLM.",
    photo: "/rafael.jpg",
    linkedin: "https://www.linkedin.com/in/rblay/",
  },
];

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

      {/* Team */}
      <div className="mb-16">
        <h2
          className="text-2xl font-bold text-[#1e2d4a] mb-8 text-center"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          The team
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {team.map((member) => (
            <div
              key={member.name}
              className="border border-[#1e2d4a]/10 rounded-2xl p-6 bg-white"
            >
              <div className="flex items-center gap-4 mb-4">
                <img
                  src={member.photo}
                  alt={member.name}
                  className="w-16 h-16 rounded-xl object-cover object-top flex-shrink-0"
                />
                <div>
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#1e2d4a] leading-tight hover:underline underline-offset-2"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    {member.name}
                  </a>
                  <p className="text-xs text-[#1e2d4a]/50 mt-0.5">{member.role}</p>
                </div>
              </div>
              <p className="text-sm text-[#1e2d4a]/70 leading-relaxed mb-4">{member.bio}</p>
              <a
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1e2d4a]/50 hover:text-[#1e2d4a] transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.27c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.76-1.75 1.76zm13.5 11.27h-3v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97v5.7h-3v-10h2.88v1.36h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.59v5.61z" />
                </svg>
                LinkedIn
              </a>
            </div>
          ))}
        </div>
      </div>

      <h2
        className="text-2xl font-bold text-[#1e2d4a] mb-8 text-center"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        Open roles
      </h2>

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
