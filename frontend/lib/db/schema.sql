-- LLMRank / NLM — Database Schema
-- Run this once in the Supabase SQL editor to create all tables.

-- ─── Group 1: Caching ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analyze_cache (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url         text NOT NULL,
  cache_key   text NOT NULL UNIQUE,   -- sha256(normalised_url)
  profile     jsonb NOT NULL,         -- full BusinessProfile incl. signals
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz NOT NULL    -- now() + interval '24 hours'
);

CREATE INDEX IF NOT EXISTS analyze_cache_key_idx ON analyze_cache (cache_key);
CREATE INDEX IF NOT EXISTS analyze_cache_expires_idx ON analyze_cache (expires_at);

CREATE TABLE IF NOT EXISTS score_cache (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url              text NOT NULL,
  cache_key        text NOT NULL UNIQUE,   -- sha256(normalised_url + "|" + queryCount)
  query_count      int NOT NULL DEFAULT 12,
  business_name    text,
  overall_score    int NOT NULL,
  per_llm          jsonb NOT NULL,         -- LLMScore[]
  intents          jsonb NOT NULL,
  queries          jsonb NOT NULL,
  debug            jsonb NOT NULL,         -- DebugEntry[]
  summary          text,
  profile_snapshot jsonb NOT NULL,
  created_at       timestamptz DEFAULT now(),
  expires_at       timestamptz NOT NULL    -- now() + interval '7 days'
);

CREATE INDEX IF NOT EXISTS score_cache_key_idx ON score_cache (cache_key);
CREATE INDEX IF NOT EXISTS score_cache_expires_idx ON score_cache (expires_at);

-- ─── Group 2: Research Datasets ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_businesses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  url              text,
  canonical_url    text UNIQUE,              -- normalised URL for deduplication
  business_type    text,                     -- 'gym' | 'restaurant' | etc.
  location         text,
  description      text,
  services         jsonb,                    -- string[]
  source           text NOT NULL,            -- 'pipeline' | 'manual' | 'seeded'
  added_at         timestamptz DEFAULT now(),
  last_analyzed_at timestamptz
);

CREATE INDEX IF NOT EXISTS research_businesses_canonical_idx ON research_businesses (canonical_url);
CREATE INDEX IF NOT EXISTS research_businesses_type_idx ON research_businesses (business_type);

CREATE TABLE IF NOT EXISTS research_signals (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 uuid NOT NULL REFERENCES research_businesses(id) ON DELETE CASCADE,
  has_schema                  boolean,
  has_blog                    boolean,
  has_faq                     boolean,
  has_meta_description        boolean,
  has_maps_embed              boolean,
  has_google_business_profile boolean,
  gbp_has_hours               boolean,
  gbp_photo_count             int,
  review_count                int,
  review_rating               numeric(3,1),
  social_link_count           int,
  social_links                jsonb,         -- string[]
  title_tag                   text,
  blog_post_count             int,           -- derived from blogPostDates.length
  latest_blog_post_date       date,
  faq_question_count          int,
  scraped_at                  timestamptz DEFAULT now(),
  scrape_source               text           -- 'pipeline' | 'script' | 'manual'
);

CREATE INDEX IF NOT EXISTS research_signals_business_idx ON research_signals (business_id);
CREATE INDEX IF NOT EXISTS research_signals_schema_idx ON research_signals (has_schema);
CREATE INDEX IF NOT EXISTS research_signals_gbp_idx ON research_signals (has_google_business_profile);

CREATE TABLE IF NOT EXISTS research_queries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text      text NOT NULL,
  query_type      text,                -- 'generated' | 'manual' | 'seeded'
  business_type   text,
  location        text,
  intent_bucket   text,                -- 'Discovery' | 'Fit & Persona' | etc.
  llm             text NOT NULL,       -- 'openai' | 'perplexity' | 'gemini'
  response_text   text NOT NULL,
  latency_ms      int,
  run_at          timestamptz DEFAULT now(),
  source_score_id uuid REFERENCES score_cache(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS research_queries_llm_idx ON research_queries (llm);
CREATE INDEX IF NOT EXISTS research_queries_business_type_idx ON research_queries (business_type);
CREATE INDEX IF NOT EXISTS research_queries_score_idx ON research_queries (source_score_id);

CREATE TABLE IF NOT EXISTS research_mentions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id          uuid NOT NULL REFERENCES research_queries(id) ON DELETE CASCADE,
  business_name     text NOT NULL,
  business_id       uuid REFERENCES research_businesses(id) ON DELETE SET NULL,
  match_confidence  text,              -- 'exact' | 'fuzzy' | 'unmatched'
  extracted_by      text,              -- 'llm' | 'regex'
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_mentions_query_idx ON research_mentions (query_id);
CREATE INDEX IF NOT EXISTS research_mentions_business_idx ON research_mentions (business_id);
CREATE INDEX IF NOT EXISTS research_mentions_name_idx ON research_mentions (business_name);
