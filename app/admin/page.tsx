import Link from "next/link";
import { Observability } from "./resources/observability";
import { requireAdmin } from "@/lib/auth/require-admin";
import { readAll, text, date, voteLabel, targetId, type Row } from "@/lib/admin/data";
import { PageHeading, Notice, LongText, VotesTable } from "./components";

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const [profiles, generations, votes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    readAll(supabase, "generations"), readAll(supabase, "votes"),
  ]);
  const likes = votes.rows.filter(row => voteLabel(row) === "Like").length;
  const boos = votes.rows.filter(row => voteLabel(row) === "Boo").length;
  const rate = likes + boos ? likes / (likes + boos) * 100 : null;
  const tally = new Map<string, { likes: number; boos: number }>();
  for (const row of votes.rows) {
    if (!row.generation_id) continue;
    const id = text(row.generation_id);
    const count = tally.get(id) || { likes: 0, boos: 0 };
    if (voteLabel(row) === "Like") count.likes++;
    if (voteLabel(row) === "Boo") count.boos++;
    tally.set(id, count);
  }
  const ranked = generations.rows.map(row => ({ row, ...tally.get(text(row.id)) || { likes: 0, boos: 0 } }));
  const mostLiked = [...ranked].sort((a, b) => b.likes - a.likes || text(a.row.id).localeCompare(text(b.row.id)))[0];
  const mostBooed = [...ranked].sort((a, b) => b.boos - a.boos || text(a.row.id).localeCompare(text(b.row.id)))[0];
  const recent = (rows: Row[]) => [...rows].sort((a, b) => (Date.parse(text(b.created_at)) || 0) - (Date.parse(text(a.created_at)) || 0)).slice(0, 5);
  const recentVotes = recent(votes.rows);
  const jokeIds = recentVotes.filter(row => row.joke_id).map(targetId);
  const jokes = jokeIds.length ? await supabase.from("jokes").select("id, text").in("id", jokeIds) : { data: [], error: null };
  const statistics = [
    ["Total Profiles", profiles.error ? null : profiles.count],
    ["Total AI Generations", generations.error ? null : generations.rows.length],
    ["Total Votes", votes.error ? null : votes.rows.length],
    ["Total Likes", votes.error ? null : likes], ["Total Boos", votes.error ? null : boos],
    ["Like Rate", votes.error || rate === null ? null : `${rate.toFixed(1)}%`],
  ];
  return <><PageHeading title="Kitchen Control" description="A fresh look at what’s baking in Whisk Takers."/>
    <p className="caption">Live records visible to your admin session under existing RLS. Like rate = likes ÷ (likes + boos). A dash means unavailable or no votes.</p>
    {(profiles.error || generations.error || votes.error) && <Notice>{[profiles.error ? `Profile count failed (${profiles.error.code}): ${profiles.error.message}` : null, generations.error, votes.error].filter(Boolean).join(" ")}</Notice>}
    <div className="stats-grid">{statistics.map(([label, value]) => <section className="stat-card" key={String(label)}><span>{label}</span><strong>{typeof value === "number" ? value.toLocaleString() : value ?? "—"}</strong></section>)}</div>
    <Observability/>
    <div className="dashboard-grid"><section className="panel"><div className="section-heading"><h2>The tasting verdict</h2><span className="badge pistachio">Likes vs Boos</span></div>{votes.error ? <p className="empty">Vote analysis unavailable.</p> : likes + boos === 0 ? <p className="empty">No votes yet. The tasting room is open.</p> : <><div className="vote-bar" role="img" aria-label={`${likes} likes and ${boos} boos`}><span style={{ width: `${rate}%` }}/><span style={{ width: `${100 - (rate || 0)}%` }}/></div><div className="chart-legend"><span>● Likes · {likes.toLocaleString()}</span><span>● Boos · {boos.toLocaleString()}</span></div></>}</section>
    <section className="panel"><h2>Today’s kitchen notes</h2><p className="muted">Manage manually entered generations, meet your members, and see what gets a laugh.</p><Link className="text-link" href="/admin/generations">Open AI Generations →</Link></section></div>
    <div className="dashboard-grid">{[["Most Liked AI Joke", mostLiked, "likes"], ["Most Booed AI Joke", mostBooed, "boos"]].map(([title, item, metric]) => {
      const winner = item as typeof mostLiked;
      const count = winner ? (metric === "likes" ? winner.likes : winner.boos) : 0;
      return <section className="panel" key={String(title)}><h2>{String(title)}</h2>{generations.error || votes.error ? <p className="empty">Ranking unavailable.</p> : !winner || !count ? <p className="empty">No qualifying votes yet.</p> : <><div className="featured-joke"><LongText value={winner.row.generated_text}/></div><p className="caption"><span className={`badge ${metric === "likes" ? "pistachio" : ""}`}>{count.toLocaleString()} {String(metric)}</span> · Generation #{text(winner.row.id)}</p></>}</section>;
    })}</div>
    <section className="panel"><div className="section-heading"><h2>Recent AI Generations</h2><Link className="text-link" href="/admin/generations" aria-label="View all AI generations">View all →</Link></div>{generations.error ? <p className="empty">Generations unavailable.</p> : recent(generations.rows).length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Recent generations table, scroll horizontally for more columns"><table aria-label="Recent AI generations"><thead><tr><th scope="col">ID</th><th scope="col">Generated text</th><th scope="col">Created (New York)</th></tr></thead><tbody>{recent(generations.rows).map(row => <tr key={text(row.id)}><td className="id">{text(row.id)}</td><td><LongText value={row.generated_text}/></td><td>{date(row.created_at)}</td></tr>)}</tbody></table></div> : <p className="empty">No generations yet.</p>}</section>
    <section className="panel"><div className="section-heading"><h2>Recent Voting Activity</h2><Link className="text-link" href="/admin/votes" aria-label="View all votes">View all →</Link></div>{votes.error ? <p className="empty">Voting activity unavailable.</p> : <><VotesTable rows={recentVotes} generations={generations.rows} jokes={(jokes.data || []) as Row[]}/>{jokes.error && <Notice>Joke text is unavailable under current database access.</Notice>}</>}</section>
  </>;
}
