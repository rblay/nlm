# LLMRank — Claude Context

## What this project is

LLMRank (project folder: `nlm`) is an MBA AI Ventures demo. It helps SMEs (gyms, restaurants, boutique stores) understand and improve how AI assistants describe their business.

Three-step product:
1. **Score** — scrape the business URL, generate customer-style queries, query multiple LLMs, return a presence score (mentions / total queries)
2. **Recommend** — analyse observable signals (Schema markup, reviews, blog, social) and generate gap-based, prioritised recommendations
3. **Improve** — subscription tier where an agent autonomously takes actions (write blog posts, respond to reviews, update metadata)

Steps 1 and 2 are the demo target. Step 3 is post-demo product vision.

## Tech stack

- Next.js (TypeScript + Tailwind) in `frontend/` — API routes at `frontend/app/api/`, no separate backend
- Run: `cd frontend && npm run dev` → http://localhost:3000
- Env vars in `frontend/.env.local`: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_PLACES_API_KEY`

## Key conventions

- Scores are expressed as percentages (0–100), not fractions
- Score = mentions / total queries per LLM; overall = average across LLMs
- Recommendations are grounded in observed signals — never recommend fixing something the business already does well
- The debug tab (developer-facing) shows every (query, LLM, response, mentioned) tuple in a collapsible table

## Collaboration

- Shared types live in `frontend/lib/types.ts` — do not duplicate elsewhere; changes must be additive and communicated to the other person before merging
- Two owners: scores person (`/api/score`, debug tab) and recommendations person (`/api/recommend`, recommendations UI)

## Git workflow

- Start every session: `git checkout main && git pull`
- Always branch off main — `feature/`, `fix/`, or `chore/` prefix; never commit directly to `main`
- Open a PR when done; do not merge it yourself

## ⚠️ MANDATORY PR checklist — do this before EVERY PR, no exceptions

Before running `gh pr create`, you MUST complete all three steps in order:

1. **Update `BACKLOG.md`** — update the Current State section and mark any newly completed tasks
2. **Update `MEMORY.md`** — update current state, move completed items, note anything still pending
3. **Commit both files** on the same branch before opening the PR

This is not optional. Do not open a PR without completing these steps first.

## Backlog

See `BACKLOG.md` for the full task list and open decisions.
