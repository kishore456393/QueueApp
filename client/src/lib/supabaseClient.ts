import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep this as a runtime throw so local dev fails fast
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

if (!/^https?:\/\//i.test(supabaseUrl) || supabaseUrl.includes(".supabase.co") === false) {
  throw new Error("Invalid VITE_SUPABASE_URL. Expected your Supabase API URL, e.g. https://<project-ref>.supabase.co");
}

if (/^postgres(ql)?:\/\//i.test(supabaseAnonKey)) {
  throw new Error("Invalid VITE_SUPABASE_ANON_KEY. This must be the Supabase anon API key, not the Postgres connection string.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

