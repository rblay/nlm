# LLMRank — Current State (March 2026)

## What's built and working

### Full end-to-end pipeline
1. User enters a business URL
2. `/api/analyze` scrapes the page, extracts `BusinessProfile` (name, type, location, description, services) via GPT-4o-mini, enriches signals via Google Places API
3. `/api/score` generates 8 customer intents → 8 location-aware queries → queries all 3 LLMs with live web search → returns per-LLM scores
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
- **Query generation**: Two-step — Step 1 generates 8 common customer intents for the business type; Step 2 turns each intent into a location-aware discovery query (no business name, area-anchored for multi-location businesses)
- **Scoring**: `mentions / total_queries × 100` per LLM; overall = average across 3 LLMs
- **Detection**: Case-insensitive match of business name OR domain in LLM response text
- **Shared types**: `frontend/lib/types.ts` — `BusinessProfile`, `ScoreResult`, `RecommendationResult` etc.
- **Google SDK**: Using `@google/genai` (v1.44+), NOT the deprecated `@google/generative-ai`; gemini-2.5-flash is the current free-tier model

## Open PRs
- **PR #8** (`feature/scoring-pipeline`) — scoring pipeline complete, Gemini fix included, awaiting review/merge

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
