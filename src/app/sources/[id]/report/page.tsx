import { notFound } from "next/navigation";
import Link from "next/link";
import { ReportReader } from "@/components/ReportReader";
import { ResearchMarkdown } from "@/components/ResearchMarkdown";
import { ReportActions } from "@/components/ReportActions";
import { getClaimsForRun, getThesesForRun, getResearchSections, getSource, getSourceResearchRun } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sourceId = Number(id);
  const source = getSource(sourceId);
  if (!source) notFound();
  const run = getSourceResearchRun(sourceId);
  const sections = run ? getResearchSections(run.id) : [];
  const claims = run ? getClaimsForRun(run.id) : [];
  const evidenceAppendix = claims.length ? `\n\n---\n\n## Transcript evidence\n\n${claims.map((claim) => `### ${claim.claim_uid}\n\n${claim.claim}\n\nQuote match: ${claim.match_kind}\n\n> ${claim.quote_text.replace(/\n/g, "\n> ")}`).join("\n\n")}` : "";
  const markdown = `# ${source.title}\n\nSource: ${source.url}\n\n${sections.map((section) => `## ${section.title}\n\n${section.body_markdown}`).join("\n\n---\n\n")}${evidenceAppendix}`;
  const theses = run ? getThesesForRun(run.id) : [];
  const chapters = sections.map((section) => {
    const summary = theses.find((thesis) => thesis.id === section.thesis_id)?.summary || "";
    const firstSentence = summary.match(/^.*?[.!?](?:\s|$)/)?.[0] || summary;
    return { id: section.id, title: section.title, summary: firstSentence, minutes: Math.max(1, Math.ceil(section.body_markdown.split(/\s+/).length / 220)), content: <ResearchMarkdown sourceId={sourceId} claims={claims}>{section.body_markdown.replace(/^# [^\n]+\n+/, "")}</ResearchMarkdown> };
  });
  return <>
    <header className="view-heading"><div><h2>Research report</h2><p>{sections.length ? "One thesis at a time. Open a chapter for the full analysis." : "No chapters yet."}</p></div>{sections.length > 0 && <details className="export-menu"><summary>Export ↓</summary><ReportActions title={source.title} markdown={markdown} /></details>}</header>
    {run && run.status !== "completed" && <p className="notice">Report in progress. <Link href={`/sources/${sourceId}`}>Resume research →</Link></p>}
    {chapters.length ? <ReportReader chapters={chapters} /> : <div className="empty-state"><p>{run?.status === "completed" ? "Run a new version to generate report chapters." : "Start research from the overview."}</p><Link className="btn btn-secondary" href={`/sources/${sourceId}`}>Open overview</Link></div>}
  </>;
}
