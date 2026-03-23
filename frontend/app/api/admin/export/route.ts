import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/db/client";

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsv).join(",");
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [toCsvRow(headers), ...rows.map(toCsvRow)].join("\n");
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

const TODAY = new Date().toISOString().slice(0, 10);

// ─── GET /api/admin/export?table=queries|businesses|mentions ─────────────────

export async function GET(req: NextRequest) {
  const db = getSupabaseClient();
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const table = req.nextUrl.searchParams.get("table") ?? "queries";
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 500, 5000) : 500;

  try {
    // ── research_queries ──────────────────────────────────────────────────────
    if (table === "queries") {
      // Fetch queries; join score_cache via source_score_id to get business_name + url
      const { data: queries, error } = await db
        .from("research_queries")
        .select(`
          id, run_at, query_text, intent_bucket,
          business_type, location, llm, model_version,
          latency_ms, response_text,
          score_cache ( business_name, url )
        `)
        .order("run_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[admin/export] queries error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const headers = [
        "run_at", "business_name", "url",
        "business_type", "location", "intent_bucket",
        "query_text", "llm", "model_version", "latency_ms",
        "response_preview",
      ];

      const rows = (queries ?? []).map((q) => {
        const sc = Array.isArray(q.score_cache) ? q.score_cache[0] : q.score_cache;
        return [
          q.run_at,
          sc?.business_name ?? "",
          sc?.url ?? "",
          q.business_type,
          q.location,
          q.intent_bucket,
          q.query_text,
          q.llm,
          q.model_version,
          q.latency_ms,
          (q.response_text ?? "").slice(0, 400),
        ];
      });

      return csvResponse(toCsv(headers, rows), `nlm_queries_${TODAY}.csv`);
    }

    // ── research_businesses ───────────────────────────────────────────────────
    if (table === "businesses") {
      const { data, error } = await db
        .from("research_businesses")
        .select("id, name, url, business_type, location, description, services, source, last_analyzed_at, added_at")
        .order("added_at", { ascending: false })
        .limit(limit);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const headers = [
        "added_at", "name", "url", "business_type", "location",
        "description", "services", "source", "last_analyzed_at",
      ];

      const rows = (data ?? []).map((b) => [
        b.added_at,
        b.name,
        b.url,
        b.business_type,
        b.location,
        b.description,
        Array.isArray(b.services) ? b.services.join("; ") : (b.services ?? ""),
        b.source,
        b.last_analyzed_at,
      ]);

      return csvResponse(toCsv(headers, rows), `nlm_businesses_${TODAY}.csv`);
    }

    // ── research_mentions ─────────────────────────────────────────────────────
    if (table === "mentions") {
      const { data, error } = await db
        .from("research_mentions")
        .select(`
          id, created_at, business_name, match_confidence, extracted_by,
          research_queries ( query_text, llm, location, intent_bucket, business_type, run_at )
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const headers = [
        "created_at", "mentioned_business", "match_confidence",
        "query_text", "llm", "location", "intent_bucket", "business_type",
      ];

      const rows = (data ?? []).map((m) => {
        const q = Array.isArray(m.research_queries) ? m.research_queries[0] : m.research_queries;
        return [
          m.created_at,
          m.business_name,
          m.match_confidence,
          q?.query_text ?? "",
          q?.llm ?? "",
          q?.location ?? "",
          q?.intent_bucket ?? "",
          q?.business_type ?? "",
        ];
      });

      return csvResponse(toCsv(headers, rows), `nlm_mentions_${TODAY}.csv`);
    }

    return NextResponse.json(
      { error: `Unknown table "${table}". Valid: queries, businesses, mentions` },
      { status: 400 }
    );

  } catch (err) {
    console.error("[admin/export] Unexpected error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
