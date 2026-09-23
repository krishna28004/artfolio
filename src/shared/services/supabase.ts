import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

let clientInstance: SupabaseClient<Database> | null = null;

/**
 * Returns the public anonymous Supabase client instance.
 * Lazily initializes on first use to prevent build-time static evaluation crashes.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (clientInstance) return clientInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[SUPABASE_FATAL] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  clientInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);
  return clientInstance;
}

/**
 * Lazy proxy allowing existing code to use `supabase.from(...)` unchanged.
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (client as any)[prop];
    if (typeof val === "function") {
      return val.bind(client);
    }
    return val;
  },
});
