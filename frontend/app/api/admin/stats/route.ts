import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/db/client";

export async function GET() {
  const db = getSupabaseClient();
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    // Parallel queries for aggregate stats
    const [queriesRes, businessesRes, topMentionedRes, signalCorrelationsRes] =
      await Promise.allSettled([
        db.from("research_queries").select("id", { count: "exact", head: true }),
        db.from("research_businesses").select("id", { count: "exact", head: true }),
        db
          .from("research_mentions")
          .select("business_name")
          .not("business_name", "is", null)
          .limit(1000),
        db
          .from("research_signals")
          .select(
            "has_schema,has_blog,has_faq,has_meta_description,has_google_business_profile,review_count,business_id"
          )
          .limit(500),
      ]);

    const totalQueries =
      queriesRes.status === "fulfilled" ? (queriesRes.value.count ?? 0) : 0;
    const totalBusinesses =
      businessesRes.status === "fulfilled" ? (businessesRes.value.count ?? 0) : 0;

    // Top mentioned businesses by name frequency
    let topMentioned: { name: string; mentionCount: number }[] = [];
    if (topMentionedRes.status === "fulfilled" && topMentionedRes.value.data) {
      const freq: Record<string, number> = {};
      for (const row of topMentionedRes.value.data) {
        const name = row.business_name?.trim().toLowerCase();
        if (name) freq[name] = (freq[name] ?? 0) + 1;
      }
      topMentioned = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, mentionCount]) => ({ name, mentionCount }));
    }

    // Simple signal correlation: for each boolean signal, compute mention count
    // This is a lightweight in-JS approximation — full SQL joins would need an RPC
    let signalCorrelations: {
      signal: string;
      withSignal: number;
      withoutSignal: number;
    }[] = [];

    if (
      signalCorrelationsRes.status === "fulfilled" &&
      signalCorrelationsRes.value.data &&
      signalCorrelationsRes.value.data.length > 0
    ) {
      const signals = signalCorrelationsRes.value.data;
      const boolSignals = [
        "has_schema",
        "has_blog",
        "has_faq",
        "has_meta_description",
        "has_google_business_profile",
      ] as const;

      // Fetch mention counts per business_id
      const businessIds = [...new Set(signals.map((s) => s.business_id).filter(Boolean))];
      let mentionsByBusiness: Record<string, number> = {};

      if (businessIds.length > 0) {
        const mentionsRes = await db
          .from("research_mentions")
          .select("business_id")
          .in("business_id", businessIds)
          .not("business_id", "is", null);

        if (mentionsRes.data) {
          for (const row of mentionsRes.data) {
            const bid = row.business_id;
            if (bid) mentionsByBusiness[bid] = (mentionsByBusiness[bid] ?? 0) + 1;
          }
        }
      }

      for (const signal of boolSignals) {
        const withGroup = signals.filter((s) => s[signal] === true);
        const withoutGroup = signals.filter((s) => s[signal] === false);

        const avgMentions = (group: typeof withGroup) => {
          if (group.length === 0) return 0;
          const total = group.reduce(
            (sum, s) => sum + (mentionsByBusiness[s.business_id] ?? 0),
            0
          );
          return Math.round((total / group.length) * 10) / 10;
        };

        signalCorrelations.push({
          signal,
          withSignal: avgMentions(withGroup),
          withoutSignal: avgMentions(withoutGroup),
        });
      }
    }

    return NextResponse.json({
      totalQueries,
      totalBusinesses,
      topMentioned,
      signalCorrelations,
    });
  } catch (err) {
    console.error("[admin/stats] Error:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
