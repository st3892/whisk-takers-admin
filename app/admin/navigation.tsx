"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links = [["/admin", "Dashboard"], ["/admin/profiles", "Profiles"], ["/admin/generations", "AI Generations"], ["/admin/votes", "Votes"]];
export function Navigation() {
  const pathname = usePathname();
  return <nav aria-label="Kitchen Control">{links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav>;
}
