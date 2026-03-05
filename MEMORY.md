# LLMRank — Current State (March 2026)

## What's built and working

### Full end-to-end pipeline
1. User enters a business URL
2. `/api/analyze` scrapes the page, extracts `BusinessProfile` (name, type, location, description, services) via GPT-4o-mini, enriches signals via Google Places API
3. `/api/score` generates 12 customer intents across all 9 GEO buckets → 12 location-aware queries → queries all 3 LLMs with live web search → returns per-LLM scores
4. `/api/recommend` analyses observable signals and returns prioritised gap-based recommendations
5. Frontend displays: business profile card, signals grid, per-LLM score bars, recommendation cards, scoring debug panel

### LLMs in use
| Purpose | Model |
|---|---|
| Business extraction, intent generation, query generation | OpenAI gpt-4o-mini |
| Presence scoring | OpenAI gpt-4o-mini (Responses API + web_search) |
| Presence scoring | Anthropic claude-haiku-4-5 (web_search_20250305) |
| Presence scoring | Google gemini-2.5-flash (@google/genai SDK + googleSearch) |
| Recommendation generation | OpenAI gpt-4o-mini |

### Key implementation details
- **Query generation**: Two-step — Step 1 generates 12 customer intents covering all 9 GEO buckets (Discovery, Fit/Persona, Constraints, Quality/Trust, Experience/Vibe, Price/Value, Comparison, Logistics, 3×Problem-based); Step 2 turns each into a location-aware discovery query (no business name, area-anchored, goal-first for problem intents)
- **Category detection**: regex maps `businessType` → `fitness | restaurant | beauty | other`; feeds curated `PROBLEM_DICTS` for Problem-based bucket
- **Scoring**: `mentions / total_queries × 100` per LLM; overall = average across 3 LLMs
- **Detection**: Fuzzy alias matching via `buildNameAliases()` — strips business-type suffixes ("pt studio", "gym", etc.) to find short brand token; also matches domain + domain stem; case-insensitive
- **Anthropic rate limiting**: Batched 3-at-a-time with 2s inter-batch delay + `retry-with-backoff` on 429 (reads `retry-after` header, caps at 60s, one retry per query)
- **Shared types**: `frontend/lib/types.ts` — `BusinessProfile`, `ScoreResult`, `RecommendationResult` etc.
- **Google SDK**: Using `@google/genai` (v1.44+), NOT the deprecated `@google/generative-ai`; gemini-2.5-flash is the current free-tier model

## Open PRs
- **PR pending** (`feature/improve-query-generation`) — 12-query GEO bucket coverage, fuzzy detection, Anthropic retry-with-backoff

## What's still pending
- **1.6** — Graceful error handling (URL unreachable, LLM timeouts, partial results)
- **Step 4** — Online presence improvement agent (post-demo vision)

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
