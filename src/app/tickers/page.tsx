import Link from "next/link";
import { formatDate } from "@/components/Badges";
import { listTickers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function TickersPage() {
  const tickers = listTickers();

  return (
    <>
      <div className="page-head">
        <h1>Tickers</h1>
        <p>
          Equities surfaced across your researched sources — sorted by how often
          they show up.
        </p>
      </div>

      <section className="section">
        {tickers.length === 0 ? (
          <div className="empty-state">
            No tickers yet. Research a source to discover names involved in its
            themes and markets.
          </div>
        ) : (
          <div className="ticker-list">
            {tickers.map((ticker) => (
              <Link
                key={ticker.symbol}
                href={`/tickers/${encodeURIComponent(ticker.symbol)}`}
                className="ticker-row"
              >
                <div>
                  <h2>
                    <span className="ticker-symbol">{ticker.symbol}</span>{" "}
                    {ticker.company_name}
                  </h2>
                  <div className="meta">
                    <span>
                      {ticker.source_count} source
                      {ticker.source_count === 1 ? "" : "s"}
                    </span>
                    <span>
                      {ticker.mention_count} mention
                      {ticker.mention_count === 1 ? "" : "s"}
                    </span>
                    <span>{ticker.second_order_count} second-order</span>
                    <span>Exposure {ticker.avg_exposure_score}/5</span>
                    <span>Purity {ticker.avg_purity_score}/5</span>
                    <span>Asymmetry {ticker.avg_asymmetry_score}/5</span>
                    <span>Latest {formatDate(ticker.latest_mention_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
