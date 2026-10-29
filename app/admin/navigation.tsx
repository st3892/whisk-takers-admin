"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const groups = [
  { title: "Overview", links: [["", "Dashboard"]] },
  { title: "People", links: [["profiles", "Profiles"], ["allowed-signup-domains", "Allowed Domains"], ["whitelisted-emails", "Whitelisted Emails"]] },
  { title: "AI Configuration", links: [["prompt-chains", "Prompt Chains"], ["prompt-chain-steps", "Chain Steps"], ["prompt-chain-mixes", "Chain Mixes"], ["terms", "Terms"], ["llm-models", "LLM Models"], ["llm-providers", "LLM Providers"], ["generation-examples", "Generation Examples"]] },
  { title: "Observability", links: [["generation-requests", "Generation Requests"], ["llm-responses", "LLM Responses"], ["generations", "AI Generations"], ["votes", "Votes"]] },
];
export function Navigation() {
  const pathname = usePathname();
  const active = (slug: string) => slug ? pathname === `/admin/${slug}` || pathname.startsWith(`/admin/${slug}/`) : pathname === "/admin";
  return <nav aria-label="Kitchen Control">{groups.map(group => <details className="nav-group" key={group.title} open={group.links.some(([slug]) => active(slug))}><summary>{group.title}</summary><div>{group.links.map(([slug, label]) => <Link key={slug} href={slug ? `/admin/${slug}` : "/admin"} aria-current={active(slug) ? "page" : undefined}>{label}</Link>)}</div></details>)}</nav>;
}
