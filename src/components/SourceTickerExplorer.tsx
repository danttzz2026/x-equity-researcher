"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfidenceBadge } from "./Badges";
import type { SourceDetailTicker } from "@/lib/types";

const PAGE_SIZE = 6;
export function SourceTickerExplorer({ tickers, sourceId }: { tickers: SourceDetailTicker[]; sourceId?: number }) {
  const [query, setQuery] = useState("");
  const [mention, setMention] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [page, setPage] = useState(0);
  const filtered = tickers.filter((ticker) => `${ticker.symbol} ${ticker.company_name} ${ticker.rationale}`.toLowerCase().includes(query.toLowerCase()) && (mention === "all" || ticker.mention_type === mention) && (confidence === "all" || ticker.confidence === confidence)).sort((a, b) => a.symbol.localeCompare(b.symbol));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activeFilters = Number(mention !== "all") + Number(confidence !== "all");
  function reset() { setQuery(""); setMention("all"); setConfidence("all"); setPage(0); }
  return <section className="equity-section"><div className="panel-title-row"><h2>Companies to investigate</h2><span className="result-count">{tickers.length} companies</span></div>
    <div className="equity-toolbar"><label className="field"><span className="sr-only">Find a company</span><input type="search" value={query} placeholder="Search company or ticker" onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label><details className="equity-filters"><summary>Filters{activeFilters ? ` (${activeFilters})` : ""}</summary><div className="filter-bar"><label><span>Mention</span><select value={mention} onChange={(event) => { setMention(event.target.value); setPage(0); }}><option value="all">All</option><option value="explicit">Named</option><option value="second_order">Second-order</option><option value="related">Related</option></select></label><label><span>Confidence</span><select value={confidence} onChange={(event) => { setConfidence(event.target.value); setPage(0); }}><option value="all">All</option><option value="high">High</option><option value="medium">Medium</option><option value="speculative">Speculative</option></select></label><button className="btn btn-secondary" onClick={reset}>Reset</button></div></details></div>
    <div className="equity-rows">{filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((ticker) => <details className="equity-row" key={ticker.symbol} name="equity-detail"><summary><span className="ticker-symbol">{ticker.symbol}</span><span className="equity-name">{ticker.company_name}</span><ConfidenceBadge confidence={ticker.confidence} /><span className="disclosure-plus" aria-hidden>+</span></summary><div className="equity-detail"><p>{ticker.rationale}</p>{ticker.counter_thesis && <p><strong>What could go wrong: </strong>{ticker.counter_thesis}</p>}{ticker.evidence_snippet && <blockquote>{ticker.evidence_snippet}</blockquote>}<div className="score-row" title="Model judgments, not measured returns"><span>Exposure {ticker.exposure_score}/5</span><span>Purity {ticker.purity_score}/5</span><span>Asymmetry {ticker.asymmetry_score}/5</span></div><div className="equity-detail-links"><Link className="text-link" href={sourceId && ticker.thesis_id ? `/sources/${sourceId}/companies/${encodeURIComponent(ticker.symbol)}` : `/tickers/${encodeURIComponent(ticker.symbol)}`}>Open company research ↗</Link>{sourceId && ticker.thesis_id && <Link className="text-link" href={`/sources/${sourceId}/theses/${ticker.thesis_id}`}>Related thesis ↗</Link>}</div></div></details>)}</div>
    {!filtered.length && <div className="empty-state"><p>{tickers.length ? "No companies match." : "No companies retained yet."}</p>{tickers.length > 0 && <button className="btn btn-secondary" onClick={reset}>Clear filters</button>}</div>}
    {filtered.length > 0 && <div className="list-pagination"><span className="result-count" role="status">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>{pages > 1 && <div><button aria-label="Previous companies" disabled={page === 0} onClick={() => setPage(page - 1)}>←</button><button aria-label="Next companies" disabled={page === pages - 1} onClick={() => setPage(page + 1)}>→</button></div>}</div>}
  </section>;
}
