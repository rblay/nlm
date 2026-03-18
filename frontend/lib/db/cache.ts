import { createHash } from "crypto";
import type { BusinessProfile, ScoreResult } from "@/lib/types";
import { getSupabaseClient } from "./client";

// ─── Cache key helpers ────────────────────────────────────────────────────────

function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // strip www., query string, trailing slash; lowercase
    let host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    let path = parsed.pathname.replace(/\/$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  }
}

export function computeAnalyseCacheKey(url: string): string {
  return createHash("sha256").update(normaliseUrl(url)).digest("hex");
}

export function computeScoreCacheKey(url: string, queryCount: number): string {
  return createHash("sha256").update(`${normaliseUrl(url)}|${queryCount}`).digest("hex");
}

// ─── analyze_cache ────────────────────────────────────────────────────────────

export async function getCachedProfile(
  cacheKey: string
): Promise<BusinessProfile | null> {
  const db = getSupabaseClient();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from("analyze_cache")
      .select("profile")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .single();
    if (error || !data) return null;
    return data.profile as BusinessProfile;
  } catch (err) {
    console.warn("[cache] getCachedProfile error:", err);
    return null;
  }
}

export async function setCachedProfile(
  url: string,
  cacheKey: string,
  profile: BusinessProfile
): Promise<void> {
  const db = getSupabaseClient();
  if (!db) return;
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await db.from("analyze_cache").upsert(
      { url, cache_key: cacheKey, profile, expires_at: expiresAt },
      { onConflict: "cache_key" }
    );
  } catch (err) {
    console.warn("[cache] setCachedProfile error:", err);
  }
}

// ─── score_cache ──────────────────────────────────────────────────────────────

export interface CachedScore extends ScoreResult {
  profileSnapshot: BusinessProfile;
}

export async function getCachedScore(
  cacheKey: string
): Promise<CachedScore | null> {
  const db = getSupabaseClient();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from("score_cache")
      .select("overall_score,per_llm,intents,queries,debug,summary,profile_snapshot")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .single();
    if (error || !data) return null;
    return {
      overallScore: data.overall_score,
      perLLM: data.per_llm,
      intents: data.intents,
      queries: data.queries,
      debug: data.debug,
      summary: data.summary ?? "",
      profileSnapshot: data.profile_snapshot,
    } as CachedScore;
  } catch (err) {
    console.warn("[cache] getCachedScore error:", err);
    return null;
  }
}

export async function setCachedScore(
  url: string,
  cacheKey: string,
  queryCount: number,
  result: ScoreResult,
  profile: BusinessProfile
): Promise<string | null> {
  const db = getSupabaseClient();
  if (!db) return null;
  try {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db
      .from("score_cache")
      .upsert(
        {
          url,
          cache_key: cacheKey,
          query_count: queryCount,
          business_name: profile.name,
          overall_score: result.overallScore,
          per_llm: result.perLLM,
          intents: result.intents,
          queries: result.queries,
          debug: result.debug,
          summary: result.summary,
          profile_snapshot: profile,
          expires_at: expiresAt,
        },
        { onConflict: "cache_key" }
      )
      .select("id")
      .single();
    if (error || !data) {
      console.warn("[cache] setCachedScore upsert error:", error);
      return null;
    }
    return data.id as string;
  } catch (err) {
    console.warn("[cache] setCachedScore error:", err);
    return null;
  }
}
