import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/auth/access";

export default async function UnauthorizedPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Recheck after a role change or account switch instead of preserving a stale denial.
  const access = await getAdminAccess(await createClient());
  if (access.status === "authorized") redirect("/admin");
  if (access.status === "logged-out") redirect("/login");
  const { error } = await searchParams;
  return <main className="shell"><section className="card">
    <p className="brand">Whisk Takers</p>
    <h1>{access.status === "unavailable" ? "Access check unavailable" : "Unauthorized"}</h1>
    <p className="description">{access.status === "unavailable"
      ? "We couldn’t verify administrator access. Try again shortly."
      : "This account does not have access to Kitchen Control. Sign out to try another Google account."}</p>
    <Link className="button" href="/admin" prefetch={false}>Check access again</Link>
    {error === "signout" && <p className="error" role="alert">Sign-out failed. Please try again.</p>}
    <form action={signOut}><button className="button" type="submit">Sign out</button></form>
  </section></main>;
}
