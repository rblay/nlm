# NLM / LLMRank — Project Backlog

## Current State (as of March 2026, PR #13)

- `/api/analyze` returns a full `BusinessProfile` (name, type, location, description, services, signals)
- Observable signals detected from HTML: Schema markup, blog, FAQ, social links, Maps embed, meta description, title tag
- Observable signals enriched via Google Places API: GBP confirmed, real review count/rating, opening hours, photo count
- `/api/recommend` is live — gap-based recommendations grounded in signals, ordered by impact (High/Medium/Low)
- `/api/score` is live — two-step intent-driven query generation + real LLM queries with live web search
- Frontend shows: business profile card, signals grid, real per-LLM scores, recommendation cards, scoring debug panel
- All three LLMs working: OpenAI (gpt-4o-mini), Anthropic (claude-haiku-4-5), Google (gemini-2.5-flash)
- `queryCount` param on `/api/score` (default 3) controls how many queries are run — reduces token burn
- Anthropic runs sequentially to avoid 50k token/min rate limit; OpenAI + Gemini run in parallel
- Failed LLM calls show red "error" badge + error message in the debug table
- `/api/actions` is live — generates copy-paste action cards from detected signal gaps, no LLM calls
- Frontend: actions section with copy button, impact badges, "template" badge for placeholder content
- UI checkboxes to selectively run AI Visibility Score and/or Recommendations & Actions

---

## DEMO MVP — Priority Tasks

---

### Step 1: URL Extraction + LLM Presence Score (Real Pipeline)

**1.1 ✅ — Return business profile to the frontend**

**1.2 ✅ — Enrich business profile with observable signals**
- HTML signals: Schema.org, blog/news, FAQ, social links, Maps embed, meta description, title tag
- Google Places API: GBP confirmed, review count/rating, opening hours, photo count

**1.3 ✅ — Generate contextual queries from business profile**
- Two-step: first generate 12 customer intents covering all 9 GEO intent buckets, then turn each into a location-aware discovery query
- 9 buckets: Discovery, Fit/Persona, Constraints, Quality/Trust, Experience/Vibe, Price/Value, Comparison, Logistics/Process, Problem-based (3 intents)
- Category detection (fitness / restaurant / beauty / other) feeds curated problem dictionaries for Problem-based bucket
- Intents grounded in actual business description + services (constraints and problems never invented)
- Queries never include the business name (pure discovery test); area-anchored for multi-location businesses; goal-first for problem/persona intents
- Intents and queries both returned in `ScoreResult` and shown in the debug panel

**1.4 ✅ — Query LLMs and detect business mentions**
- All three LLMs queried with live web search enabled
- OpenAI: gpt-4o-mini via Responses API + web_search tool (all 12 in parallel)
- Anthropic: claude-haiku-4-5 + web_search_20250305 — batched 3-at-a-time with 2s delay + retry-with-backoff on 429
- Google: gemini-2.5-flash via @google/genai SDK + googleSearch grounding (all 12 in parallel)
- Detection: fuzzy alias matching — strips business-type suffixes to find short brand name (e.g. "Revival PT Studio" → "revival"), checks domain stem, multi-token combos; case-insensitive
- Score per LLM = mentions / total queries × 100; overall = average across LLMs
- `queryCount` param (default 3) controls query volume; failed calls surface error in debug table

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

### Step 4: Actions Tab (Demo MVP — copy-paste content for owners)

Goal: give business owners ready-to-use content and instructions based on their specific gaps. Only show actions relevant to detected gaps.

**Card anatomy**: title + impact badge (High/Medium/Low) + one-line "why it matters" + copy-paste content block or step-by-step instructions + copy button.

**4.1 ✅ — Zero-LLM actions (generate from `BusinessProfile` data)**
- Schema.org JSON-LD snippet — fully generatable from name, address, type, hours. Copy-paste into `<head>`
- Optimised meta description — template filled from business name, type, city, services
- Optimised title tag — same, templated from profile
- Google Maps embed code — `<iframe>` snippet generated from Place ID (already available from Places API)
- Social media bio — short NAP-consistent blurb for each platform, generated from profile

**4.2 ✅ — Template-based actions (personalised, no LLM)**
- Review response templates — 3-4 variants (positive, neutral, negative) pre-filled with business name
- GBP first post draft — short Google Business Profile post template, ready to paste
- Review incentivisation tactics — short instruction card (e.g. "After checkout, ask customers…")

**4.3 ✅ — LLM-generated actions (placeholder for demo, real LLM call later)**
- Blog post drafts — 2 posts: one "about us / what we do", one "top tips" relevant to business category
- FAQ page draft — 10 Q&As generated from business type + location
- About page copy — 2-paragraph "About us" section

**4.4 — Review analysis (nice-to-have, lower priority — post-demo)**
- Fetch individual review texts from Places API (not currently done — requires additional API call)
- LLM analysis of recurring themes: positive (reinforce) and negative (operational gaps to address)
- Output: "Customers frequently mention [theme] — consider addressing this"
- Inward-facing (operational insight) rather than outward-facing (content to publish)
- Requires: Places API review text endpoint + one LLM summarisation call

---

### Step 5: Online Presence Improvement (Post-Demo / Subscription Tier)

**5.1 — Integration options (to research and decide)**
- **Google Business Profile API**: Read/write access to business info, post updates, respond to reviews
- **Google Analytics / Search Console**: Pull traffic and keyword data to inform content strategy
- **Website CMS**: Webflow, Squarespace, or WordPress APIs for publishing blog posts and updating metadata

**5.2 — Agent capabilities (ideas)**
- Weekly blog post generation based on local trends, seasonal hooks, and business keywords
- Automated response drafts for Google Reviews (owner approves before posting)
- Monthly "LLM visibility report" comparing score over time
- One-click apply for Schema markup improvements

**5.3 — Subscription model considerations**
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
