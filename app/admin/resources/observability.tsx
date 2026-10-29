import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { databaseError, type Row } from "@/lib/admin/data";
import { getResource } from "@/lib/admin/resources";
import { relationshipOptions } from "@/lib/admin/resource-data";
import { Notice } from "../components";
import { ResourceTable } from "./view";

export async function Observability() {
  const { supabase } = await requireAdmin();
  const [chains, models, requests, failed, pending, recent] = await Promise.all([
    supabase.from("prompt_chains").select("id", { count: "exact", head: true }),
    supabase.from("llm_models").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("generation_requests").select("id", { count: "exact", head: true }),
    supabase.from("generation_requests").select("id", { count: "exact", head: true }).in("status", ["failed", "error"]),
    supabase.from("generation_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "queued"]),
    supabase.from("generation_requests").select("*").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(5),
  ]);
  let total = 0, samples = 0, latencyError: string | null = null;
  for (let start = 0; start < 50000; start += 500) {
    const { data, count, error } = await supabase.from("llm_responses").select("id,latency_ms", { count: "exact" }).order("id").range(start, start + 499);
    if (error) { latencyError = databaseError(error, "Read LLM latency"); break; }
    for (const row of data || []) if (typeof row.latency_ms === "number" && row.latency_ms >= 0) { total += row.latency_ms; samples++; }
    if (count !== null && start + (data?.length || 0) >= count) break;
    if (!data?.length || start === 49500) { latencyError = "Average LLM latency unavailable: the complete dataset could not be read within the 50,000-response analysis limit."; break; }
  }
  const metrics = [["Prompt chains", chains], ["Active models", models], ["Generation requests", requests], ["Failed requests", failed], ["Pending / queued", pending]] as const;
  const config = getResource("generation-requests")!;
  const relations = await relationshipOptions(supabase, config, (recent.data || []) as Row[]);
  return <><div className="section-heading"><h2>Generation observability</h2><Link className="text-link" href="/admin/generation-requests">All requests →</Link></div><p className="caption">Failed = failed/error; pending = pending/queued. Average latency uses all visible responses with a non-negative latency, up to 50,000 responses.</p>
    <div className="stats-grid">{metrics.map(([label, result]) => <section className="stat-card" key={label}><span>{label}</span><strong>{result.error ? "—" : result.count?.toLocaleString() ?? "—"}</strong></section>)}<section className="stat-card"><span>Average LLM latency</span><strong>{latencyError || !samples ? "—" : `${Math.round(total / samples).toLocaleString()} ms`}</strong></section></div>
    {metrics.filter(([, result]) => result.error).map(([label, result]) => <Notice key={label}>{databaseError(result.error!, `Read ${label}`)}</Notice>)}{latencyError && <Notice>{latencyError}</Notice>}
    <section className="panel"><h2>Recent generation requests</h2>{recent.error ? <Notice>{databaseError(recent.error, "Read recent requests")}</Notice> : <>{relations.errors.map(message => <Notice key={message}>{message}</Notice>)}<ResourceTable slug="generation-requests" config={config} rows={(recent.data || []) as Row[]} options={relations.options}/></>}</section>
  </>;
}
