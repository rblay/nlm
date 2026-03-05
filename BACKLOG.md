# NLM / LLMRank — Project Backlog

## Current State (as of March 2026, PR #8)

- `/api/analyze` returns a full `BusinessProfile` (name, type, location, description, services, signals)
- Observable signals detected from HTML: Schema markup, blog, FAQ, social links, Maps embed, meta description, title tag
- Observable signals enriched via Google Places API: GBP confirmed, real review count/rating, opening hours, photo count
- `/api/recommend` is live — gap-based recommendations grounded in signals, ordered by impact (High/Medium/Low)
- Frontend shows: business profile card, signals grid, recommendation cards, debug panel (raw profile JSON)
- Scoring pipeline still shows **hardcoded fake scores** — real pipeline pending (peer's workstream)

---

## DEMO MVP — Priority Tasks

---

### Step 1: URL Extraction + LLM Presence Score (Real Pipeline)

**1.1 ✅ — Return business profile to the frontend**

**1.2 ✅ — Enrich business profile with observable signals**
- HTML signals: Schema.org, blog/news, FAQ, social links, Maps embed, meta description, title tag
- Google Places API: GBP confirmed, review count/rating, opening hours, photo count

**1.3 — Generate contextual queries from business profile**
- After extracting business info, use an LLM to generate 6–10 natural language queries a real customer might ask an AI assistant
- Queries should vary in phrasing, intent, and specificity
- Return the list of queries so they can be shown in the UI and the debug tab

**1.4 — Query LLMs and detect business mentions**
- For each generated query, call all three LLMs in parallel and record the full response text
- **Demo LLMs**: OpenAI (GPT-4o-mini), Anthropic (Claude Haiku), Google Gemini (gemini-1.5-flash)
- Detection logic: case-insensitive match of the business name or domain in the response text
- Score per LLM = mentions / total queries (expressed as a percentage)
- Overall score = average across all LLMs
- Store (query, LLM, response, mentioned: bool, latencyMs) for each call

**1.5 — Wire real scores to the UI**
- Replace `FAKE_SCORES` constant with data returned from `/api/score`
- Add loading state with status messages ("Generating queries...", "Querying LLMs...")
- Display per-LLM bar chart with real scores

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

**3.2 — Scoring debug table** (peer's workstream)
- One row per (query, LLM) combination
- Columns: Query | LLM | Mentioned (yes/no) | Response (collapsed, expandable) | Latency

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

- **LLM providers**: OpenAI (GPT-4o-mini), Anthropic (Claude Haiku), Google Gemini (gemini-1.5-flash) — all real for demo.
- **Score definition**: "mentions / total queries" — simple and explainable for the class.
- **Streaming vs. polling**: Full pipeline will be slow. Server-Sent Events are the cleanest UX solution; polling a job ID is simpler to implement.
- **Caching**: Cache results per domain so repeated demo submissions are instant and don't burn API credits.
- **Naming**: The README says "LLMRank", the UI says "LLMRank", the project folder is "nlm". Decide on a canonical name before the demo.
- **Backend architecture**: Keeping everything in Next.js API routes for the demo. Main risk is the ~30–60s pipeline hitting Vercel's default timeout — mitigate with SSE or separate small API calls.
