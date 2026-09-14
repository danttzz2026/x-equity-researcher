import { notFound } from "next/navigation";
import Link from "next/link";
import { EvidenceLedger } from "@/components/EvidenceLedger";
import { getSource, getSourceClaims } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function ClaimsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ claim?: string }> }) {
  const { id } = await params;
  const { claim } = await searchParams;
  const sourceId = Number(id);
  const source = getSource(sourceId);
  if (!source) notFound();
  const data = getSourceClaims(sourceId);
  return <><header className="view-heading"><div><h2>Evidence</h2><p>Find a claim. Open it to inspect the quote.</p></div></header>
    {!data ? <div className="empty-state"><h2>No research yet</h2><Link className="btn btn-secondary" href={`/sources/${sourceId}`}>Start from the source overview</Link></div> : <>
      <section className="section"><EvidenceLedger key={claim || "all"} claims={data.claims} sourceId={sourceId} selectedClaim={Number(claim)} /></section>
      <section className="section"><details className="supporting-details"><summary>Web references · {data.webSources.length}</summary>{data.webSources.length ? <ul className="citation-list">{data.webSources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title || source.url} ↗</a><span>{source.snippet || source.publisher || source.source_type || "Web reference"}</span></li>)}</ul> : <p>No web references saved yet.</p>}</details></section>
    </>}
  </>;
}
