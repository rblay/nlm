import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/db/client";

export interface CachedClient {
  id: string;
  url: string;
  businessName: string;
  overallScore: number;
  queryCount: number;
  cachedAt: string;
  expiresAt: string;
  // Full data needed to generate newsletter without re-running
  profileSnapshot: unknown;
  perLLM: unknown;
  intents: unknown;
  queries: unknown;
  debug: unknown;
  summary: string;
}

export async function GET() {
  const db = getSupabaseClient();
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await db
    .from("score_cache")
    .select("id, url, business_name, overall_score, query_count, created_at, expires_at, profile_snapshot, per_llm, intents, queries, debug, summary")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clients: CachedClient[] = (data ?? []).map((row) => ({
    id: row.id,
    url: row.url,
    businessName: row.business_name ?? row.url,
    overallScore: row.overall_score,
    queryCount: row.query_count,
    cachedAt: row.created_at,
    expiresAt: row.expires_at,
    profileSnapshot: row.profile_snapshot,
    perLLM: row.per_llm,
    intents: row.intents,
    queries: row.queries,
    debug: row.debug,
    summary: row.summary ?? "",
  }));

  return NextResponse.json({ clients });
}
