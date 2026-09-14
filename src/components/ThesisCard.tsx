import Link from "next/link";
import { ConfidenceBadge } from "./Badges";
import type { ResearchThesis } from "@/lib/types";

export function ThesisCard({ sourceId, thesis, index = 0 }: { sourceId: number; thesis: ResearchThesis; index?: number }) {
  return <Link className="focus-thesis" href={`/sources/${sourceId}/theses/${thesis.id}`}><span className="focus-number">{String(index + 1).padStart(2, "0")}</span><h3>{thesis.title}</h3><ConfidenceBadge confidence={thesis.confidence} /><span aria-hidden>↗</span></Link>;
}
