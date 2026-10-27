import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/auth/access";
import { GoogleSignIn } from "./google-sign-in";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await getAdminAccess(await createClient());
  if (access.status === "authorized") redirect("/admin");
  if (access.status === "unauthorized") redirect("/unauthorized");
  if (access.status === "unavailable") redirect("/unauthorized?error=verification");
  const { error } = await searchParams;
  return <main className="shell"><section className="card">
    <p className="brand">Whisk Takers</p>
    <span className="eyebrow">A little order in the kitchen</span>
    <h1>Kitchen Control</h1>
    <p className="description">Sign in to the Whisk Takers admin kitchen.</p>
    {error && <p className="error" role="alert">Sign-in could not be completed. Please try again.</p>}
    <GoogleSignIn />
    <p className="footnote">For authorized Whisk Takers administrators.</p>
  </section></main>;
}
