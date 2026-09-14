import Link from "next/link";
import { notFound } from "next/navigation";
import { getSource } from "@/lib/db";
import { SourceWorkspace } from "@/components/SourceWorkspace";

export const dynamic = "force-dynamic";
export default async function SourceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sourceId = Number(id);
  if (!Number.isSafeInteger(sourceId)) notFound();
  const source = getSource(sourceId);
  if (!source) notFound();
  return <SourceWorkspace sourceId={sourceId} header={<header className="source-heading"><div className="source-breadcrumb"><Link href="/">← Library</Link><span>{source.show_host || "Research source"}</span><a href={source.url} target="_blank" rel="noreferrer">Original ↗</a></div><h1 title={source.title}>{source.title}</h1></header>}>{children}</SourceWorkspace>;
}
