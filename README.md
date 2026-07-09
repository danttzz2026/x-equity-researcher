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
2. **Run research** — theme/market extraction and ticker discovery via Gemini 2.5 Flash
3. **Review** — source brief, themes, claims, and ticker cards
4. **Tickers** — cross-source view of names that keep showing up

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- SQLite (`data/x-equity.db`) via better-sqlite3
- Google Gemini API (`gemini-3.5-flash` by default; override with `GEMINI_MODEL`)

Data and API keys stay on your machine. Research results are persisted so reopening a source does not re-bill unless you run research again.
