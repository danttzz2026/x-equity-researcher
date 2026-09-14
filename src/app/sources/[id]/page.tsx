import { notFound } from "next/navigation";
import Link from "next/link";
import { DeleteSourceButton } from "@/components/DeleteSourceButton";
import { ResearchButton } from "@/components/ResearchButton";
import { SourceTickerExplorer } from "@/components/SourceTickerExplorer";
import { ThesisCard } from "@/components/ThesisCard";
import { hasResearchApiKey } from "@/lib/research/model";
import { getSourceDetail, getThesesForRun } from "@/lib/db";
import { parseStringArray } from "@/lib/strings";

export const dynamic = "force-dynamic";
export default async function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = getSourceDetail(Number(id));
  if (!source) notFound();
  const theses = source.research ? getThesesForRun(source.research.id) : [];
  const notes = parseStringArray(source.research?.quality_notes);
  return <div className="overview-content">
    {(!source.research || source.active_run) && <ResearchButton key={source.active_run?.id ?? "new"} sourceId={source.id} hasResearch={Boolean(source.research)} activeRun={source.active_run} configured={hasResearchApiKey()} />}
    {source.research && <>
      <div className="view-heading"><div><h2>Research at a glance</h2><p>{theses.length || source.market_theses.length} theses · {source.tickers.length} companies</p></div><Link className="btn btn-primary" href={`/sources/${source.id}/report`}>Read report →</Link></div>
      {notes.length > 0 && <details className="review-notes"><summary>{notes.length} evidence {notes.length === 1 ? "note" : "notes"} to review</summary><ul>{notes.map((note, index) => <li key={index}>{note}</li>)}</ul><Link href={`/sources/${source.id}/claims`}>Check evidence →</Link></details>}
      {theses.length > 0 ? <section className="focus-theses"><div className="panel-title-row"><h2>Start with a thesis</h2><span className="result-count">Select to explore</span></div><div className="focus-thesis-list">{theses.map((thesis, index) => <ThesisCard key={thesis.id} sourceId={source.id} thesis={thesis} index={index} />)}</div></section> : <section className="panel"><h2>Research brief</h2><details className="compact-disclosure"><summary>Read the saved summary</summary><p>{source.research.summary}</p></details>{source.market_theses.map((thesis) => <details key={thesis.id} className="compact-disclosure"><summary>{thesis.name}</summary><p>{thesis.why_it_matters}</p>{thesis.technical_driver && <p>{thesis.technical_driver}</p>}</details>)}</section>}
      <SourceTickerExplorer tickers={source.tickers} sourceId={source.id} />
    </>}
    <details className="supporting-details"><summary>Source material & settings</summary>
      {source.notes && <section><h3>Your notes</h3><p>{source.notes}</p></section>}
      <details className="compact-disclosure"><summary>Original transcript · {source.transcript.trim().split(/\s+/).length.toLocaleString()} words</summary><p className="original-transcript">{source.transcript}</p></details>
      {source.themes.length > 0 && <details className="compact-disclosure"><summary>Technical themes</summary>{source.themes.map((theme) => <p key={theme.id}><strong>{theme.name}: </strong>{theme.description}</p>)}</details>}
      {source.claims.length > 0 && <details className="compact-disclosure"><summary>Saved claims</summary>{source.claims.map((claim) => <p key={claim.id}>{claim.claim}{claim.evidence_snippet && <q>{claim.evidence_snippet}</q>}</p>)}</details>}
      {source.research && !source.active_run && <ResearchButton sourceId={source.id} hasResearch configured={hasResearchApiKey()} />}
      <div className="source-footer"><DeleteSourceButton sourceId={source.id} /></div>
    </details>
  </div>;
}
