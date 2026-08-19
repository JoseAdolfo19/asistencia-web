import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const fetchConTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(45_000) });

export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchConTimeout },
});
