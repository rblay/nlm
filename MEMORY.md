# NLM — Current State (March 2026)

## What's built and working

### Full end-to-end pipeline
1. User enters a business URL
2. `/api/analyze` reads the page, extracts `BusinessProfile` via GPT-4o-mini, enriches signals via Google Places API
3. `/api/score` generates 12 customer intents across all 9 GEO buckets → 12 queries → queries all 3 LLMs with live web search → per-LLM scores + plain-English summary
4. `/api/recommend` analyses observable signals, returns prioritised gap-based recommendations
5. `/api/actions` generates copy-paste action cards from signal gaps (blog post + FAQ via GPT-4o-mini, template fallback)
6. Frontend: dark NLM-branded UI, collapsible "Your Business" card, two-column score section, flipable "Recommended Improvements" carousel, debug panel
7. Step-by-step progress modal tracks each pipeline stage with live status
8. Testing mode dropdown (All / Score Only / Rec Only / Fake Data) + configurable queries per LLM (1–12)

### LLMs in use
| Purpose | Model |
|---|---|
| Business extraction, intent generation, query generation | OpenAI gpt-4o-mini |
| Presence scoring | OpenAI gpt-4o-mini (Responses API + web_search) |
| Presence scoring | Anthropic claude-haiku-4-5 (web_search_20250305) |
| Presence scoring | Google gemini-2.5-flash (@google/genai SDK + googleSearch) |
| Recommendation generation | OpenAI gpt-4o-mini |
| Blog post + FAQ generation | OpenAI gpt-4o-mini |

### Key implementation details
- **Query generation**: Two-step — 12 intents across 9 GEO buckets; Step 2 turns each into a location-aware discovery query (no business name, area-anchored, goal-first for problem intents)
- **Geo scope guard**: Query prompt enforces district/borough/neighbourhood-level locations only; post-generation sanitizer rewrites city-wide phrasing
- **queryCount**: All 12 intents/queries generated; only top N sent to LLMs (frontend default 12, configurable 1–12)
- **Scoring**: `mentions / total_queries × 100` per LLM; overall = average across 3 LLMs
- **Detection**: Fuzzy alias matching via `buildNameAliases()` — strips business-type suffixes, checks domain stem; case-insensitive
- **Anthropic rate limiting**: Batched 3-at-a-time with 2s inter-batch delay + retry-with-backoff on 429
- **Shared types**: `frontend/lib/types.ts`
- **Google SDK**: `@google/genai` (NOT `@google/generative-ai`); model: `gemini-2.5-flash`

### UI (feature/ui-overhaul, PR #20)
- **Theme**: light — `#ece8e1` cream bg, `#1e2d4a` deep navy text/accent, white cards, Playfair Display serif headings
- **Hero**: "Can people find you on LLMs?" / tagline "Translating your business value into AI visibility"
- **Pre-submit**: Analyze/Measure/Improve steps shown; hidden after submission
- **Your Business**: always shows name/type/location + truncated description (expand inline); toggle reveals services + signals (4/5 shown initially with expand)
- **AI Visibility Score**: two-column (scores left, summary right) + full-width CTA row below: "Hire the NLM Marketing Agent" navy button → lead capture modal
- **Recommended Improvements**: combined recs + actions; flipable carousel with ‹/› arrows + nav dots; 88%/12% peek; card back has accordion for FAQ/blog (per-item expand + copy), code block for schema, + "Hire the NLM Marketing Agent" CTA pinned at bottom
- **Lead capture modal**: email input only, dummy form, success state confirmation; shared by score card and carousel cards
- **Flip card CSS**: in `globals.css` — `.flip-container`, `.flip-card-inner.is-flipped`, `.flip-card-face`, `.flip-card-back`; overflow-y on inner content divs, not the face
- **Fake data**: 4 cards — schema (code), blog post (accordion), FAQ (accordion with 8 Q&As), GBP photos (steps); matching 4 recommendations
- **Playfair Display**: added in `layout.tsx` via `next/font/google`, CSS var `--font-playfair`

## What's still pending (priority order)
- **3.3** — Move testing/debug controls to a separate Developer tab before demo
- **5.1** — Make loading steps sequential in user-facing flow
- **1.6 / 5.2** — Graceful error handling (URL unreachable, LLM timeouts, partial results)
- **README** — Technical overview for graders

## Env vars required
```
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
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
