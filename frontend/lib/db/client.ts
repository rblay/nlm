import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Warn at module load time so the missing-env issue is visible in logs.
  // Routes that call db functions will get null from getSupabaseClient() and skip DB ops.
  console.warn("[db] SUPABASE_URL or SUPABASE_ANON_KEY not set — database operations disabled");
}

// Singleton client — safe for serverless (each invocation gets the same module instance within a worker)
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export function getSupabaseClient() {
  return supabase;
}
