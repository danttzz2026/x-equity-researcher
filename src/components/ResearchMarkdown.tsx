import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ResearchMarkdown({ children, sourceId, claims = [] }: {
  children: string;
  sourceId?: number;
  claims?: Array<{ id: number; claim_uid: string }>;
}) {
  const claimIds = new Map(claims.map((claim) => [claim.claim_uid, claim.id]));
  const content = children.replace(/\[Transcript:\s*([^\]]+)\]/g, (citation, references: string) => {
    if (!sourceId) return citation;
    const links = references.split(/[,;]/).map((reference) => {
      const uid = reference.replace(/^\s*Transcript:\s*/, "").trim();
      const id = claimIds.get(uid);
      return id ? `[Evidence ${id}](/sources/${sourceId}/claims?claim=${id}#claim-${id})` : `[Unresolved transcript citation: ${uid}]`;
    });
    return links.join(", ");
  });
  return <div className="research-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    // Research should not load arbitrary remote images returned by a model.
    img: () => null,
    h1: ({ children }) => <h3>{children}</h3>,
    h2: ({ children }) => <h3>{children}</h3>,
    h3: ({ children }) => <h4>{children}</h4>,
    a: ({ href, children }) => <a href={href} {...(href?.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>{children}</a>,
    table: ({ children }) => <div className="table-scroll"><table>{children}</table></div>,
  }}>{content}</Markdown></div>;
}
