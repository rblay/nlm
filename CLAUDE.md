# LLMRank — Claude Context

## What this project is

LLMRank (project folder: `nlm`) is an MBA AI Ventures demo. It helps SMEs (gyms, restaurants, boutique stores) understand and improve how AI assistants describe their business.

Three-step product:
1. **Score** — scrape the business URL, generate customer-style queries, query multiple LLMs, return a presence score (mentions / total queries)
2. **Recommend** — analyse observable signals (Schema markup, reviews, blog, social) and generate gap-based, prioritised recommendations
3. **Improve** — subscription tier where an agent autonomously takes actions (write blog posts, respond to reviews, update metadata)

Steps 1 and 2 are the demo target. Step 3 is post-demo product vision.

## Tech stack

- **Frontend**: Next.js (TypeScript + Tailwind), lives in `frontend/`
- **Backend**: Next.js API routes (`frontend/app/api/`)
- No separate backend process — everything is in the Next.js app

## Running locally

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

## Environment variables

Create `frontend/.env.local`:

```
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
GOOGLE_PLACES_API_KEY=...   # Places API (New) — enables real GBP and review data; optional, falls back gracefully
```

## LLMs used

- OpenAI `gpt-4o-mini` — business extraction, query generation, recommendation generation
- OpenAI `gpt-4o-mini`, Anthropic `claude-haiku-4-5`, Google `gemini-1.5-flash` — the three LLMs queried for presence scoring

## Key conventions

- Scores are expressed as percentages (0–100), not fractions
- Score = mentions / total queries per LLM; overall = average across LLMs
- Recommendations are grounded in observed signals — never recommend fixing something the business already does well
- The debug tab (developer-facing) shows every (query, LLM, response, mentioned) tuple in a collapsible table

## Collaboration — parallel workstreams

Two people work on this codebase in parallel:
- **Scores person** — owns `/api/score`, scoring pipeline, debug tab
- **Recommendations person** — owns `/api/recommend`, recommendations UI

**Shared contract**: `frontend/lib/types.ts` defines all shared types (`BusinessProfile`, `ScoreResult`, `RecommendationResult`, etc.). Both sides import from here. Do not duplicate type definitions elsewhere.

**Rule**: if you need to change `frontend/lib/types.ts`, communicate to the other person before merging. When working on your own route, you can mock `BusinessProfile` to develop independently — don't wait on the other pipeline.

**API split**:
- `POST /api/analyze` — scrape URL, return `BusinessProfile` (foundation, built first)
- `POST /api/score` — accept URL, return `ScoreResponse`
- `POST /api/recommend` — accept URL, return `RecommendResponse`

## Git workflow

- At the start of every session, ensure `main` is up to date: `git checkout main && git pull`
- Always work on a new branch — never commit directly to `main`
- Branch naming: `feature/<short-description>` or `fix/<short-description>`
- Before opening a PR, always:
  1. Update `BACKLOG.md` to reflect what's done and what's still pending
  2. Update `MEMORY.md` to reflect the new current state
- When a task is complete, open a PR into `main` and summarise what changed and why
- Do not merge the PR yourself — leave it for the user to review and merge

## Backlog

See `BACKLOG.md` for the full task list and open decisions.
