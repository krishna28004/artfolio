import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase admin client using the SERVICE_ROLE key.
 * 
 * This client bypasses Row Level Security (RLS) entirely, making it safe
 * to use for server-side inserts in API routes where the user is not
 * authenticated. NEVER expose this client to the browser.
 * 
 * Requires: SUPABASE_SERVICE_ROLE_KEY in your environment variables.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("[SUPABASE_ADMIN_FATAL] Missing NEXT_PUBLIC_SUPABASE_URL.");
}

if (!serviceRoleKey) {
  throw new Error(
    "[SUPABASE_ADMIN_FATAL] Missing SUPABASE_SERVICE_ROLE_KEY. " +
    "Please add it to your environment variables (Vercel dashboard + .env.local). " +
    "Find it at: Supabase Dashboard > Project Settings > API > service_role key."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    // Disable auto-refresh for service role clients — not needed on the server.
    autoRefreshToken: false,
    persistSession: false,
  },
});
