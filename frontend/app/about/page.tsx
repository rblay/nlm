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
