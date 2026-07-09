"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ConfidenceBadge, MentionBadge } from "@/components/Badges";
import type { MentionType, SourceDetailTicker } from "@/lib/types";

const MENTION_OPTIONS: Array<{ value: "all" | MentionType; label: string }> = [
  { value: "all", label: "All" },
  { value: "second_order", label: "Second-order" },
  { value: "explicit", label: "Named" },
  { value: "related", label: "Related" },
];

function scoreLabel(label: string, value: number) {
  return `${label} ${value}/5`;
}

function TickerCard({ ticker }: { ticker: SourceDetailTicker }) {
  const listing = [ticker.exchange, ticker.country].filter(Boolean).join(" · ");

  return (
    <article className="ticker-card ticker-card-box">
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
        {ticker.mega_cap ? <span className="badge badge-anchor">anchor</span> : null}
      </div>
      {listing ? <div className="meta compact-meta">{listing}</div> : null}
      <div className="score-row">
        <span>{scoreLabel("Exposure", ticker.exposure_score)}</span>
        <span>{scoreLabel("Purity", ticker.purity_score)}</span>
        <span>{scoreLabel("Asymmetry", ticker.asymmetry_score)}</span>
      </div>
      <p>{ticker.rationale}</p>
      {ticker.evidence_snippet ? (
        <blockquote className="evidence-snippet">
          {ticker.evidence_snippet}
        </blockquote>
      ) : null}
      {ticker.counter_thesis ? (
        <p>
          <strong style={{ color: "var(--ink)" }}>Counter-thesis: </strong>
          {ticker.counter_thesis}
        </p>
      ) : null}
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

export function SourceTickerExplorer({
  tickers,
}: {
  tickers: SourceDetailTicker[];
}) {
  const [mentionType, setMentionType] = useState<"all" | MentionType>(
    "second_order",
  );
  const [layer, setLayer] = useState("all");
  const [minScore, setMinScore] = useState(1);

  const layers = useMemo(() => {
    return Array.from(
      new Set(
        tickers
          .map((ticker) => ticker.value_chain_layer)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [tickers]);

  const filtered = useMemo(() => {
    return tickers
      .filter((ticker) =>
        mentionType === "all" ? true : ticker.mention_type === mentionType,
      )
      .filter((ticker) =>
        layer === "all" ? true : ticker.value_chain_layer === layer,
      )
      .filter(
        (ticker) =>
          Math.max(
            ticker.exposure_score,
            ticker.purity_score,
            ticker.asymmetry_score,
          ) >= minScore,
      )
      .sort((a, b) => {
        return (
          b.asymmetry_score - a.asymmetry_score ||
          b.purity_score - a.purity_score ||
          b.exposure_score - a.exposure_score ||
          a.symbol.localeCompare(b.symbol)
        );
      });
  }, [layer, mentionType, minScore, tickers]);

  const grouped = useMemo(() => {
    const map = new Map<string, SourceDetailTicker[]>();
    for (const ticker of filtered) {
      const key = ticker.thesis_link || "Unlinked thesis";
      map.set(key, [...(map.get(key) || []), ticker]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <section className="panel">
      <div className="panel-title-row">
        <div>
          <h2>Equity expressions</h2>
          <p className="panel-lead">
            Filter the source&apos;s public-market map by thesis quality,
            value-chain layer, and second-order exposure.
          </p>
        </div>
        <span className="result-count">{filtered.length} shown</span>
      </div>

      <div className="filter-bar">
        <label>
          <span>Mention</span>
          <select
            value={mentionType}
            onChange={(event) =>
              setMentionType(event.currentTarget.value as "all" | MentionType)
            }
          >
            {MENTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Layer</span>
          <select
            value={layer}
            onChange={(event) => setLayer(event.currentTarget.value)}
          >
            <option value="all">All layers</option>
            {layers.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Minimum score</span>
          <input
            type="range"
            min={1}
            max={5}
            value={minScore}
            onChange={(event) => setMinScore(Number(event.currentTarget.value))}
          />
          <strong>{minScore}/5</strong>
        </label>
      </div>

      {grouped.length === 0 ? (
        <p>No tickers match the current filters.</p>
      ) : (
        <div className="thesis-ticker-groups">
          {grouped.map(([thesis, items]) => (
            <div key={thesis} className="ticker-group">
              <h3>{thesis}</h3>
              <div className="ticker-grid">
                {items.map((ticker) => (
                  <TickerCard key={ticker.symbol} ticker={ticker} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
