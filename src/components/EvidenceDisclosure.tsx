import Link from "next/link";
import { parseStringArray } from "@/lib/strings";
import type { EvidenceQuote } from "@/lib/types";

const matchLabels = { exact: "Exact quote", normalized: "Formatting differs", fuzzy: "Approximate match", unverified: "Quote not verified" };
export function EvidenceDisclosure({ sourceId, claimId, claim, quote, layers, matchKind, open = false }: {
  sourceId: number; claimId: number; claim: string; quote: string;
  startOffset: number; endOffset: number; layers?: string | null;
  matchKind?: EvidenceQuote["match_kind"]; open?: boolean;
}) {
  return <details className="evidence-disclosure" id={`claim-${claimId}`} open={open}>
    <summary><span>{claim}</span>{matchKind && <span className={`evidence-match ${matchKind}`}>{matchLabels[matchKind]}</span>}</summary>
    <blockquote className="evidence-snippet">{quote}</blockquote>
    {matchKind === "unverified" && <p className="form-error">This model-provided quote could not be located in the transcript. Check the original before relying on it.</p>}
    <div className="meta compact-meta"><span>{parseStringArray(layers).join(" · ")}</span><Link href={`/sources/${sourceId}/claims?claim=${claimId}#claim-${claimId}`}>Link to this evidence ↗</Link></div>
  </details>;
}
