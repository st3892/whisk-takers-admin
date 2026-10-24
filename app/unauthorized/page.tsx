import { signOut } from "@/app/auth/actions";

export default async function UnauthorizedPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <main className="shell"><section className="card">
    <p className="brand">Whisk Takers</p>
    <h1>Unauthorized</h1>
    <p className="description">This account does not have access to Kitchen Control. Sign out to try another Google account.</p>
    {error === "signout" && <p className="error" role="alert">Sign-out failed. Please try again.</p>}
    <form action={signOut}><button className="button" type="submit">Sign out</button></form>
  </section></main>;
}
