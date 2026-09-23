import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

let adminInstance: SupabaseClient<Database> | null = null;

/**
 * Server-side Supabase admin client using the SERVICE_ROLE key.
 * 
 * Bypasses Row Level Security (RLS) entirely. Safe to use for server-side
 * privileged operations in API routes. NEVER expose this client to the browser.
 * Lazily initializes to avoid crashes during static build evaluation.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (adminInstance) return adminInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("[SUPABASE_ADMIN_FATAL] Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "[SUPABASE_ADMIN_FATAL] Missing SUPABASE_SERVICE_ROLE_KEY. " +
      "Please add it to your environment variables. " +
      "Find it at: Supabase Dashboard > Project Settings > API > service_role key."
    );
  }

  adminInstance = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminInstance;
}

/**
 * Lazy proxy allowing existing code to use `supabaseAdmin.from(...)` unchanged.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (client as any)[prop];
    if (typeof val === "function") {
      return val.bind(client);
    }
    return val;
  },
});
