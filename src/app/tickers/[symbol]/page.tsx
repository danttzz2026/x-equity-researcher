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
  const secondOrderCount = detail.mentions.filter(
    (mention) => mention.mention_type === "second_order",
  ).length;
  const avg = (field: "exposure_score" | "purity_score" | "asymmetry_score") =>
    detail.mentions.length
      ? (
          detail.mentions.reduce((sum, mention) => sum + mention[field], 0) /
          detail.mentions.length
        ).toFixed(1)
      : "0.0";

  return (
    <>
      <div className="page-head">
        <p className="meta" style={{ marginBottom: "0.5rem" }}>
          <span className="ticker-symbol">{detail.symbol}</span>
          <span>
            {sourceCount} source{sourceCount === 1 ? "" : "s"}
          </span>
          <span>{secondOrderCount} second-order mentions</span>
        </p>
        <h1>{detail.company_name}</h1>
        <p>
          Why this name keeps showing up across the interviews and articles you
          ingest — including second-order thesis links.
        </p>
        <div className="score-row" style={{ marginTop: "1rem" }}>
          <span>Exposure {avg("exposure_score")}/5</span>
          <span>Purity {avg("purity_score")}/5</span>
          <span>Asymmetry {avg("asymmetry_score")}/5</span>
        </div>
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
                  {mention.mega_cap ? (
                    <span className="badge badge-anchor">anchor</span>
                  ) : null}
                </div>
                {[mention.exchange, mention.country].filter(Boolean).length ? (
                  <div className="meta compact-meta">
                    {[mention.exchange, mention.country].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
                <div className="score-row">
                  <span>Exposure {mention.exposure_score}/5</span>
                  <span>Purity {mention.purity_score}/5</span>
                  <span>Asymmetry {mention.asymmetry_score}/5</span>
                </div>
                <p>{mention.rationale}</p>
                {mention.evidence_snippet ? (
                  <blockquote className="evidence-snippet">
                    {mention.evidence_snippet}
                  </blockquote>
                ) : null}
                {mention.counter_thesis ? (
                  <p>
                    <strong style={{ color: "var(--ink)" }}>
                      Counter-thesis:{" "}
                    </strong>
                    {mention.counter_thesis}
                  </p>
                ) : null}
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
