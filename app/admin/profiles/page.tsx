import { requireAdmin } from "@/lib/auth/require-admin";
import { readPage, pageNumber, profileName, text, date } from "@/lib/admin/data";
import { PageHeading, Notice, Pagination } from "../components";
import { ProfileTable } from "./profile-table";
export default async function ProfilesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { supabase } = await requireAdmin();
  const page = pageNumber((await searchParams).page);
  const result = await readPage(supabase, "profiles", page);
  return <><PageHeading title="Profiles" description="The people behind the punchlines. A read-only view of public profiles."/>{result.error ? <Notice>{result.error}</Notice> : <section className="panel"><ProfileTable profiles={result.rows.map(row => { const avatar = text(row.avatar_url); return { id: text(row.id), name: profileName(row), avatar: avatar.startsWith("https://") ? avatar : "", created: date(row.created_at), admin: row.is_superadmin === true }; })}/><Pagination base="/admin/profiles" page={page} count={result.count}/></section>}<p className="caption">Only records available through your authenticated session and existing RLS are shown. Emails from auth.users are not requested.</p></>;
}
