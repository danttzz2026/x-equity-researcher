import Link from "next/link";
import { StatusBadge, formatDate } from "@/components/Badges";
import { listSources } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const sources = listSources();

  return (
    <>
      <section className="hero">
        <h1 className="hero-brand">
          <span className="x">X</span> Equity Researcher
        </h1>
        <p className="hero-copy">
          Paste a YouTube or article link with its transcript. Extract exploding
          market theses and technical value chains, then surface second-order
          equities — not just the names said out loud.
        </p>
        <div className="hero-actions">
          <Link href="/sources/new" className="btn btn-primary">
            Add source
          </Link>
          <Link href="/tickers" className="btn btn-secondary">
            Browse tickers
          </Link>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Library</h2>
        {sources.length === 0 ? (
          <div className="empty-state">
            No sources yet. Add an episode or article to start building your
            research desk.
          </div>
        ) : (
          <div className="source-list">
            {sources.map((source) => (
              <Link
                key={source.id}
                href={`/sources/${source.id}`}
                className="source-row"
              >
                <div>
                  <h2>{source.title}</h2>
                  <div className="meta">
                    {source.show_host ? <span>{source.show_host}</span> : null}
                    <span>{formatDate(source.updated_at)}</span>
                    {source.ticker_count > 0 ? (
                      <span>
                        {source.ticker_count} ticker
                        {source.ticker_count === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="row-side">
                  <StatusBadge status={source.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
