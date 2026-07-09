# X Equity Researcher

Local equity research desk. Paste a YouTube or article link plus transcript; Gemini extracts themes and markets, then surfaces the equities involved.

## Setup

```bash
cp .env.example .env.local
# add your GEMINI_API_KEY
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Flow

1. **Add source** — title, URL, optional show/host + notes, full transcript
2. **Run research** — thesis extraction, value-chain mapping, ticker mapping, and quality critique via Gemini
3. **Review** — source brief, grounded theses, claims, quality notes, and filterable ticker cards
4. **Tickers** — cross-source view of names that keep showing up

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- SQLite (`data/x-equity.db`) via better-sqlite3
- Google Gemini API (`gemini-3.5-flash` by default; override with `GEMINI_MODEL`)

Data and API keys stay on your machine. Research results are persisted so reopening a source does not re-bill unless you run research again.

## Research quality

The research pipeline is thesis-first rather than ticker-first:

- Extract market theses, technical bottlenecks, and transcript evidence.
- Map theses through the AI infrastructure value chain.
- Prefer second-order public equities over obvious mega-cap anchors.
- Score ticker expressions for exposure, purity, and asymmetry.
- Save quality notes when output is thin, mega-cap-heavy, weakly grounded, or too narrow by value-chain layer.

Run checks with:

```bash
npm run lint
npm test
npm run build
```
