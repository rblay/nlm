#!/usr/bin/env node
/**
 * seed-research.mjs — CLI bulk-seed businesses into the research dataset.
 *
 * Usage:
 *   node scripts/seed-research.mjs --urls https://example.com https://another.com
 *   node scripts/seed-research.mjs --csv path/to/businesses.csv
 *   node scripts/seed-research.mjs --file path/to/urls.txt
 *
 * CSV format (with header row): name,url,type,location
 * URL file format: one URL per line
 *
 * Options:
 *   --base-url  Base URL of the running Next.js server (default: http://localhost:3000)
 *   --score     Also run full scoring pipeline for each business (slower, populates research_queries)
 *   --delay     Delay in ms between requests (default: 2000)
 */

import { readFileSync } from "fs";
import { createInterface } from "readline";

const args = process.argv.slice(2);

function parseArgs(argv) {
  const result = {
    urls: [],
    csv: null,
    file: null,
    baseUrl: "http://localhost:3000",
    score: false,
    delay: 2000,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--urls") {
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        result.urls.push(argv[++i]);
      }
    } else if (arg === "--csv") {
      result.csv = argv[++i];
    } else if (arg === "--file") {
      result.file = argv[++i];
    } else if (arg === "--base-url") {
      result.baseUrl = argv[++i];
    } else if (arg === "--score") {
      result.score = true;
    } else if (arg === "--delay") {
      result.delay = parseInt(argv[++i], 10);
    }
  }
  return result;
}

function loadUrlsFromFile(filePath) {
  return readFileSync(filePath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l.startsWith("http"));
}

function loadUrlsFromCsv(filePath) {
  const lines = readFileSync(filePath, "utf8").split("\n");
  const header = lines[0]?.toLowerCase().split(",") ?? [];
  const urlIdx = header.indexOf("url");
  if (urlIdx < 0) {
    console.error("CSV must have a 'url' column");
    process.exit(1);
  }
  return lines
    .slice(1)
    .map((l) => l.split(",")[urlIdx]?.trim())
    .filter((u) => u && u.startsWith("http"));
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedUrl(baseUrl, url, withScore) {
  console.log(`\nSeeding: ${url}`);

  // 1. Seed via /api/research/seed (runs analyze internally)
  const seedRes = await fetch(`${baseUrl}/api/research/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!seedRes.ok) {
    const err = await seedRes.json().catch(() => ({}));
    console.error(`  ✗ Seed failed: ${err.error ?? seedRes.status}`);
    return false;
  }

  const seedData = await seedRes.json();
  console.log(`  ✓ Seeded: "${seedData.name}" (${seedData.type}, ${seedData.location})`);

  if (withScore) {
    // 2. Run full scoring to populate research_queries + research_mentions
    console.log(`  Running score pipeline...`);
    const analyzeRes = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!analyzeRes.ok) {
      console.warn(`  ⚠ Analyze failed for scoring — skipping score step`);
      return true;
    }

    const { profile } = await analyzeRes.json();

    const scoreRes = await fetch(`${baseUrl}/api/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, profile, queryCount: 4 }), // use 4 queries for seeding to keep costs low
    });

    if (scoreRes.ok) {
      const scoreData = await scoreRes.json();
      console.log(`  ✓ Score: ${scoreData.overallScore}/100`);
    } else {
      console.warn(`  ⚠ Score failed`);
    }
  }

  return true;
}

async function main() {
  const opts = parseArgs(args);

  // Collect all URLs to process
  let urls = [...opts.urls];
  if (opts.csv) urls = [...urls, ...loadUrlsFromCsv(opts.csv)];
  if (opts.file) urls = [...urls, ...loadUrlsFromFile(opts.file)];

  if (urls.length === 0) {
    console.log("No URLs provided. Use --urls, --csv, or --file.");
    console.log("Usage: node scripts/seed-research.mjs --urls https://... [--score]");
    process.exit(0);
  }

  console.log(`\nSeeding ${urls.length} business(es) into research dataset`);
  console.log(`Base URL: ${opts.baseUrl}`);
  console.log(`Score: ${opts.score ? "yes (queryCount=4)" : "no"}`);
  console.log(`Delay: ${opts.delay}ms between requests\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`[${i + 1}/${urls.length}]`);
    const ok = await seedUrl(opts.baseUrl, url, opts.score);
    if (ok) success++;
    else failed++;

    if (i < urls.length - 1) {
      await sleep(opts.delay);
    }
  }

  console.log(`\n─── Done ─────────────────────────────`);
  console.log(`  Succeeded: ${success}`);
  console.log(`  Failed:    ${failed}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
