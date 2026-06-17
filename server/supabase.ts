import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("SUPABASE_URL must be set");
if (!supabaseAnonKey) throw new Error("SUPABASE_ANON_KEY must be set");
if (/^postgres(ql)?:\/\//i.test(supabaseAnonKey)) {
  throw new Error("SUPABASE_ANON_KEY is invalid: expected Supabase anon API key, got a Postgres connection string");
}
if (supabaseServiceRoleKey && /^postgres(ql)?:\/\//i.test(supabaseServiceRoleKey)) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is invalid: expected Supabase service_role API key, got a Postgres connection string");
}

export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

