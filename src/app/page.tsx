import Link from "next/link";
import { SourceLibrary } from "@/components/SourceLibrary";
import { listSources } from "@/lib/db";
import { hasResearchApiKey } from "@/lib/research/model";

export const dynamic = "force-dynamic";
export default function HomePage() {
  const sources = listSources();
  const ready = sources.filter((source) => source.research_summary).length;
  const attention = sources.filter((source) => source.status !== "researched").length;
  return <>
    <section className="desk-header"><div><span className="eyebrow">Your research workspace</span><h1>Follow the evidence.</h1><p>Turn the sources you trust into investment theses you can inspect.</p></div><Link href="/sources/new" className="btn btn-primary">+ Add a source</Link></section>
    {!hasResearchApiKey() && <div className="notice"><strong>One step before your first research run.</strong> Add your Gemini API key. <Link href="/settings">Set up research ↗</Link></div>}
    {sources.length ? <><div className="desk-stats"><div><strong>{sources.length}</strong><span>sources collected</span></div><div><strong>{ready}</strong><span>ready to review</span></div><div><strong>{attention}</strong><span>to research</span></div></div><SourceLibrary sources={sources.map(({ id, title, url, show_host, updated_at, status, ticker_count, research_summary }) => ({ id, title, url, show_host, updated_at, status, ticker_count, research_summary }))} /></> : <section className="onboarding panel"><span className="eyebrow">Start with something worth understanding</span><h2>One source. A clearer investment thesis.</h2><div className="onboarding-steps"><div><span>01</span><h3>Bring the source</h3><p>Add an interview, podcast, or article with its transcript or text.</p></div><div><span>02</span><h3>Build the research</h3><p>Extract claims, investigate the web evidence, and connect companies to the thesis.</p></div><div><span>03</span><h3>Make up your own mind</h3><p>Read the report, inspect the quotes, and challenge the counter-thesis.</p></div></div><Link href="/sources/new" className="btn btn-primary">Add your first source →</Link></section>}
  </>;
}
