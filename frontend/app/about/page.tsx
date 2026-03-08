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

export default function AboutPage() {
  return (
    <main className="flex-1 px-6 py-20">
      <div className="max-w-3xl mx-auto">

        {/* Hero */}
        <div className="mb-20">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#1e2d4a]/40 mb-4">
            About NLM
          </p>
          <h1
            className="text-5xl font-bold text-[#1e2d4a] mb-6 leading-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            AI is recommending businesses.<br />Is yours one of them?
          </h1>
          <p className="text-lg text-[#1e2d4a]/70 leading-relaxed max-w-2xl">
            When a potential customer asks ChatGPT, Claude, or Gemini for a recommendation,
            your business either appears — or it doesn't. NLM exists to make sure it does.
          </p>
        </div>

        {/* Why GEO section */}
        <div className="mb-20">
          <h2
            className="text-2xl font-bold text-[#1e2d4a] mb-4"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Why Generative Engine Optimisation matters
          </h2>
          <div className="space-y-4 text-[#1e2d4a]/70 leading-relaxed">
            <p>
              Search used to mean ten blue links. That model is changing fast. AI assistants now
              answer questions directly, surfacing a handful of businesses they deem most credible
              and relevant. Everyone else is invisible.
            </p>
            <p>
              You may have great reviews, a loyal customer base, and a well-run operation, but if
              the signals AI models rely on don't reflect that, you won't be recommended. Unlike
              traditional SEO, GEO targets the language models themselves: the structured data,
              content depth, review signals, and factual clarity that determine whether an AI
              includes you in its answer.
            </p>
          </div>
        </div>

        {/* Three steps */}
        <div className="mb-20">
          <h2
            className="text-2xl font-bold text-[#1e2d4a] mb-10"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            How NLM works
          </h2>

          <div className="space-y-px">
            {/* Step 1 */}
            <div className="flex gap-8 p-8 bg-[#1e2d4a] text-[#ece8e1] rounded-t-2xl">
              <div className="flex-shrink-0">
                <span
                  className="text-4xl font-bold opacity-30"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  01
                </span>
              </div>
              <div>
                <h3
                  className="text-xl font-bold mb-3"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  Measure
                </h3>
                <p className="text-[#ece8e1]/70 leading-relaxed">
                  We analyse your website and search the web to gain insights into your business.
                  From there we generate a unique set of queries, specific to those your customers
                  would ask LLMs, and then send those queries to ChatGPT, Claude, and Gemini in
                  real time. Your LLM Presence Score reflects how often each model mentions your
                  business, giving you a clear, quantified baseline.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-8 p-8 bg-[#1e2d4a]/80 text-[#ece8e1]">
              <div className="flex-shrink-0">
                <span
                  className="text-4xl font-bold opacity-30"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  02
                </span>
              </div>
              <div>
                <h3
                  className="text-xl font-bold mb-3"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  Recommend
                </h3>
                <p className="text-[#ece8e1]/70 leading-relaxed">
                  Based on what we observe, missing Schema markup, thin content, low review
                  volume, absent FAQ pages, we generate a prioritised action plan. Every
                  recommendation is grounded in actual gaps, not generic best-practice checklists.
                  High-impact, low-effort actions come first.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-8 p-8 bg-[#1e2d4a]/60 text-[#ece8e1] rounded-b-2xl">
              <div className="flex-shrink-0">
                <span
                  className="text-4xl font-bold opacity-30"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  03
                </span>
              </div>
              <div>
                <h3
                  className="text-xl font-bold mb-3"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  Implement
                </h3>
                <p className="text-[#ece8e1]/70 leading-relaxed">
                  Knowing what to fix is only half the battle. NLM's agent tier takes action on
                  your behalf — drafting blog posts, writing FAQ content, responding to reviews,
                  and updating your metadata — so your GEO improves continuously, without you
                  having to think about it. Set it up once; the agent keeps working.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Team */}
        <div className="mb-20">
          <h2
            className="text-2xl font-bold text-[#1e2d4a] mb-10"
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

          <div className="mt-8 text-center">
            <a
              href="/careers"
              className="inline-block bg-[#1e2d4a] text-[#ece8e1] text-sm font-medium px-8 py-3 rounded-full hover:bg-[#1e2d4a]/80 transition-colors"
            >
              Join the team
            </a>
          </div>
        </div>

        {/* CTA */}
        <div className="border border-[#1e2d4a]/10 rounded-2xl p-10 text-center">
          <h2
            className="text-2xl font-bold text-[#1e2d4a] mb-3"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            See where you stand
          </h2>
          <p className="text-[#1e2d4a]/60 mb-6 text-sm">
            Run a free LLM Presence Score for your business in under two minutes.
          </p>
          <a
            href="/"
            className="inline-block bg-[#1e2d4a] text-[#ece8e1] text-sm font-medium px-8 py-3 rounded-full hover:bg-[#1e2d4a]/80 transition-colors"
          >
            Get your score
          </a>
        </div>

      </div>
    </main>
  );
}
