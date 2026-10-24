"use client";
import { useState } from "react";
type Profile = { id: string; name: string; avatar: string; created: string; admin: boolean };
export function ProfileTable({ profiles }: { profiles: Profile[] }) {
  const [search, setSearch] = useState("");
  const filtered = profiles.filter(profile => profile.name.toLowerCase().includes(search.toLowerCase()));
  return <><label className="search-label">Filter names on this page<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a name…"/></label><div className="table-scroll" tabIndex={0} role="region" aria-label="Profiles table, scroll horizontally for more columns"><table aria-label="Profiles"><thead><tr><th scope="col">Name</th><th scope="col">Profile ID</th><th scope="col">Created (New York)</th><th scope="col">Access</th></tr></thead><tbody>{filtered.map(profile => <tr key={profile.id}><td><div className="profile-name">{profile.avatar ? <span className="avatar" style={{ backgroundImage: `url(${JSON.stringify(profile.avatar)})` }} role="img" aria-label={`${profile.name} avatar`}/> : <span className="avatar initial" aria-hidden="true">{profile.name.slice(0, 1)}</span>}{profile.name}</div></td><td className="id">{profile.id}</td><td>{profile.created}</td><td><span className={`badge ${profile.admin ? "pistachio" : "neutral"}`}>{profile.admin ? "Superadmin" : "Member"}</span></td></tr>)}</tbody></table>{!filtered.length && <p className="empty">No profiles match this page’s filter.</p>}</div></>;
}
