import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;
export const PAGE_SIZE = 25;
export function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
export function profileName(row: Row) {
  return [text(row.first_name), text(row.last_name)].filter(Boolean).join(" ") || "Unnamed profile";
}
export function date(value: unknown) {
  const raw = text(value);
  if (!raw || !Number.isFinite(Date.parse(raw))) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(raw));
}
export function pageNumber(value?: string) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1;
}
export function databaseError(error: { code?: string; message: string }, operation: string) {
  if (error.code === "42501") return `${operation} blocked by database permissions/RLS (${error.code}). The existing authenticated superadmin policy must permit this operation. No security bypass was attempted.`;
  if (error.code === "23503") return `${operation} blocked by an existing foreign-key constraint. Related votes or other records must be handled according to the existing database rules; they were not manually removed.`;
  return `${operation} failed (${error.code || "database error"}): ${error.message}`;
}
export async function readPage(supabase: SupabaseClient, table: string, page: number) {
  const result = await supabase.from(table).select("*", { count: "exact" })
    .order("id", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  return { rows: (result.data || []) as Row[], count: result.count ?? 0,
    error: result.error ? databaseError(result.error, `Read ${table}`) : null };
}
// Paginate explicitly: Supabase's default response limit must not truncate statistics.
export async function readAll(supabase: SupabaseClient, table: string) {
  const rows: Row[] = [];
  for (let start = 0; start < 50000; start += 1000) {
    const { data, error, count } = await supabase.from(table).select("*", { count: "exact" })
      .order("id").range(start, start + 999);
    if (error) return { rows: [] as Row[], error: databaseError(error, `Read ${table}`) };
    rows.push(...(data || []));
    if (count !== null && rows.length >= count) return { rows, error: null };
    if (!data?.length) return { rows: [] as Row[], error: `Could not read the complete ${table} dataset. Statistics are unavailable.` };
  }
  return { rows: [] as Row[], error: `${table} exceeds the 50,000-row dashboard analysis limit. Aggregate statistics are unavailable rather than truncated.` };
}
export function voteLabel(row: Row) {
  return Number(row.value ?? row.vote_value ?? row.vote) === 1 ? "Like" : Number(row.value ?? row.vote_value ?? row.vote) === -1 ? "Boo" : "Unknown";
}
export function targetId(row: Row) {
  return text(row.generation_id) || text(row.joke_id) || text(row.target_id);
}
export function targetType(row: Row) {
  return text(row.target_type) || (row.generation_id ? "generation" : row.joke_id ? "joke" : "Unknown");
}
export function generationVote(row: Row, generationIds: Set<string>) {
  const type = targetType(row).toLowerCase();
  return Boolean(row.generation_id) || (["generation", "ai_generation", "ai"].includes(type) && generationIds.has(targetId(row)));
}
