// ─── Shared contract between the scoring and recommendations pipelines ───────
// Both API routes consume BusinessProfile. Edit this file carefully and
// communicate changes to both teammates before merging.

// ─── Business extraction (shared foundation) ─────────────────────────────────

export interface ObservableSignals {
  hasSchema: boolean;                  // <script type="application/ld+json"> present
  hasBlog: boolean;                    // /blog or /news link found
  hasFAQ: boolean;                     // /faq link or FAQ schema detected on the website
  socialLinks: string[];               // absolute URLs to social profiles
  hasMetaDescription: boolean;         // <meta name="description"> present and non-empty
  titleTag: string | null;             // contents of <title>, null if missing
  hasMapsEmbed: boolean;               // Google Maps embed or GBP link present on the website
  hasGoogleBusinessProfile: boolean;   // confirmed via Google Places API lookup
  gbpHasHours: boolean;                // GBP listing has opening hours set
  gbpPhotoCount: number | null;        // number of photos on the GBP listing
  reviewCount: number | null;          // from Google Places API, or visible on page if Places unavailable
  reviewRating: number | null;         // from Google Places API, or visible on page if Places unavailable
}

export interface BusinessProfile {
  name: string;
  type: string;           // e.g. "gym", "restaurant", "boutique"
  location: string;       // city / neighbourhood
  description: string;    // 2–3 sentence GPT summary
  services: string[];     // key offerings extracted from the page
  signals: ObservableSignals;
}

// ─── Scoring pipeline (owned by scores person) ───────────────────────────────

export type LLMProvider = "openai" | "anthropic" | "gemini";

export interface DebugEntry {
  query: string;
  llm: LLMProvider;
  response: string;
  mentioned: boolean;
  latencyMs: number;
  error?: boolean;
  errorMessage?: string;
}

export interface LLMScore {
  llm: LLMProvider;
  score: number;       // percentage 0–100 (mentions / total queries * 100)
  mentions: number;
  totalQueries: number;
}

export interface ScoreResult {
  overallScore: number;    // average across all LLMs (0–100)
  perLLM: LLMScore[];
  intents: string[];       // common customer intents for this business type (step 1)
  queries: string[];       // the generated queries shown in the UI (step 2)
  debug: DebugEntry[];
}

// ─── Recommendations pipeline (owned by recommendations person) ───────────────

export type RecommendationImpact = "High" | "Medium" | "Low";

export interface Recommendation {
  title: string;
  whyItMatters: string;    // why this gap hurts LLM visibility
  observed: string;        // what was (or wasn't) found on the site
  impact: RecommendationImpact;
  firstAction: string;     // one concrete next step
}

export interface RecommendationResult {
  recommendations: Recommendation[];
}

// ─── Actions pipeline ─────────────────────────────────────────────────────────

export type ActionContentType = "code" | "text" | "steps" | "markdown";

export interface ActionCard {
  id: string;
  title: string;
  whyItMatters: string;
  impact: RecommendationImpact;
  content: string;            // copy-paste text, code snippet, or step list
  contentType: ActionContentType;
  isPlaceholder?: boolean;    // true = LLM-generated placeholder (real call coming later)
}

export interface ActionsResult {
  actions: ActionCard[];
}

// ─── API route response shapes ────────────────────────────────────────────────

// POST /api/analyze — scrape URL, extract business profile
export interface AnalyzeResponse {
  profile: BusinessProfile;
}

// POST /api/score — generate queries, call LLMs, compute scores
export interface ScoreResponse extends ScoreResult {}

// POST /api/recommend — analyse signals, return prioritised recommendations
export interface RecommendResponse extends RecommendationResult {}

// POST /api/actions — generate copy-paste action cards from signals
export interface ActionsResponse extends ActionsResult {}
