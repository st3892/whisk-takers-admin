import Link from "next/link";
import { date, text, targetId, targetType, voteLabel, type Row, PAGE_SIZE } from "@/lib/admin/data";

export function PageHeading({ title, description }: { title: string; description: string }) {
  return <header className="page-heading"><p className="eyebrow">Whisk Takers · Back office</p><h1>{title}</h1><p>{description}</p></header>;
}
export function Notice({ children }: { children: React.ReactNode }) { return <div className="notice" role="status">{children}</div>; }
export function LongText({ value }: { value: unknown }) {
  const content = text(value);
  if (!content) return <span className="muted">—</span>;
  return content.length > 120 ? <details className="long-text"><summary>{content.slice(0, 100)}…</summary><p>{content}</p></details> : <span className="long-text">{content}</span>;
}
export function Pagination({ base, page, count }: { base: string; page: number; count: number }) {
  return <nav className="pagination" aria-label="Table pages">
    {page > 1 && <Link href={`${base}?page=${page - 1}`}>← Previous</Link>}
    <span>Page {page} · {count.toLocaleString()} visible records</span>
    {page * PAGE_SIZE < count && <Link href={`${base}?page=${page + 1}`}>Next →</Link>}
  </nav>;
}
export function VotesTable({ rows, generations, jokes = [] }: { rows: Row[]; generations: Row[]; jokes?: Row[] }) {
  const generationMap = new Map(generations.map(row => [text(row.id), row]));
  const jokeMap = new Map(jokes.map(row => [text(row.id), row]));
  return <div className="table-scroll" tabIndex={0} role="region" aria-label="Voting activity table, scroll horizontally for more columns"><table aria-label="Voting activity"><thead><tr><th scope="col">Vote</th><th scope="col">User ID</th><th scope="col">Target</th><th scope="col">Joke / generation</th><th scope="col">Created (New York)</th></tr></thead><tbody>
    {rows.map((row, i) => {
      const type = targetType(row);
      const generation = ["generation", "ai_generation", "ai"].includes(type.toLowerCase()) ? generationMap.get(targetId(row)) : undefined;
      return <tr key={text(row.id) || i}><td><span className={`badge ${voteLabel(row) === "Like" ? "pistachio" : ""}`}>{voteLabel(row)}</span></td><td className="id">{text(row.user_id) || "—"}</td><td>{type}<br/><span className="id target-id">{targetId(row) || "—"}</span></td><td><LongText value={generation?.generated_text ?? (type === "joke" ? jokeMap.get(targetId(row))?.text : undefined)}/></td><td>{date(row.created_at)}</td></tr>;
    })}
  </tbody></table>{!rows.length && <p className="empty">No voting activity to show.</p>}</div>;
}
