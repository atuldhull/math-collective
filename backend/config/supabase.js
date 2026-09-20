import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: "./.env.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // ✅ FIXED

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase environment variables missing");
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * A throwaway Supabase client for auth calls that AUTHENTICATE AS A USER
 * — `signInWithPassword` (verifying someone's current password) and
 * `verifyOtp` on a recovery token.
 *
 * Those calls store the resulting user session ON the client instance.
 * Running them against the shared singleton above left the process-wide
 * service-role client signed in as whichever member last changed their
 * password, so later admin queries went out carrying that member's JWT
 * and hit RLS instead of bypassing it. Each call now gets its own
 * detached client that persists nothing and is collected right after.
 */
export function createAuthClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession:     false,
      autoRefreshToken:   false,
      detectSessionInUrl: false,
    },
  });
}

export default supabase;
