# NLM — Current State (March 2026)

## What's built and working

### Full end-to-end pipeline
1. User enters a business URL
2. `/api/analyze` reads the page, extracts `BusinessProfile` via GPT-4o-mini, enriches signals via Google Places API
3. `/api/score` generates 12 customer intents across all 9 GEO buckets → 12 queries → queries all 3 LLMs with live web search → per-LLM scores + plain-English summary
4. `/api/recommend` analyses observable signals, returns prioritised gap-based recommendations
5. `/api/actions` generates copy-paste action cards from signal gaps (blog post + FAQ via GPT-4o-mini, template fallback)
6. `/api/improve` fires after `/api/score` with real queries + missed queries; generates query-aligned "Boost what's working" improvement cards for signals already present (blog relevance, schema depth, title/meta language, social, GBP, review response)
7. Frontend: light NLM-branded UI, collapsible "Your Business" card, two-column score section, flipable "Recommended Improvements" carousel, "Boost what's working" flip carousel (shown when recommendations ≤ 3), debug panel
8. Step-by-step progress modal tracks each pipeline stage including "improve" step
8. Testing mode dropdown (All / Score Only / Rec Only / Fake Data) + configurable queries per LLM (1–12)

### LLMs in use
| Purpose | Model |
|---|---|
| Business extraction, intent generation, query generation | OpenAI gpt-4o-mini |
| Presence scoring | OpenAI gpt-4o-mini (Responses API + web_search) |
| Presence scoring | Perplexity sonar (OpenAI-compatible SDK, native web search) |
| Presence scoring | Google gemini-2.5-flash (@google/genai SDK + googleSearch) |
| Recommendation generation | OpenAI gpt-4o-mini |
| Blog post + FAQ generation | OpenAI gpt-4o-mini |
| Improvement generation (query-aligned) | OpenAI gpt-4o-mini |

### Key implementation details
- **Query generation**: Two-step — 12 intents across 9 GEO buckets; Step 2 turns each into a location-aware discovery query (no business name, area-anchored, goal-first for problem intents)
- **Geo scope guard**: Query prompt enforces district/borough/neighbourhood-level locations only; post-generation sanitizer rewrites city-wide phrasing
- **queryCount**: All 12 intents/queries generated; only top N sent to LLMs (frontend default 12, configurable 1–12)
- **Scoring**: `mentions / total_queries × 100` per LLM; overall = average across 3 LLMs
- **Detection**: Fuzzy alias matching via `buildNameAliases()` — strips business-type suffixes, checks domain stem; individual distinctive tokens (>4 chars) added alongside bigrams so partial name mentions (e.g. "Quinta" for "Quinta Pupusas") are caught; expanded `NAME_STOP_WORDS` prevents generic category words (coffee, roaster, roasters, roastery, bakery, sauna, saunas, wellness, rooftop) from becoming false-positive aliases; `detectCategory()` normalises Unicode accents via `.normalize("NFD")` so "café" matches "cafe"; `mentionsBusiness()` now accepts `extraNames: string[]` — user-supplied comma-separated names from the score form are parsed and run through the same `buildNameAliases()` pipeline
- **Location parsing**: `extractLocationParts()` uses "/" as co-equal venue separator and "," as hierarchy; returns `{ districts: string[], city: string | null }`; `COUNTRY_REGION_TERMS` Set filters country/region strings (uk, england, usa, etc.) from location parts; `enforceDistrictLevelQueries()` uses block assignment so multi-location businesses get 50/50 query distribution across venues; sibling district correction rewrites wrong-venue queries to the assigned target district
- **Prompt quality**: `generateIntents` no longer hardcodes "London" (says "local businesses"); `generateQueries` uses dynamic `areaExample` from real parsed location; multi-location businesses get an explicit per-venue split instruction (`locationRule`) injected into the query prompt
- **Parallelism**: All 3 scoring providers run fully in parallel (no batching). Perplexity replaced Anthropic — sonar's native single-pass search removes the multi-turn tool loop that caused ~4× slower responses and required rate-limit batching
- **Test script**: `frontend/scripts/test-prompts.mjs` — dry-run script for intent + query generation pipeline (no LLM scoring); mirrors all helpers from `route.ts`; must be kept in sync manually
- **Shared types**: `frontend/lib/types.ts`
- **Google SDK**: `@google/genai` (NOT `@google/generative-ai`); model: `gemini-2.5-flash`

