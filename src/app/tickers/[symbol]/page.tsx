import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ConfidenceBadge,
  MentionBadge,
  formatDate,
} from "@/components/Badges";
import { getTickerDetail } from "@/lib/db";
import type { MentionType } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ symbol: string }> };

export default async function TickerDetailPage({ params }: Props) {
  const { symbol } = await params;
  const detail = getTickerDetail(decodeURIComponent(symbol));
  if (!detail) notFound();

  const sourceCount = new Set(detail.mentions.map((m) => m.source_id)).size;

  return (
    <>
      <div className="page-head">
        <p className="meta" style={{ marginBottom: "0.5rem" }}>
          <span className="ticker-symbol">{detail.symbol}</span>
          <span>
            {sourceCount} source{sourceCount === 1 ? "" : "s"}
          </span>
        </p>
        <h1>{detail.company_name}</h1>
        <p>
          Why this name keeps showing up across the interviews and articles you
          ingest — including second-order thesis links.
        </p>
      </div>

      <section className="section">
        <div className="panel">
          <h2>Mentions across sources</h2>
          <div className="mention-list">
            {detail.mentions.map((mention, index) => (
              <article
                key={`${mention.source_id}-${index}`}
                className="mention-item"
              >
                <div className="ticker-card-head">
                  <Link href={`/sources/${mention.source_id}`}>
                    {mention.source_title}
                  </Link>
                  <ConfidenceBadge confidence={mention.confidence} />
                  <MentionBadge type={mention.mention_type as MentionType} />
                </div>
                <p>{mention.rationale}</p>
                <div className="meta">
                  {mention.thesis_link ? (
                    <span>Thesis: {mention.thesis_link}</span>
                  ) : null}
                  {mention.value_chain_layer ? (
                    <span>Layer: {mention.value_chain_layer}</span>
                  ) : null}
                  {mention.time_horizon ? (
                    <span>{mention.time_horizon}</span>
                  ) : null}
                  {mention.themes ? <span>{mention.themes}</span> : null}
                  <span>{formatDate(mention.researched_at)}</span>
                  <a href={mention.source_url} target="_blank" rel="noreferrer">
                    Open source
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
