import Link from "next/link";
import { date, text, PAGE_SIZE, type Row } from "@/lib/admin/data";
import { recordId, type Resource } from "@/lib/admin/resources";
import { LongText } from "../components";
import type { Options } from "./forms";
import type { Filters } from "@/lib/admin/resource-data";
export function Value({ config, column, value, options }: { config: Resource; column: string; value: unknown; options: Options }) {
  const field = config.fields.find(field => field.key === column);
  if (value === null || value === undefined || value === "") return <span className="muted">—</span>;
  if (column.endsWith("_at")) return <>{date(value)}</>;
  if (typeof value === "boolean") return <span className={`badge ${value ? "pistachio" : "neutral"}`}>{column === "is_active" ? value ? "Active" : "Inactive" : value ? "Yes" : "No"}</span>;
  if (column === "status") return <span className={`badge ${/^(completed|succeeded|success)$/.test(text(value)) ? "pistachio" : /^(pending|queued|processing|running)$/.test(text(value)) ? "pending" : ""}`}>{text(value)}</span>;
  if (field?.relation) {
    const ids = Array.isArray(value) ? value : [value];
    return <span className="relation-list">{ids.length ? ids.map((item, index) => {
      const id = recordId(item);
      const label = options[field.relation!]?.find(option => option.id === id)?.label;
      return id !== null ? <Link className="text-link" key={`${id}-${index}`} href={`/admin/${field.relation}/${id}`}>{label || `Record #${id} (name unavailable)`}</Link> : <span key={index}>ID cannot be displayed safely</span>;
    }) : <span className="muted">No chains included</span>}</span>;
  }
  if (column === "latency_ms") return <>{text(value)} ms</>;
  if (column === "user_id") return <span className="id">{text(value)}</span>;
  return <LongText value={value}/>;
}
export function duration(row: Row) {
  const start = Date.parse(text(row.created_at));
  const end = Date.parse(text(row.completed_at));
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? `${((end - start) / 1000).toFixed(2)} s` : "—";
}
export function ResourceTable({ slug, config, rows, options }: { slug: string; config: Resource; rows: Row[]; options: Options }) {
  return <div className="table-scroll" tabIndex={0} role="region" aria-label={`${config.title} table`}><table><thead><tr>{config.columns.map(column => <th key={column} scope="col">{config.fields.find(field => field.key === column)?.label || column.replaceAll("_", " ")}</th>)}{config.table === "generation_requests" && <th scope="col">Duration</th>}<th scope="col">Details</th></tr></thead><tbody>{rows.map((row, index) => <tr key={recordId(row.id) ?? index}>{config.columns.map(column => <td key={column}><Value config={config} column={column} value={row[column]} options={options}/></td>)}{config.table === "generation_requests" && <td>{duration(row)}</td>}<td>{recordId(row.id) !== null ? <Link className="text-link" href={`/admin/${slug}/${recordId(row.id)}`}>{config.mode === "read" ? "Inspect" : "View / edit"}<span className="record-context">#{recordId(row.id)}</span></Link> : <span className="notice">ID exceeds safe numeric precision.</span>}</td></tr>)}</tbody></table>{!rows.length && <p className="empty">No {config.title.toLowerCase()} match this view.</p>}</div>;
}
export function ResourcePagination({ base, page, count, filters }: { base: string; page: number; count: number; filters: Filters }) {
  const href = (next: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value && key !== "page") query.set(key, value);
    query.set("page", String(next));
    return `${base}?${query}`;
  };
  return <nav className="pagination" aria-label="Table pages">{page > 1 && <Link href={href(page - 1)}>← Previous</Link>}<span>Page {page} · {count.toLocaleString()} visible records</span>{page * PAGE_SIZE < count && <Link href={href(page + 1)}>Next →</Link>}</nav>;
}
