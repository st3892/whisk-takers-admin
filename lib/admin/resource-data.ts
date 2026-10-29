import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { databaseError, PAGE_SIZE, text, type Row } from "./data";
import { getResource, recordId, type Resource } from "./resources";
import type { Options } from "@/app/admin/resources/forms";
export type Filters = { q?: string; status?: string; request?: string; model?: string; chain?: string; page?: string };
export async function resourcePage(supabase: SupabaseClient, config: Resource, page: number, filters: Filters = {}) {
  let query = supabase.from(config.table).select("*", { count: "exact" });
  const q = filters.q?.trim().slice(0, 200);
  if (q && config.search) query = query.ilike(config.search, `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  if (config.table === "generation_requests" && filters.status) query = query.eq("status", filters.status.slice(0, 100));
  for (const [parameter, column, tables] of [
    ["request", "generation_request_id", ["llm_responses"]],
    ["model", "llm_model_id", ["llm_responses"]],
    ["chain", "prompt_chain_id", ["prompt_chain_steps"]],
  ] as const) {
    if (filters[parameter] && (tables as readonly string[]).includes(config.table)) {
      const id = recordId(filters[parameter]);
      if (!id) return { rows: [] as Row[], count: 0, error: `Invalid ${parameter} filter.` };
      query = query.eq(column, id);
    }
  }
  if (config.table === "prompt_chain_steps") query = query.order("prompt_chain_id").order("step_order").order("id");
  else query = query.order("id", { ascending: false });
  const { data, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  return { rows: (data || []) as unknown as Row[], count: count ?? 0, error: error ? databaseError(error, `Read ${config.title}`) : null };
}
const labelColumns: Record<string, string> = {
  "prompt-chains": "id,name", "llm-models": "id,name", "llm-providers": "id,name",
  "prompt-chain-steps": "id,name,step_order", "generation-requests": "id,status,input_text",
};
export async function relationshipOptions(supabase: SupabaseClient, config: Resource, rows: Row[], all = false) {
  const options: Options = {};
  const errors: string[] = [];
  const relations = [...new Set(config.fields.filter(field => field.relation).map(field => field.relation!))];
  await Promise.all(relations.map(async slug => {
    const related = getResource(slug)!;
    const fields = config.fields.filter(field => field.relation === slug);
    const ids = [...new Set(rows.flatMap(row => fields.flatMap(field => Array.isArray(row[field.key]) ? row[field.key] as unknown[] : [row[field.key]])).map(recordId).filter((id): id is string => id !== null))];
    if (rows.some(row => fields.some(field => {
      const raw = row[field.key];
      return (Array.isArray(raw) ? raw : [raw]).some(value => value != null && recordId(value) === null);
    }))) errors.push(`${related.title} contains a relationship ID that cannot be represented safely. Editing is unavailable.`);
    const collected: Row[] = [];
    if (all) {
      // Explicit paging avoids silently truncating dropdowns at the API's row limit.
      for (let start = 0; start < 50000; start += 500) {
        const { data, count, error } = await supabase.from(related.table).select(labelColumns[slug] || "id,name", { count: "exact" }).order("id").range(start, start + 499);
        if (error) { errors.push(databaseError(error, `Read ${related.title} choices`)); break; }
        collected.push(...((data || []) as unknown as Row[]));
        if (count !== null && collected.length >= count) break;
        if (!data?.length || start === 49500) { errors.push(`${related.title} choices could not be loaded completely. Editing is unavailable.`); break; }
      }
    } else if (ids.length) {
      const { data, error } = await supabase.from(related.table).select(labelColumns[slug] || "id,name").in("id", ids);
      if (error) errors.push(databaseError(error, `Read ${related.title} names`));
      else collected.push(...((data || []) as unknown as Row[]));
    }
    options[slug] = collected.flatMap(row => {
      const id = recordId(row.id);
      if (id === null) { errors.push(`${related.title} contains an ID that cannot be represented safely. Editing is unavailable.`); return []; }
      return [{ id, label: text(row.name) || (slug === "prompt-chain-steps" ? `Step ${text(row.step_order)} · #${id}` : `Request #${id} · ${text(row.status)} ${text(row.input_text).slice(0, 60)}`) }];
    });
  }));
  return { options, errors };
}
