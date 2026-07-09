import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ConfidenceBadge,
  MentionBadge,
  StatusBadge,
  formatDate,
} from "@/components/Badges";
import { DeleteSourceButton } from "@/components/DeleteSourceButton";
import { ResearchButton } from "@/components/ResearchButton";
import { getSourceDetail } from "@/lib/db";
import type { SourceDetailTicker } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function TickerCard({ ticker }: { ticker: SourceDetailTicker }) {
  return (
    <article className="ticker-card">
      <div className="ticker-card-head">
        <Link
          href={`/tickers/${encodeURIComponent(ticker.symbol)}`}
          className="ticker-symbol"
        >
          {ticker.symbol}
        </Link>
        <span>{ticker.company_name}</span>
        <ConfidenceBadge confidence={ticker.confidence} />
        <MentionBadge type={ticker.mention_type} />
      </div>
      <p>{ticker.rationale}</p>
      <div className="meta">
        {ticker.thesis_link ? <span>Thesis: {ticker.thesis_link}</span> : null}
        {ticker.value_chain_layer ? (
          <span>Layer: {ticker.value_chain_layer}</span>
        ) : null}
        {ticker.time_horizon ? <span>{ticker.time_horizon}</span> : null}
        {ticker.themes ? <span>{ticker.themes}</span> : null}
      </div>
    </article>
  );
}

export default async function SourceDetailPage({ params }: Props) {
  const { id } = await params;
  const sourceId = Number(id);
  if (!Number.isFinite(sourceId)) notFound();

  const source = getSourceDetail(sourceId);
  if (!source) notFound();

  const secondOrder = source.tickers.filter(
    (t) => t.mention_type === "second_order",
  );
  const explicit = source.tickers.filter((t) => t.mention_type === "explicit");
  const related = source.tickers.filter((t) => t.mention_type === "related");

  return (
    <>
      <div className="page-head">
        <div className="meta" style={{ marginBottom: "0.75rem" }}>
          <StatusBadge status={source.status} />
          <span>Updated {formatDate(source.updated_at)}</span>
        </div>
        <h1>{source.title}</h1>
        <p>
          {source.show_host ? `${source.show_host} · ` : null}
          <a href={source.url} target="_blank" rel="noreferrer">
            Open source
          </a>
        </p>
        {source.error_message ? (
          <p className="form-error" style={{ marginTop: "0.75rem" }}>
            {source.error_message}
          </p>
        ) : null}
        <div className="detail-actions">
          <ResearchButton
            sourceId={source.id}
            disabled={source.status === "researching"}
            hasResearch={Boolean(source.research)}
          />
          <DeleteSourceButton sourceId={source.id} />
        </div>
      </div>

      {source.notes ? (
        <section className="section">
          <div className="panel">
            <h2>Your notes</h2>
            <p>{source.notes}</p>
          </div>
        </section>
      ) : null}

      {!source.research ? (
        <section className="section">
          <div className="empty-state">
            Not researched yet. Run deep research to extract exploding-market
            theses, technical value chains, and second-order equities — not just
            names said out loud.
          </div>
        </section>
      ) : (
        <div className="detail-grid section">
          <section className="panel">
            <h2>Research brief</h2>
            <p className="summary-text">{source.research.summary}</p>
            <div className="meta" style={{ marginTop: "0.85rem" }}>
              <span>Model {source.research.model}</span>
              <span>{formatDate(source.research.created_at)}</span>
            </div>
          </section>

          <section className="panel">
            <h2>Exploding markets & theses</h2>
            {source.market_theses.length === 0 ? (
              <p>No market theses extracted — re-run research with the deeper prompt.</p>
            ) : (
              <div className="theme-grid">
                {source.market_theses.map((thesis) => (
                  <article key={thesis.id} className="theme-card">
                    <h3>{thesis.name}</h3>
                    <div className="meta">
                      {thesis.magnitude_claim ? (
                        <span className="magnitude">{thesis.magnitude_claim}</span>
                      ) : null}
                      {thesis.time_horizon ? (
                        <span>{thesis.time_horizon}</span>
                      ) : null}
                    </div>
                    <p>{thesis.why_it_matters}</p>
                    {thesis.technical_driver ? (
                      <p>
                        <strong style={{ color: "var(--ink)" }}>
                          Technical driver:{" "}
                        </strong>
                        {thesis.technical_driver}
                      </p>
                    ) : null}
                    {thesis.value_chain ? (
                      <p>
                        <strong style={{ color: "var(--ink)" }}>
                          Value chain:{" "}
                        </strong>
                        {thesis.value_chain}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2>Technical themes</h2>
            {source.themes.length === 0 ? (
              <p>No themes extracted.</p>
            ) : (
              <div className="theme-grid">
                {source.themes.map((theme) => (
                  <article key={theme.id} className="theme-card">
                    <h3>{theme.name}</h3>
                    {theme.sector ? (
                      <div className="meta">
                        <span>{theme.sector}</span>
                      </div>
                    ) : null}
                    <p>{theme.description}</p>
                    {theme.market_structure ? (
                      <p>
                        <strong style={{ color: "var(--ink)" }}>
                          Market structure:{" "}
                        </strong>
                        {theme.market_structure}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2>Key claims</h2>
            {source.claims.length === 0 ? (
              <p>No claims extracted.</p>
            ) : (
              <ul>
                {source.claims.map((claim) => (
                  <li key={claim.id}>
                    {claim.claim}
                    {claim.importance ? ` — ${claim.importance}` : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2>Second-order equities</h2>
            <p className="panel-lead">
              Names that express the speaker&apos;s market theses through the
              value chain — not just companies said out loud.
            </p>
            {secondOrder.length === 0 ? (
              <p>No second-order names yet. Re-run research.</p>
            ) : (
              <div className="ticker-grid">
                {secondOrder.map((ticker) => (
                  <TickerCard key={ticker.symbol} ticker={ticker} />
                ))}
              </div>
            )}
          </section>

          {explicit.length > 0 ? (
            <section className="panel">
              <h2>Named in source</h2>
              <div className="ticker-grid">
                {explicit.map((ticker) => (
                  <TickerCard key={ticker.symbol} ticker={ticker} />
                ))}
              </div>
            </section>
          ) : null}

          {related.length > 0 ? (
            <section className="panel">
              <h2>Related exposures</h2>
              <div className="ticker-grid">
                {related.map((ticker) => (
                  <TickerCard key={ticker.symbol} ticker={ticker} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <section className="section">
        <div className="panel">
          <h2>Transcript</h2>
          <p
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: "0.86rem",
              maxHeight: "28rem",
              overflow: "auto",
            }}
          >
            {source.transcript}
          </p>
        </div>
      </section>
    </>
  );
}
