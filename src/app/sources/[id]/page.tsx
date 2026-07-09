import { notFound } from "next/navigation";
import { StatusBadge, formatDate } from "@/components/Badges";
import { DeleteSourceButton } from "@/components/DeleteSourceButton";
import { ResearchButton } from "@/components/ResearchButton";
import { SourceTickerExplorer } from "@/components/SourceTickerExplorer";
import { getSourceDetail } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export default async function SourceDetailPage({ params }: Props) {
  const { id } = await params;
  const sourceId = Number(id);
  if (!Number.isFinite(sourceId)) notFound();

  const source = getSourceDetail(sourceId);
  if (!source) notFound();

  const secondOrderCount = source.tickers.filter(
    (ticker) => ticker.mention_type === "second_order",
  ).length;
  const megaCapCount = source.tickers.filter((ticker) => ticker.mega_cap).length;
  const layerCount = new Set(
    source.tickers
      .map((ticker) => ticker.value_chain_layer)
      .filter(Boolean),
  ).size;
  const groundedTickers = source.tickers.filter(
    (ticker) => ticker.evidence_snippet,
  );
  const qualityNotes = parseJsonArray(source.research?.quality_notes || null);
  const secondOrderShare = source.tickers.length
    ? Math.round((secondOrderCount / source.tickers.length) * 100)
    : 0;
  const evidenceShare = source.tickers.length
    ? Math.round((groundedTickers.length / source.tickers.length) * 100)
    : 0;

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

          <section className="quality-strip">
            <div>
              <span className="quality-value">{source.tickers.length}</span>
              <span className="quality-label">tickers</span>
            </div>
            <div>
              <span className="quality-value">{secondOrderShare}%</span>
              <span className="quality-label">second-order</span>
            </div>
            <div>
              <span className="quality-value">{megaCapCount}</span>
              <span className="quality-label">anchor names</span>
            </div>
            <div>
              <span className="quality-value">{layerCount}</span>
              <span className="quality-label">layers</span>
            </div>
            <div>
              <span className="quality-value">{evidenceShare}%</span>
              <span className="quality-label">ticker evidence</span>
            </div>
          </section>

          {qualityNotes.length > 0 ? (
            <section className="panel warning-panel">
              <h2>Quality notes</h2>
              <ul>
                {qualityNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="panel">
            <h2>Exploding markets & theses</h2>
            {source.market_theses.length === 0 ? (
              <p>
                No market theses extracted — re-run research with the deeper
                prompt.
              </p>
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
                    {parseJsonArray(thesis.evidence_snippets).map(
                      (snippet) => (
                        <blockquote key={snippet} className="evidence-snippet">
                          {snippet}
                        </blockquote>
                      ),
                    )}
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
                    {claim.evidence_snippet ? (
                      <blockquote className="evidence-snippet">
                        {claim.evidence_snippet}
                      </blockquote>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <SourceTickerExplorer tickers={source.tickers} />
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
