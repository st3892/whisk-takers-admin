"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { databaseError } from "@/lib/admin/data";
import { getResource, recordId, resourceInput, type ResourceState } from "@/lib/admin/resources";

export async function mutateResource(slug: string, operation: string, _previous: ResourceState, form: FormData): Promise<ResourceState> {
  const { supabase } = await requireAdmin();
  const config = getResource(slug);
  if (!config || config.mode === "read" || !["create", "update", "delete"].includes(operation) || (config.mode === "update" && operation !== "update")) return { error: "This operation is not permitted." };
  const id = recordId(form.get("id"));
  if (operation !== "create" && !id) return { error: "Invalid record ID." };
  if (operation === "delete" && form.get("confirmation") !== id) return { error: "Type the record ID exactly to confirm deletion." };
  const parsed = operation === "delete" ? null : resourceInput(config, form);
  if (parsed?.error) return { error: parsed.error };
  const rawId = form.get("id");
  if (operation === "create" && rawId && !id) return { error: "Invalid bigint record ID." };
  let query;
  if (operation === "delete") query = supabase.from(config.table).delete().eq("id", id!);
  else if (operation === "update") query = supabase.from(config.table).update(parsed!.values!).eq("id", id!);
  else query = supabase.from(config.table).insert({ ...parsed!.values!, ...(id ? { id } : {}) });
  const { data, error } = await query.select("id");
  if (error) return { error: databaseError(error, `${operation} ${config.singular}`) };
  if (!data?.length) return { error: "No record was changed. It may no longer exist, or existing RLS may prevent this operation or reading its result." };
  revalidatePath("/admin", "layout");
  return { success: `${config.singular} ${operation === "delete" ? "deleted" : operation === "create" ? "created" : "updated"}.` };
}
