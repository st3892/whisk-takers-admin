import { requireAdmin } from "@/lib/auth/require-admin";
import { readPage, pageNumber, text, date } from "@/lib/admin/data";
import { PageHeading, Notice, LongText, Pagination } from "../components";
import { GenerationForm, DeleteGeneration } from "./forms";
export default async function GenerationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { supabase } = await requireAdmin();
  const page = pageNumber((await searchParams).page);
  const result = await readPage(supabase, "generations", page);
  return <><PageHeading title="AI Generations" description="Manage the recipe for a good laugh. Manual records only—no AI service calls."/>
    <details className="panel create-panel"><summary>＋ Create a generation</summary><p className="muted">Attributed to your admin account, with the current creation time. Leave ID blank only if the existing database supplies a default.</p><GenerationForm/></details>
    {result.error ? <Notice>{result.error}</Notice> : <section className="panel"><div className="table-scroll" tabIndex={0} role="region" aria-label="AI generations table, scroll horizontally for more columns"><table aria-label="AI generations"><thead><tr><th scope="col">ID</th><th scope="col">Prompt</th><th scope="col">Generated text</th><th scope="col">User ID</th><th scope="col">Created (New York)</th><th scope="col">Actions</th></tr></thead><tbody>{result.rows.map(row => <tr key={text(row.id)}><td className="id">{text(row.id)}</td><td><LongText value={row.prompt}/></td><td><LongText value={row.generated_text}/></td><td className="id">{text(row.user_id) || "—"}</td><td>{date(row.created_at)}</td><td><details className="edit-details"><summary aria-label={`Edit generation ${text(row.id)}`}>Edit record</summary><GenerationForm generation={{ id: text(row.id), prompt: text(row.prompt), generated_text: text(row.generated_text) }}/></details><DeleteGeneration id={text(row.id)}/></td></tr>)}</tbody></table>{!result.rows.length && <p className="empty">No generations available. Create a manual record above.</p>}</div><Pagination base="/admin/generations" page={page} count={result.count}/></section>}
    <p className="caption">All changes use your session and the existing RLS policies. Permission errors stop the operation; no policy or constraint is bypassed.</p>
  </>;
}
