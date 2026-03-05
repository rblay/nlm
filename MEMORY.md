# LLMRank — Current State (March 2026)

## What's built and working

### Full end-to-end pipeline
1. User enters a business URL
2. `/api/analyze` scrapes the page, extracts `BusinessProfile` via GPT-4o-mini, enriches signals via Google Places API
3. `/api/score` generates 12 customer intents across all 9 GEO buckets → 12 queries → queries all 3 LLMs with live web search → per-LLM scores + plain-English summary
4. `/api/recommend` analyses observable signals, returns prioritised gap-based recommendations
5. `/api/actions` generates copy-paste action cards from signal gaps (no LLM calls)
6. Frontend: business profile card, signals grid, per-LLM score bars, score summary, recommendation cards, action cards, debug panel
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

### Key implementation details
- **Query generation**: Two-step — 12 intents across 9 GEO buckets; Step 2 turns each into a location-aware discovery query (no business name, area-anchored, goal-first for problem intents)
- **queryCount**: All 12 intents/queries generated; only top N sent to LLMs (frontend default 12, configurable 1–12)
- **Category detection**: regex maps `businessType` → `fitness | restaurant | beauty | other`; feeds curated `PROBLEM_DICTS`
- **Scoring**: `mentions / total_queries × 100` per LLM; overall = average across 3 LLMs
- **Detection**: Fuzzy alias matching via `buildNameAliases()` — strips business-type suffixes, checks domain stem; case-insensitive
- **Anthropic rate limiting**: Batched 3-at-a-time with 2s inter-batch delay + retry-with-backoff on 429
- **Shared types**: `frontend/lib/types.ts` — `BusinessProfile`, `ScoreResult`, `RecommendationResult`, `ActionCard` etc.
- **Google SDK**: `@google/genai` (NOT `@google/generative-ai`); model: `gemini-2.5-flash`

## Open PRs
- **PR pending** (`feature/improve-query-generation`) — progress modal, testing mode dropdown, queryCount, fake data mode; includes all work from PRs #13–15

## What's still pending (priority order)
- **3.3** — Move testing/debug controls to a separate Developer tab before demo (currently exposed on main input form)
- **5.1** — Make loading steps sequential in user-facing flow (hide parallel rec/actions fetch from end users)
- **1.6** — Graceful error handling (URL unreachable, LLM timeouts, partial results)
- **README** — Technical overview for graders (architecture, design decisions, API reference, how to run)

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
