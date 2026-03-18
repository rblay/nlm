-- LLMRank / NLM — Database Schema
--
-- There are two Supabase projects:
--   nlm-dev  → used for local development (.env.local points here)
--   nlm-prod → used for production (Vercel environment variables point here)
-- Run this script in BOTH projects.
--
-- Setup checklist for each project:
--   1. Run this entire script in the SQL editor
--   2. Run the GRANT statements below
--   3. Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to .env.local (dev) or Vercel (prod)
--
-- After creating tables, grant access to the service role key used by the app:
--   GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
--   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
--
-- Note: Supabase does NOT auto-grant these for tables created via raw SQL —
-- you must run the above every time you create tables this way.

-- ─── Group 1: Caching ─────────────────────────────────────────────────────────
--
-- These tables make repeated submissions fast and cheap. Results are stored
-- keyed by a SHA-256 hash of the normalised URL (+ query count for scores).
-- Expiry is lazy: rows are never deleted, just ignored once expires_at has passed.
-- Use force_refresh=true in the request body to bypass cache on either route.

-- Caches /api/analyze results for 24 hours.
-- Cache key: sha256(normalised_url)
--   normalised_url = lowercase, strip www., strip trailing slash, strip query string
CREATE TABLE IF NOT EXISTS analyze_cache (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url         text NOT NULL,                 -- original URL as submitted
  cache_key   text NOT NULL UNIQUE,          -- sha256(normalised_url)
  profile     jsonb NOT NULL,               -- full BusinessProfile incl. signals
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz NOT NULL          -- created_at + 24 hours
);

CREATE INDEX IF NOT EXISTS analyze_cache_key_idx ON analyze_cache (cache_key);
CREATE INDEX IF NOT EXISTS analyze_cache_expires_idx ON analyze_cache (expires_at);

-- Caches /api/score results for 7 days.
-- Cache key: sha256(normalised_url + "|" + queryCount)
-- Results are always read whole (no field-by-field queries), so jsonb blobs are fine here.
CREATE TABLE IF NOT EXISTS score_cache (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url              text NOT NULL,            -- original URL as submitted
  cache_key        text NOT NULL UNIQUE,     -- sha256(normalised_url + "|" + queryCount)
  query_count      int NOT NULL DEFAULT 12,  -- number of queries run (1–12)
  business_name    text,                     -- denormalised for quick display
  overall_score    int NOT NULL,             -- 0–100, average across all LLMs
  per_llm          jsonb NOT NULL,           -- LLMScore[] — score per provider
  intents          jsonb NOT NULL,           -- string[] — generated customer intents
  queries          jsonb NOT NULL,           -- string[] — generated discovery queries
  debug            jsonb NOT NULL,           -- DebugEntry[] — full query/response/mention log
  summary          text,                     -- plain-English narrative from GPT-4o-mini
  profile_snapshot jsonb NOT NULL,           -- BusinessProfile at time of scoring
  created_at       timestamptz DEFAULT now(),
  expires_at       timestamptz NOT NULL      -- created_at + 7 days
);

CREATE INDEX IF NOT EXISTS score_cache_key_idx ON score_cache (cache_key);
CREATE INDEX IF NOT EXISTS score_cache_expires_idx ON score_cache (expires_at);

-- ─── Group 2: Research Datasets ───────────────────────────────────────────────
--
-- These tables accumulate structured data over time for correlation analysis:
-- "which observable signals (schema, reviews, GBP, blog, etc.) predict LLM visibility?"
--
-- Core analysis query:
--   SELECT s.has_schema, AVG(mention_count) ...
--   FROM research_signals s
--   JOIN research_businesses b ON b.id = s.business_id
--   JOIN research_mentions m ON m.business_id = b.id
--   GROUP BY s.has_schema;

-- One row per unique business. Deduplicated by canonical_url.
-- Populated automatically on every /api/analyze run, or manually via /api/research/seed.
CREATE TABLE IF NOT EXISTS research_businesses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  url              text,                      -- original URL as submitted
  canonical_url    text UNIQUE,              -- normalised URL used for deduplication
                                             -- format: protocol://host/path (no www, no trailing slash)
  business_type    text,                     -- e.g. 'gym', 'restaurant', 'boutique'
                                             -- matches BusinessProfile.type from GPT extraction
  location         text,                     -- "Neighbourhood, City" — from HTML or Places API fallback
                                             -- NOTE: consider splitting into structured columns
                                             -- (neighbourhood, city, country, lat, lng) for scale
  description      text,                     -- 2–3 sentence GPT summary
  services         jsonb,                    -- string[] — key offerings extracted from homepage
  source           text NOT NULL,            -- how this record was created:
                                             --   'pipeline' = submitted via normal score flow
                                             --   'seeded'   = added via POST /api/research/seed or CLI
                                             --   'manual'   = hand-inserted directly into DB
  added_at         timestamptz DEFAULT now(),
  last_analyzed_at timestamptz               -- updated on every re-analyze
);

