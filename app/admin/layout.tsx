import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { signOut } from "@/app/auth/actions";
import { Navigation } from "./navigation";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="admin-app"><a className="skip-link" href="#admin-main">Skip to main content</a><aside className="admin-sidebar"><Link className="admin-brand" href="/admin">Whisk Takers<span>Kitchen Control</span></Link><Navigation/><div className="sidebar-bottom"><span className="badge pistachio">Superadmin kitchen</span><form action={signOut}><button className="signout" type="submit">Sign out ↗</button></form></div></aside><main id="admin-main" tabIndex={-1} className="admin-content">{children}</main></div>;
}
