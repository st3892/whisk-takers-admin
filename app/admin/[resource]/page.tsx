import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getResource } from "@/lib/admin/resources";
import { pageNumber } from "@/lib/admin/data";
import { resourcePage, relationshipOptions, type Filters } from "@/lib/admin/resource-data";
import { PageHeading, Notice } from "../components";
import { ResourceForm } from "../resources/forms";
import { ResourceTable, ResourcePagination } from "../resources/view";
export default async function ResourcePage({ params, searchParams }: { params: Promise<{ resource: string }>; searchParams: Promise<Filters> }) {
  const { supabase } = await requireAdmin();
  const { resource: slug } = await params;
  const config = getResource(slug);
  if (!config) notFound();
  const rawFilters = await searchParams;
  const filters: Filters = Object.fromEntries(Object.entries(rawFilters).filter(([, value]) => typeof value === "string"));
  const page = pageNumber(filters.page);
  const result = await resourcePage(supabase, config, page, filters);
  const { options, errors } = await relationshipOptions(supabase, config, result.rows, config.mode === "crud");
  return <><PageHeading title={config.title} description={config.description}/><span className="badge neutral">{config.mode === "read" ? "Read only" : config.mode === "update" ? "Read and update" : "Create, read, update and delete"}</span>
    {config.mode === "crud" && !errors.length && <details className="panel create-panel"><summary>Create {config.singular.toLowerCase()}</summary><ResourceForm slug={slug} options={options}/></details>}
    {errors.map(error => <Notice key={error}>{error}</Notice>)}
    <section className="panel"><form className="filter-bar" method="get">
      {config.search && <label>Search {config.title.toLowerCase()}<input name="q" defaultValue={filters.q} maxLength={200} placeholder={`Search ${config.search.replaceAll("_", " ")}…`}/></label>}
      {slug === "generation-requests" && <label>Status<input name="status" defaultValue={filters.status} placeholder="e.g. pending" maxLength={100}/></label>}
      {slug === "llm-responses" && <><label>Request ID<input name="request" defaultValue={filters.request} inputMode="numeric"/></label><label>Model ID<input name="model" defaultValue={filters.model} inputMode="numeric"/></label></>}
      {slug === "prompt-chain-steps" && <label>Chain ID<input name="chain" defaultValue={filters.chain} inputMode="numeric"/></label>}
      <button className="button compact" type="submit">Filter</button><Link className="text-link" href={`/admin/${slug}`}>Reset</Link>
    </form>{result.error ? <Notice>{result.error}</Notice> : <><ResourceTable slug={slug} config={config} rows={result.rows} options={options}/><ResourcePagination base={`/admin/${slug}`} page={page} count={result.count} filters={filters}/></>}</section>
    <p className="caption">Records visible through your authenticated session. Dates use New York time.</p>
  </>;
}