### UI (feature/multi-page-nav, PR #21)
- **Theme**: light — `#ece8e1` cream bg, `#1e2d4a` deep navy text/accent, white cards, Playfair Display serif headings
- **Hero**: "Can people find you on LLMs?" / tagline "Translating your business value into AI visibility"
- **Pre-submit**: URL input + business name(s) input (comma-separated, feeds detection) + Analyze button; Measure/Recommend/Implement steps shown below; all hidden after submission
- **Your Business**: always shows name/type/location + truncated description (expand inline); toggle reveals services + signals (4/5 shown initially with expand)
- **AI Visibility Score**: two-column (scores left, summary right) + full-width CTA row below: "Hire the NLM Marketing Agent" navy button → lead capture modal
- **Recommended Improvements**: combined recs + actions; flipable carousel with ‹/› arrows + nav dots; 88%/12% peek; card back has accordion for FAQ/blog (per-item expand + copy), code block for schema, + "Hire the NLM Marketing Agent" CTA pinned at bottom
- **Boost what's working**: flip carousel shown when recommendations ≤ 3; powered by `/api/improve` using real missed query data; front shows potential badge + gap; back shows next step + "Automate this with the NLM Agent →" CTA; "improve" pipeline step in progress modal
- **Lead capture modal**: email input only, dummy form, success state confirmation; shared by score card and carousel cards
- **Flip card CSS**: in `globals.css` — `.flip-container`, `.flip-card-inner.is-flipped`, `.flip-card-face`, `.flip-card-back`; overflow-y on inner content divs, not the face
- **Fake data**: 4 cards — schema (code), blog post (accordion), FAQ (accordion with 8 Q&As), GBP photos (steps); matching 4 recommendations
- **Playfair Display**: added in `layout.tsx` via `next/font/google`, CSS var `--font-playfair`; use `style={{ fontFamily: "var(--font-playfair)" }}` inline (no Tailwind class)
- **Multi-page nav**: shared `Header` + `Footer` in `layout.tsx`; pages at `/about`, `/pricing`, `/careers`; page.tsx no longer has its own nav/footer
- **Careers page**: three role cards (Sales, AI Engineer, Product Marketing Manager) — tagline + "We're looking for" bullets; email CTA at bottom (careers@llmrank.ai)
- **Pricing page** (`/pricing`): three tiers — Discover $49/mo, Optimize $99/mo (highlighted, "Most popular"), Grow $199/mo; each card has tier name, price, Goal box, description, feature list, CTA; footer note "All plans start with a free scan — no card required"; data defined as a `tiers` const array at top of file
- **About page**: hero "AI is recommending businesses. Is yours one of them?", Why GEO section (~130 words), three dark stacked panels (Measure/Recommend/Implement), CTA → `/`
- **Dev tools**: testing mode + debug panel hidden by default; visible at `?dev` URL param

## What's still pending (priority order)
- **1.6** — Graceful error handling (URL unreachable, LLM timeouts, partial results)
- **5.1** — Make loading steps sequential in user-facing flow
- **README** — Technical overview for graders

## Env vars required
```
OPENAI_API_KEY=...
PERPLEXITY_API_KEY=...      # perplexity.ai/settings/api
GEMINI_API_KEY=...          # Google AI Studio key (AIzaSy...), NOT a Cloud Console key
GOOGLE_PLACES_API_KEY=...   # Places API (New) — optional, falls back gracefully
```

## Running locally
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```
