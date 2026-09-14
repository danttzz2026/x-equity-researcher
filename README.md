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
2. **Run research** — a resumable, evidence-first run processes each transcript segment, builds thesis clusters, verifies live facts, maps equities, writes chapters, and audits coverage
3. **Review** — use the source overview, full report, thesis pages, company dossiers, and the searchable evidence ledger
4. **Tickers** — cross-source view of names that keep showing up

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- SQLite (`data/x-equity.db`) via better-sqlite3
- Google Gemini API (`gemini-3.5-flash` by default; override with `GEMINI_MODEL`)

Research results and API key configuration are stored locally. Running research sends transcript content to Google Gemini. Research results are persisted so reopening a source does not re-bill unless you run research again.

## Research quality

The research pipeline is evidence-first and thesis-first rather than ticker-first:

- Split every transcript into stable, overlapping segments. Label quotes as exact, normalized, approximate, or unverified; only exact and normalized matches are used to build new theses.
- Cluster a complete claim ledger into causal theses, then verify current supplier, listing, and exposure facts with Google Search grounding.
- Require each retained equity expression to link to transcript evidence and a stored web source.
- Let the evidence determine the number of theses, equities, and report length; avoid output quotas.
- Prefer second-order public equities over obvious mega-cap anchors, with exposure, purity, asymmetry, catalyst, risk, and falsifier fields.
- Preserve every completed run in SQLite. Interrupted runs can resume at the last persisted stage without repeating earlier model calls.
- Audit segment coverage, exact quote matching, grounding links, and ticker linkages before marking the run complete.

The default model is `gemini-3.5-flash`; set `GEMINI_MODEL` in `.env.local` to override it.

Run checks with:

```bash
npm run lint
npm test
npm run build
```

## Using the desk

- Search the library by source title, host, or saved research summary.
- Paste source text or import a `.txt`, `.md`, `.srt`, or `.vtt` file. Source URLs are saved as references, not automatically fetched.
- Keep the source page open during research. Pause finishes the current step; Resume continues from saved progress. Concurrent tabs share the current stage request within the local server.
- Scan compact thesis and company rows on the overview. The report shows one chapter takeaway at a time; expand it to read the full analysis. Export retains all chapters and the evidence appendix.
- Search the paginated evidence ledger and filter approximate or unverified quotes for review. Citation links open the correct page and claim. Companies appear in compact, paginated rows; expand one for its rationale and risks.
- Overview, Report, and Evidence share a fixed source header. Tabs prefetch their content and reset only the inner reading area.
