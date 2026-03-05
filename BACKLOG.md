# NLM / LLMRank — Project Backlog

## Current State (as of March 2026, PR #11)

- `/api/analyze` returns a full `BusinessProfile` (name, type, location, description, services, signals)
- Observable signals detected from HTML: Schema markup, blog, FAQ, social links, Maps embed, meta description, title tag
- Observable signals enriched via Google Places API: GBP confirmed, real review count/rating, opening hours, photo count
- `/api/recommend` is live — gap-based recommendations grounded in signals, ordered by impact (High/Medium/Low)
- `/api/score` is live — two-step intent-driven query generation + real LLM queries with live web search
- Frontend shows: business profile card, signals grid, real per-LLM scores, recommendation cards, scoring debug panel
- All three LLMs working: OpenAI (gpt-4o-mini), Anthropic (claude-haiku-4-5), Google (gemini-2.5-flash)
- Query count configurable via `queryCount` param on `/api/score` (default 3 to reduce token burn)
- Anthropic calls run sequentially to avoid 50k token/min rate limit; OpenAI + Gemini run in parallel
- Failed LLM calls show red "error" badge + error message in debug table

---

## DEMO MVP — Priority Tasks

---

### Step 1: URL Extraction + LLM Presence Score (Real Pipeline)

**1.1 ✅ — Return business profile to the frontend**

**1.2 ✅ — Enrich business profile with observable signals**
- HTML signals: Schema.org, blog/news, FAQ, social links, Maps embed, meta description, title tag
- Google Places API: GBP confirmed, review count/rating, opening hours, photo count

**1.3 ✅ — Generate contextual queries from business profile**
- Two-step: first generate 8 common customer intents for the business type, then turn each into a location-aware discovery query
- Queries never include the business name (pure discovery test); area-anchored for multi-location businesses
- Intents and queries both returned in `ScoreResult` and shown in the debug panel

**1.4 ✅ — Query LLMs and detect business mentions**
- OpenAI: gpt-4o-mini via Responses API + web_search tool (parallel)
- Anthropic: claude-haiku-4-5 + web_search_20250305 server-side tool (sequential to avoid rate limits)
- Google: gemini-2.5-flash via @google/genai SDK + googleSearch grounding (parallel)
- Detection: case-insensitive match of business name or domain in response
- Score per LLM = mentions / total queries × 100; overall = average across LLMs
- Failed calls surface error message in debug table

**1.5 ✅ — Wire real scores to the UI**
- Real scores from `/api/score` replace hardcoded `FAKE_SCORES`
- Two-step loading state: "Extracting business info..." → "Querying AI models with live web search..."
- Per-LLM progress bars with mention counts displayed

**1.6 — Handle errors gracefully**
- If a URL is unreachable, show a friendly error and let the user try again
- Cap analysis time with a timeout; show partial results if some LLM calls fail

---

### Step 2: Recommendations

**2.1 ✅ — Define recommendation categories**

| Category | Signal source |
|---|---|
| Google Business Profile | Places API — confirmed/not |
| GBP completeness (hours, photos) | Places API |
| Schema.org markup | HTML scrape |
| Review volume and recency | Places API |
| Title tag and meta description | HTML scrape |
| Blog / fresh content | HTML scrape |
| FAQ page | HTML scrape |
| Social presence | HTML scrape |
| Local directory citations | Not yet detected |
| NAP consistency | Not yet detected |

**2.2 ✅ — Ground recommendations in observed signals**

**2.3 ✅ — Display recommendations in the UI**

---

### Step 3: Debug Tab (Developer View)

**3.1 ✅ — Raw profile debug panel** (collapsible JSON — already shipped)

**3.2 ✅ — Scoring debug table**
- Collapsible panel showing common customer intents + generated queries side by side
- Table: one row per (query, LLM) — columns: Query | LLM | Mentioned (yes/no) | Response (expandable) | Latency

---

### Step 4: Online Presence Improvement (Post-Demo / Subscription Tier)

**4.1 — Integration options (to research and decide)**
- **Google Business Profile API**: Read/write access to business info, post updates, respond to reviews
- **Google Analytics / Search Console**: Pull traffic and keyword data to inform content strategy
- **Website CMS**: Webflow, Squarespace, or WordPress APIs for publishing blog posts and updating metadata

**4.2 — Agent capabilities (ideas)**
- Weekly blog post generation based on local trends, seasonal hooks, and business keywords
- Automated response drafts for Google Reviews (owner approves before posting)
- Monthly "LLM visibility report" comparing score over time
- One-click apply for Schema markup improvements

**4.3 — Subscription model considerations**
- Free tier: one-time URL scan + score + basic recommendations
- Paid tier ($X/month): continuous monitoring, automated content actions, integrations
- Main onboarding friction: Google OAuth for GBP + Analytics access

---

## Technical Decisions / Open Questions

- **LLM providers**: OpenAI (gpt-4o-mini), Anthropic (claude-haiku-4-5), Google (gemini-2.5-flash) — all real and working for demo.
- **Score definition**: "mentions / total queries" — simple and explainable for the class.
- **Streaming vs. polling**: Full pipeline will be slow. Server-Sent Events are the cleanest UX solution; polling a job ID is simpler to implement.
- **Caching**: Cache results per domain so repeated demo submissions are instant and don't burn API credits.
- **Naming**: The README says "LLMRank", the UI says "LLMRank", the project folder is "nlm". Decide on a canonical name before the demo.
- **Backend architecture**: Keeping everything in Next.js API routes for the demo. Main risk is the ~30–60s pipeline hitting Vercel's default timeout — mitigate with SSE or separate small API calls.
