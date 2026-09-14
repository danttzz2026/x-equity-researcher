"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusBadge, formatDate } from "./Badges";
import type { SourceListItem } from "@/lib/types";

type LibrarySource = Pick<SourceListItem, "id" | "title" | "url" | "show_host" | "updated_at" | "status" | "ticker_count" | "research_summary">;
export function SourceLibrary({ sources }: { sources: LibrarySource[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const filters = [{ value: "all", label: "All sources" }, { value: "ready", label: "Ready to read" }, { value: "attention", label: "To research" }];
  const filtered = sources.filter((source) => `${source.title} ${source.show_host ?? ""} ${source.research_summary ?? ""}`.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || (filter === "ready" ? Boolean(source.research_summary) : source.status !== "researched")));
  return <section className="section library-section"><div className="panel-title-row"><h2>Your sources</h2><span className="result-count" role="status">{filtered.length} of {sources.length}</span></div>
    <div className="library-toolbar"><div className="segmented-control" aria-label="Filter library">{filters.map((item) => <button key={item.value} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div><label className="field library-search"><span className="sr-only">Search library</span><input type="search" placeholder="Search titles, hosts, or research…" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
    {filtered.length ? <div className="library-grid">{filtered.map((source) => <article className="library-card" key={source.id}>
      <div className="panel-title-row"><span className="eyebrow">{source.show_host || "Research source"}</span><StatusBadge status={source.status} /></div>
      <h3><Link href={`/sources/${source.id}`}>{source.title}</Link></h3>
      <p className="library-summary">{source.research_summary || (source.status === "error" ? "Research paused before completion. Open the source to review the issue and resume." : "Source saved. Start research to extract evidence and build an equity map.")}</p>
      <div className="library-card-footer"><span className="meta">{source.ticker_count ? `${source.ticker_count} equities · ` : ""}{formatDate(source.updated_at).split(",").slice(0, 2).join(",")}</span><Link className="text-link" href={`/sources/${source.id}`}>{source.research_summary ? "Review research" : source.status === "error" || source.status === "researching" ? "Continue research" : "Open source"} →</Link></div>
    </article>)}</div> : <div className="empty-state"><h3>No sources match</h3><p>Try a different search or view all sources.</p><button className="btn btn-secondary" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button></div>}
  </section>;
}
