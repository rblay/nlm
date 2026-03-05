# NLM / LLMRank — Project Backlog

## Current State (as of March 2026)

- Next.js frontend with URL input form and basic layout
- Backend API route (`/api/analyze`) fetches the URL and calls GPT-4o-mini to summarize the business — but the result is only logged server-side, never returned to the UI
- Frontend shows **hardcoded fake scores** after submission (no real analysis pipeline)
- No loading states, no recommendations, no per-LLM query logic

---

## DEMO MVP — Priority Tasks

These are the tasks needed to make the demo end-to-end real and presentable for the AI Ventures class.

---

### Step 1: URL Extraction + LLM Presence Score (Real Pipeline)

**1.1 — Return business profile to the frontend**
- Modify `/api/analyze` to return the extracted business data (name, type, location, key services) in the response JSON
- Frontend should display a "Business detected" card showing what was extracted before showing scores
- This gives confidence that the tool understood the business correctly

**1.2 — Enrich business profile with observable signals**
- Before generating recommendations, extract signals directly from the website HTML and a web search:
  - Does the page have Schema.org / JSON-LD structured data? (check `<script type="application/ld+json">`)
  - Does the site have a blog or news section? (check for `/blog`, `/news` links)
  - Are social media links present?
  - Is a Google Maps embed or Google Business Profile link present?
  - Estimated review count and rating (if visible on the page or via a search snippet)
- Store these signals alongside the business profile — they feed into recommendations so we only flag gaps, not things already done well

**1.3 — Generate contextual queries from business profile**
- After extracting business info, use an LLM to generate 6–10 natural language queries a real customer might ask an AI assistant
- Queries should vary in phrasing, intent, and specificity (e.g. "best gyms in Hammersmith", "where to work out near W6", "personal trainers in West London")
- Return the list of queries so they can be shown in the UI and the debug tab

**1.4 — Query LLMs and detect business mentions**
- For each generated query, call all three LLMs in parallel and record the full response text
- **Demo LLMs**: OpenAI (GPT-4o-mini), Anthropic (Claude Haiku), Google Gemini (gemini-1.5-flash) — all real API calls
- Detection logic: case-insensitive match of the business name or domain in the response text
- Score per LLM = mentions / total queries (expressed as a percentage)
- Overall score = average across all LLMs
- Store (query, LLM, response, mentioned: bool) for each call — this powers the debug tab

**1.5 — Wire real scores to the UI**
- Replace `FAKE_SCORES` constant with data returned from the API
- Add a loading state while analysis runs with status messages ("Extracting business info...", "Generating queries...", "Querying LLMs...")
- Display per-LLM bar chart with real scores
- Consider Server-Sent Events or polling so the UI can show progress rather than waiting on a single blocking request (full pipeline may take 30–60 seconds)

**1.6 — Handle errors gracefully**
- If a URL is unreachable, show a friendly error and let the user try again
- Cap analysis time with a timeout; show partial results if some LLM calls fail

---

### Step 2: Recommendations

**2.1 — Define recommendation categories**

Based on research into what drives LLM visibility, the key levers are:

| Category | Why it matters for LLM visibility |
|---|---|
| Google Business Profile | LLMs (especially Gemini, Perplexity) pull heavily from GBP data |
| Schema.org markup | `LocalBusiness` and `Organization` structured data is machine-readable by LLMs |
| Review volume and recency | LLMs use review counts/ratings as a proxy for legitimacy and ranking |
| Local directory citations | Yelp, TripAdvisor, Foursquare listings feed LLM training data and retrieval |
| NAP consistency | Name/Address/Phone must match across all platforms |
| Website content quality | Clear service descriptions, location pages, FAQs |
| Fresh content / blog | Regular publishing signals an active, relevant business |
| Social proof | Press mentions, local news, industry awards |

**2.2 — Ground recommendations in observed signals (avoid irrelevant suggestions)**
- The LLM generating recommendations receives the full business profile AND the observable signals from step 1.2
- System prompt instructs it to: only recommend actions for gaps identified, explicitly skip categories where the business already has strong signals, and rank by expected impact on LLM visibility
- Example: if the page already shows 2,000+ Google Reviews at 4.8 stars, the model should skip "get more reviews" entirely and focus elsewhere
- Each recommendation must include: title, why it matters for LLM visibility, what was observed (or not observed), estimated impact (High/Medium/Low), and one concrete first action

**2.3 — Display recommendations in the UI**
- Add a "Recommendations" section below the score card
- Show each recommendation as a card with impact badge and first-action callout
- Order by estimated impact (High first)

---

### Step 3: Debug Tab (Developer View)

**3.1 — Add a toggleable debug panel**
- Accessible via a small "Debug" button or tab in the UI (can be visually subtle — this is for developers/demo purposes)
- Shows a table with one row per (query, LLM) combination
- Columns: Query | LLM | Mentioned (yes/no badge) | Response (collapsed by default, expandable inline)
- Collapsing/expanding individual rows keeps the table scannable without hiding data

**3.2 — What to include in the debug view**
- All generated queries and the reasoning/intent behind them (if returned by the query-generation step)
- Raw LLM responses (truncated to ~500 chars collapsed, full text expanded)
- The business profile as extracted (name, type, location, signals detected)
- Total latency per LLM call

---

### Step 4: Online Presence Improvement (Post-Demo / Subscription Tier)

This is the longer-term product vision. Decisions still to be made.

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

- **LLM providers**: OpenAI (GPT-4o-mini), Anthropic (Claude Haiku), Google Gemini (gemini-1.5-flash) — all real for demo. Need to add `GEMINI_API_KEY` to env.
- **Score definition**: "mentions / total queries" — simple and explainable for the class. Consider weighting by query relevance or LLM market share later.
- **Streaming vs. polling**: Full pipeline will be slow. Server-Sent Events are the cleanest UX solution; polling a job ID is simpler to implement.
- **Caching**: Cache results per domain so repeated demo submissions are instant and don't burn API credits.
- **Naming**: The README says "LLMRank", the UI says "LLMRank", the project folder is "nlm". Decide on a canonical name before the demo.
