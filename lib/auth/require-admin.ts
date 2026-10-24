import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "./access";

// Call at each protected data, Route Handler, or Server Action entry point.
export async function requireAdmin() {
  const supabase = await createClient();
  const access = await getAdminAccess(supabase);
  if (access.status === "logged-out") redirect("/login");
  if (access.status === "unauthorized") redirect("/unauthorized");
  return { supabase, user: access.user };
}
