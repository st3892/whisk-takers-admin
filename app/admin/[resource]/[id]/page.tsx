import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getResource, recordId } from "@/lib/admin/resources";
import { databaseError, pageNumber, type Row } from "@/lib/admin/data";
import { resourcePage, relationshipOptions } from "@/lib/admin/resource-data";
import { PageHeading, Notice } from "../../components";
import { ResourceForm, DeleteResource } from "../../resources/forms";
import { Value, ResourceTable, ResourcePagination, duration } from "../../resources/view";
export default async function RecordPage({ params, searchParams }: { params: Promise<{ resource: string; id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { supabase } = await requireAdmin();
  const { resource: slug, id: rawId } = await params;
  const config = getResource(slug);
  const id = recordId(rawId);
  if (!config || id === null) notFound();
  const { data, error } = await supabase.from(config.table).select("*").eq("id", id).maybeSingle();
  if (error) return <><PageHeading title={config.singular} description="Record could not be loaded."/><Notice>{databaseError(error, `Read ${config.singular}`)}</Notice></>;
  if (!data) return <><PageHeading title="Record unavailable" description="This record was deleted, does not exist, or is not visible under existing RLS."/><Link href={`/admin/${slug}`}>Back to {config.title}</Link></>;
  const row = data as Row;
  if (recordId(row.id) === null) return <Notice>This record ID exceeds safe numeric precision. Editing is unavailable.</Notice>;
  const { options, errors } = await relationshipOptions(supabase, config, [row], config.mode !== "read");
  const title = String(row.name || row.term || row.title || row.domain || row.email || config.singular);
  const columns = [...new Set([...config.fields.map(field => field.key), "created_at", ...(Object.hasOwn(row, "updated_at") ? ["updated_at"] : []), ...(slug === "generation-requests" ? ["completed_at"] : [])])];
  const childSlug = slug === "prompt-chains" ? "prompt-chain-steps" : slug === "generation-requests" ? "llm-responses" : null;
  const page = pageNumber((await searchParams).page);
  const childConfig = childSlug ? getResource(childSlug)! : null;
  const childFilters = slug === "prompt-chains" ? { chain: id } : { request: id };
  const children = childConfig ? await resourcePage(supabase, childConfig, page, childFilters) : null;
  const childRelations = children && childConfig ? await relationshipOptions(supabase, childConfig, children.rows) : null;
  return <><Link className="text-link" href={`/admin/${slug}`}>← {config.title}</Link><PageHeading title={title} description={`${config.singular} details`}/><p className="record-context">Record #{id}</p>
    {errors.map(message => <Notice key={message}>{message}</Notice>)}
    <section className="panel"><dl className="record-fields">{columns.map(column => <div key={column}><dt>{config.fields.find(field => field.key === column)?.label || column.replaceAll("_", " ")}</dt><dd><Value config={config} column={column} value={row[column]} options={options}/></dd></div>)}{slug === "generation-requests" && <div><dt>Duration</dt><dd>{duration(row)}</dd></div>}</dl></section>
    {config.mode !== "read" && !errors.length && <section className="panel"><h2>Edit {config.singular.toLowerCase()}</h2><ResourceForm slug={slug} row={row} options={options}/></section>}
    {config.mode === "crud" && <section className="panel"><DeleteResource slug={slug} id={id}/></section>}
    {children && childConfig && childSlug && <section className="panel"><div className="section-heading"><h2>{slug === "prompt-chains" ? `Step sequence · ${children.count} steps` : "Associated LLM responses"}</h2></div>{children.error ? <Notice>{children.error}</Notice> : <>{childRelations?.errors.map(message => <Notice key={message}>{message}</Notice>)}{slug === "prompt-chains" ? <ol className="step-sequence">{children.rows.map((step, index) => <li key={recordId(step.id) ?? index}><span className="badge pistachio">Step {String(step.step_order)}</span><h3>{String(step.name || "Unnamed step")}</h3><p>Model: <Value config={childConfig} column="llm_model_id" value={step.llm_model_id} options={childRelations?.options || {}}/> · Temperature: {String(step.temperature ?? "Default")}</p><Value config={childConfig} column="prompt_template" value={step.prompt_template} options={{}}/></li>)}</ol> : <ResourceTable slug={childSlug} config={childConfig} rows={children.rows} options={childRelations?.options || {}}/>}{!children.rows.length && slug === "prompt-chains" && <p className="empty">No steps visible for this chain.</p>}<ResourcePagination base={`/admin/${slug}/${id}`} page={page} count={children.count} filters={{}}/></>}</section>}
  </>;
}
