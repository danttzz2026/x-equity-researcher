"use client";

import { useState } from "react";
import type { EvidenceClaim } from "@/lib/types";
import { EvidenceDisclosure } from "./EvidenceDisclosure";

export function EvidenceLedger({ claims, sourceId, selectedClaim }: { claims: EvidenceClaim[]; sourceId: number; selectedClaim?: number }) {
  const [page, setPage] = useState(() => Math.floor(Math.max(0, claims.findIndex((claim) => claim.id === selectedClaim)) / 8));
  const [query, setQuery] = useState("");
  const [match, setMatch] = useState("all");
  const filtered = claims.filter((claim) => [claim.claim, claim.quote_text, claim.value_chain_layers ?? ""].join(" ").toLowerCase().includes(query.toLowerCase()) && (match === "all" || (match === "review" ? claim.match_kind === "unverified" || claim.match_kind === "fuzzy" : claim.match_kind === "exact")));
  return <div className="panel evidence-ledger">
    <div className="search-toolbar"><label className="field"><span>Search evidence</span><input type="search" placeholder="Search claims or quotes" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label><label className="field"><span>Quote match</span><select value={match} onChange={(event) => { setMatch(event.target.value); setPage(0); }}><option value="all">All evidence</option><option value="exact">Exact quotes</option><option value="review">Needs review</option></select></label></div>
    <p className="result-count" role="status">{filtered.length} of {claims.length} claims</p>
    {filtered.length ? filtered.slice(page * 8, (page + 1) * 8).map((claim) => <EvidenceDisclosure key={claim.id} sourceId={sourceId} claimId={claim.id} claim={claim.claim} quote={claim.quote_text} startOffset={claim.start_offset} endOffset={claim.end_offset} layers={claim.value_chain_layers} matchKind={claim.match_kind} open={claim.id === selectedClaim} />) : <div className="empty-state"><h3>{claims.length ? "No matching evidence" : "No claims yet"}</h3><p>{claims.length ? "Try a broader search or reset the filters." : "Claims appear after the transcript extraction stage finishes."}</p>{claims.length > 0 && <button className="btn btn-secondary" onClick={() => { setQuery(""); setMatch("all"); setPage(0); }}>Reset filters</button>}</div>}
    {filtered.length > 8 && <div className="list-pagination"><span className="result-count">Page {page + 1} of {Math.ceil(filtered.length / 8)}</span><div><button aria-label="Previous claims" disabled={page === 0} onClick={() => setPage(page - 1)}>←</button><button aria-label="Next claims" disabled={(page + 1) * 8 >= filtered.length} onClick={() => setPage(page + 1)}>→</button></div></div>}
  </div>;
}
