import { requireAdmin } from "@/lib/auth/require-admin";
import { readPage, pageNumber, text, type Row } from "@/lib/admin/data";
import { PageHeading, Notice, Pagination, VotesTable } from "../components";
export default async function VotesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { supabase } = await requireAdmin();
  const page = pageNumber((await searchParams).page);
  const result = await readPage(supabase, "votes", page);
  const generationIds = result.rows.map(row => text(row.generation_id)).filter(Boolean);
  const jokeIds = result.rows.map(row => text(row.joke_id)).filter(Boolean);
  const [generations, jokes] = await Promise.all([
    generationIds.length ? supabase.from("generations").select("id, generated_text").in("id", generationIds) : Promise.resolve({ data: [], error: null }),
    jokeIds.length ? supabase.from("jokes").select("id, text").in("id", jokeIds) : Promise.resolve({ data: [], error: null }),
  ]);
  return <><PageHeading title="Votes" description="Cheers and groans from the tasting room. Voting records are read-only."/>{result.error ? <Notice>{result.error}</Notice> : <section className="panel">{(generations.error || jokes.error) && <Notice>Some target text could not be loaded under the existing database permissions. Target IDs remain visible.</Notice>}<VotesTable rows={result.rows} generations={(generations.data || []) as Row[]} jokes={(jokes.data || []) as Row[]}/><Pagination base="/admin/votes" page={page} count={result.count}/></section>}</>;
}
