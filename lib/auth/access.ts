import type { SupabaseClient } from "@supabase/supabase-js";

// Always validate identity with Auth, then read the current database flag
// through the user's session and existing RLS. Never trust user metadata.
export async function getAdminAccess(supabase: SupabaseClient) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { status: "logged-out" } as const;

  const { data: profile, error } = await supabase
    .schema("public")
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // Keep diagnostics server-side; never log tokens or raw provider errors.
    console.error("Admin profile lookup failed", { userId: user.id, code: error.code });
    return { status: "unavailable" } as const;
  }
  if (!profile) {
    console.warn("Admin profile is missing or hidden by RLS", { userId: user.id });
  }
  if (profile?.is_superadmin !== true) {
    return { status: "unauthorized" } as const;
  }
  return { status: "authorized", user } as const;
}