CREATE INDEX IF NOT EXISTS research_businesses_canonical_idx ON research_businesses (canonical_url);
CREATE INDEX IF NOT EXISTS research_businesses_type_idx ON research_businesses (business_type);

-- One row per analyze run per business. Versioned over time (multiple rows per business_id).
-- Individual boolean/numeric columns (not jsonb) so GROUP BY and WHERE filters are clean SQL.
-- Populated automatically on every /api/analyze run.
CREATE TABLE IF NOT EXISTS research_signals (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 uuid NOT NULL REFERENCES research_businesses(id) ON DELETE CASCADE,
  has_schema                  boolean,       -- <script type="application/ld+json"> present
  has_blog                    boolean,       -- /blog or /news link found on homepage
  has_faq                     boolean,       -- /faq link or FAQPage schema detected
  has_meta_description        boolean,       -- <meta name="description"> present and non-empty
  has_maps_embed              boolean,       -- Google Maps embed or GBP link on homepage
  has_google_business_profile boolean,       -- confirmed via Google Places API lookup
  gbp_has_hours               boolean,       -- GBP listing has opening hours set
  gbp_photo_count             int,           -- number of photos on GBP listing (from Places API)
  review_count                int,           -- from Google Places API
  review_rating               numeric(3,1),  -- from Google Places API (e.g. 4.8)
  social_link_count           int,           -- number of distinct social platform links found
  social_links                jsonb,         -- string[] — absolute URLs to social profiles
  title_tag                   text,          -- contents of <title> tag
  blog_post_count             int,           -- derived from blogPostDates.length (max 10)
  latest_blog_post_date       date,          -- most recent blog post date found
  faq_question_count          int,           -- number of FAQ questions extracted
  scraped_at                  timestamptz DEFAULT now(),
  scrape_source               text           -- 'pipeline' | 'script' | 'manual'
);

CREATE INDEX IF NOT EXISTS research_signals_business_idx ON research_signals (business_id);
CREATE INDEX IF NOT EXISTS research_signals_schema_idx ON research_signals (has_schema);
CREATE INDEX IF NOT EXISTS research_signals_gbp_idx ON research_signals (has_google_business_profile);

-- One row per (query, LLM) pair from every scoring run.
-- Linked back to score_cache via source_score_id.
-- intent_bucket maps query position → one of 9 GEO intent buckets.
CREATE TABLE IF NOT EXISTS research_queries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text      text NOT NULL,
  query_type      text,                -- 'generated' = from scoring pipeline
                                       -- 'manual' = hand-written
                                       -- 'seeded' = from bulk seed CLI
  business_type   text,                -- business type at time of query (e.g. 'gym')
  location        text,                -- location string used when query was generated
  intent_bucket   text,                -- which of the 9 GEO intent buckets this query covers:
                                       -- Discovery | Fit & Persona | Constraints | Quality & Trust
                                       -- Experience & Vibe | Price & Value | Comparison
                                       -- Logistics & Booking | Goal-based searches
  llm             text NOT NULL,       -- provider: 'openai' | 'perplexity' | 'gemini'
  model_version   text,                -- specific model: 'gpt-4o-mini' | 'sonar' | 'gemini-2.5-flash'
  response_text   text NOT NULL,       -- full raw response from the LLM
  latency_ms      int,                 -- round-trip time for this single query
  run_at          timestamptz DEFAULT now(),
  source_score_id uuid REFERENCES score_cache(id) ON DELETE SET NULL
                                       -- links back to the score run that generated this query
                                       -- SET NULL on delete so research data survives cache expiry
);

CREATE INDEX IF NOT EXISTS research_queries_llm_idx ON research_queries (llm);
CREATE INDEX IF NOT EXISTS research_queries_business_type_idx ON research_queries (business_type);
CREATE INDEX IF NOT EXISTS research_queries_score_idx ON research_queries (source_score_id);

-- One row per business name that appeared in an LLM response.
-- business_id is nullable: populated at insert time if the name matches a known business
-- in research_businesses (exact case-insensitive match). NULL = not yet in our dataset.
-- Unmatched names with high frequency are candidates for seeding via /api/research/seed.
CREATE TABLE IF NOT EXISTS research_mentions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id          uuid NOT NULL REFERENCES research_queries(id) ON DELETE CASCADE,
  business_name     text NOT NULL,      -- raw business name as extracted from LLM response
  business_id       uuid REFERENCES research_businesses(id) ON DELETE SET NULL,
                                        -- linked if name matched a known business; NULL otherwise
  match_confidence  text,               -- 'exact'     = case-insensitive name match to research_businesses
                                        -- 'unmatched' = no match found (business not yet in dataset)
                                        -- (fuzzy matching not yet implemented)
  extracted_by      text,               -- 'llm' = extracted via GPT-4o-mini batch call
                                        -- 'regex' = reserved for future rule-based extraction
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_mentions_query_idx ON research_mentions (query_id);
CREATE INDEX IF NOT EXISTS research_mentions_business_idx ON research_mentions (business_id);
CREATE INDEX IF NOT EXISTS research_mentions_name_idx ON research_mentions (business_name);
