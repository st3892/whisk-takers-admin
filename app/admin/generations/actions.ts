"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { databaseError } from "@/lib/admin/data";
import { generationInput, generationId, type ActionState } from "@/lib/admin/generation-input";

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/admin/generations");
  revalidatePath("/admin/votes");
}
export async function createGeneration(_previous: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, user } = await requireAdmin();
  const parsed = generationInput(form);
  if (parsed.error) return { error: parsed.error };
  const rawId = form.get("id");
  const id = rawId ? generationId(rawId) : null;
  if (rawId && !id) return { error: "ID must be a positive bigint within the PostgreSQL range." };
  const { error } = await supabase.from("generations").insert({
    ...parsed.values, user_id: user.id, created_at: new Date().toISOString(), ...(id ? { id } : {}),
  }).select("id").single();
  if (error) return { error: databaseError(error, "Create generation") };
  refresh();
  return { success: "Generation created. No AI service was called." };
}
export async function updateGeneration(_previous: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = generationId(form.get("id"));
  if (!id) return { error: "Invalid generation ID." };
  const parsed = generationInput(form);
  if (parsed.error) return { error: parsed.error };
  const { data, error } = await supabase.from("generations").update(parsed.values).eq("id", id).select("id");
  if (error) return { error: databaseError(error, "Update generation") };
  if (!data?.length) return { error: "No row was updated. The record may be gone, or existing SELECT/UPDATE RLS policies do not permit this superadmin to modify it." };
  refresh();
  return { success: "Generation updated." };
}
export async function deleteGeneration(_previous: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = generationId(form.get("id"));
  if (!id || form.get("confirmation") !== id) return { error: "Type the generation ID exactly to confirm deletion." };
  const { data, error } = await supabase.from("generations").delete().eq("id", id).select("id");
  if (error) return { error: databaseError(error, "Delete generation") };
  if (!data?.length) return { error: "No row was deleted. The record may be gone, or existing SELECT/DELETE RLS policies do not permit this superadmin to remove it." };
  refresh();
  return { success: "Generation deleted under the existing database constraints." };
}
