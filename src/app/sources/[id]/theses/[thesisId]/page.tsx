import { notFound } from "next/navigation";
import Link from "next/link";
import { EvidenceDisclosure } from "@/components/EvidenceDisclosure";
import { parseStringArray } from "@/lib/strings";
import { getThesisDetail } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function ThesisPage({ params }: { params: Promise<{ id: string; thesisId: string }> }) {
  const { id, thesisId } = await params; const sourceId = Number(id); const detail = getThesisDetail(sourceId, Number(thesisId)); if (!detail) notFound();
  return <><header className="page-head"><div className="meta"><Link href={`/sources/${sourceId}`}>Back to source</Link><Link href={`/sources/${sourceId}/report`}>Open report</Link></div><h1>{detail.thesis.title}</h1><p>{detail.thesis.summary}</p></header><section className="detail-grid section"><article className="panel"><h2>Technical mechanism</h2><p>{detail.thesis.technical_mechanism || "Mechanism not separately stated."}</p><div className="meta"><span>{parseStringArray(detail.thesis.value_chain_layers).join(" → ")}</span><span>{detail.thesis.confidence} confidence</span></div></article><article className="panel"><h2>Transcript evidence</h2>{detail.evidence.map((claim) => <EvidenceDisclosure key={claim.id} sourceId={sourceId} claimId={claim.id} claim={claim.claim} quote={claim.quote_text} startOffset={claim.start_offset} endOffset={claim.end_offset} layers={claim.value_chain_layers} matchKind={claim.match_kind} />)}</article><article className="panel"><h2>Web verification</h2>{detail.webSources.length ? <ul className="citation-list">{detail.webSources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}</a>{source.snippet ? <span>{source.snippet}</span> : null}</li>)}</ul> : <p>No web citations saved yet.</p>}</article><article className="panel"><h2>Equity expressions</h2>{detail.tickers.length ? <ul>{detail.tickers.map((ticker) => <li key={ticker.symbol}><Link href={`/sources/${sourceId}/companies/${ticker.symbol}`}>{ticker.symbol}</Link> - {ticker.rationale}</li>)}</ul> : <p>No grounded equities were retained for this thesis.</p>}</article></section></>;
}
