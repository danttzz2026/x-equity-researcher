import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type {
  Claim,
  MarketThesis,
  ResearchResult,
  ResearchRun,
  Source,
  SourceDetail,
  SourceListItem,
  SourceStatus,
  Theme,
  TickerDetail,
  TickerListItem,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH =
  process.env.X_EQUITY_DB_PATH?.trim() || path.join(DATA_DIR, "x-equity.db");

let dbInstance: Database.Database | null = null;

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  ensureDataDir();
  dbInstance = new Database(DB_PATH);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  migrate(dbInstance);
  return dbInstance;
}

export function closeDbForTest() {
  dbInstance?.close();
  dbInstance = null;
}

function tableColumns(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return new Set(rows.map((r) => r.name));
}

function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  definition: string,
) {
  const cols = tableColumns(db, table);
  if (!cols.has(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      show_host TEXT,
      notes TEXT,
      transcript TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS research_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL UNIQUE,
      model TEXT NOT NULL,
      summary TEXT NOT NULL,
      quality_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      research_run_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sector TEXT,
      description TEXT NOT NULL,
      market_structure TEXT,
      FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS market_theses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      research_run_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      magnitude_claim TEXT,
      technical_driver TEXT,
      value_chain TEXT,
      why_it_matters TEXT NOT NULL,
      time_horizon TEXT,
      evidence_snippets TEXT,
      FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      research_run_id INTEGER NOT NULL,
      claim TEXT NOT NULL,
      importance TEXT,
      evidence_snippet TEXT,
      FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      company_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticker_mentions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      research_run_id INTEGER NOT NULL,
      ticker_id INTEGER NOT NULL,
      confidence TEXT NOT NULL,
      rationale TEXT NOT NULL,
      mention_type TEXT NOT NULL,
      themes TEXT,
      value_chain_layer TEXT,
      thesis_link TEXT,
      time_horizon TEXT,
      exchange TEXT,
      country TEXT,
      exposure_score INTEGER NOT NULL DEFAULT 3,
      purity_score INTEGER NOT NULL DEFAULT 3,
      asymmetry_score INTEGER NOT NULL DEFAULT 3,
      mega_cap INTEGER NOT NULL DEFAULT 0,
      evidence_snippet TEXT,
      counter_thesis TEXT,
      FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (ticker_id) REFERENCES tickers(id) ON DELETE CASCADE,
      UNIQUE(research_run_id, ticker_id)
    );
  `);

  ensureColumn(db, "research_runs", "quality_notes", "TEXT");
  ensureColumn(db, "market_theses", "evidence_snippets", "TEXT");
  ensureColumn(db, "claims", "evidence_snippet", "TEXT");
  ensureColumn(db, "ticker_mentions", "value_chain_layer", "TEXT");
  ensureColumn(db, "ticker_mentions", "thesis_link", "TEXT");
  ensureColumn(db, "ticker_mentions", "time_horizon", "TEXT");
  ensureColumn(db, "ticker_mentions", "exchange", "TEXT");
  ensureColumn(db, "ticker_mentions", "country", "TEXT");
  ensureColumn(db, "ticker_mentions", "exposure_score", "INTEGER NOT NULL DEFAULT 3");
  ensureColumn(db, "ticker_mentions", "purity_score", "INTEGER NOT NULL DEFAULT 3");
  ensureColumn(db, "ticker_mentions", "asymmetry_score", "INTEGER NOT NULL DEFAULT 3");
  ensureColumn(db, "ticker_mentions", "mega_cap", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "ticker_mentions", "evidence_snippet", "TEXT");
  ensureColumn(db, "ticker_mentions", "counter_thesis", "TEXT");
}

export function listSources(): SourceListItem[] {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT
        s.*,
        COALESCE((
          SELECT COUNT(DISTINCT tm.ticker_id)
          FROM research_runs rr
          JOIN ticker_mentions tm ON tm.research_run_id = rr.id
          WHERE rr.source_id = s.id
        ), 0) AS ticker_count
      FROM sources s
      ORDER BY s.updated_at DESC
    `,
    )
    .all() as SourceListItem[];
}

export function getSource(id: number): Source | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM sources WHERE id = ?").get(id) as
    | Source
    | undefined;
}

export function getSourceDetail(id: number): SourceDetail | null {
  const source = getSource(id);
  if (!source) return null;

  const db = getDb();
  const research = db
    .prepare("SELECT * FROM research_runs WHERE source_id = ?")
    .get(id) as ResearchRun | undefined;

  if (!research) {
    return {
      ...source,
      research: null,
      themes: [],
      market_theses: [],
      claims: [],
      tickers: [],
    };
  }

  const themes = db
    .prepare("SELECT * FROM themes WHERE research_run_id = ? ORDER BY id")
    .all(research.id) as Theme[];

  const market_theses = db
    .prepare(
      "SELECT * FROM market_theses WHERE research_run_id = ? ORDER BY id",
    )
    .all(research.id) as MarketThesis[];

  const claims = db
    .prepare("SELECT * FROM claims WHERE research_run_id = ? ORDER BY id")
    .all(research.id) as Claim[];

  const tickers = db
    .prepare(
      `
      SELECT
        t.symbol,
        t.company_name,
        tm.confidence,
        tm.rationale,
        tm.mention_type,
        tm.themes,
        tm.value_chain_layer,
        tm.thesis_link,
        tm.time_horizon,
        tm.exchange,
        tm.country,
        tm.exposure_score,
        tm.purity_score,
        tm.asymmetry_score,
        tm.mega_cap,
        tm.evidence_snippet,
        tm.counter_thesis
      FROM ticker_mentions tm
      JOIN tickers t ON t.id = tm.ticker_id
      WHERE tm.research_run_id = ?
      ORDER BY
        tm.asymmetry_score DESC,
        tm.purity_score DESC,
        tm.exposure_score DESC,
        CASE tm.mention_type
          WHEN 'second_order' THEN 1
          WHEN 'related' THEN 2
          ELSE 3
        END,
        CASE tm.confidence
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        t.symbol
    `,
    )
    .all(research.id) as SourceDetail["tickers"];

  return { ...source, research, themes, market_theses, claims, tickers };
}

export function createSource(input: {
  title: string;
  url: string;
  show_host?: string;
  notes?: string;
  transcript: string;
}): Source {
  const db = getDb();
  const result = db
    .prepare(
      `
      INSERT INTO sources (title, url, show_host, notes, transcript)
      VALUES (@title, @url, @show_host, @notes, @transcript)
    `,
    )
    .run({
      title: input.title.trim(),
      url: input.url.trim(),
      show_host: input.show_host?.trim() || null,
      notes: input.notes?.trim() || null,
      transcript: input.transcript.trim(),
    });

  return getSource(Number(result.lastInsertRowid))!;
}

export function updateSourceStatus(
  id: number,
  status: SourceStatus,
  errorMessage: string | null = null,
) {
  const db = getDb();
  db.prepare(
    `
    UPDATE sources
    SET status = ?, error_message = ?, updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(status, errorMessage, id);
}

export function deleteSource(id: number) {
  const db = getDb();
  db.prepare("DELETE FROM sources WHERE id = ?").run(id);
}

export function saveResearchResult(
  sourceId: number,
  model: string,
  result: ResearchResult,
) {
  const db = getDb();

  const tx = db.transaction(() => {
    const existing = db
      .prepare("SELECT id FROM research_runs WHERE source_id = ?")
      .get(sourceId) as { id: number } | undefined;

    if (existing) {
      db.prepare("DELETE FROM research_runs WHERE id = ?").run(existing.id);
    }

    const run = db
      .prepare(
        `
        INSERT INTO research_runs (source_id, model, summary, quality_notes)
        VALUES (?, ?, ?, ?)
      `,
      )
      .run(
        sourceId,
        model,
        result.summary,
        result.quality_notes.length ? JSON.stringify(result.quality_notes) : null,
      );

    const runId = Number(run.lastInsertRowid);

    const insertTheme = db.prepare(`
      INSERT INTO themes (research_run_id, name, sector, description, market_structure)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const theme of result.themes) {
      insertTheme.run(
        runId,
        theme.name,
        theme.sector,
        theme.description,
        theme.market_structure,
      );
    }

    const insertThesis = db.prepare(`
      INSERT INTO market_theses (
        research_run_id, name, magnitude_claim, technical_driver,
        value_chain, why_it_matters, time_horizon, evidence_snippets
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const thesis of result.market_theses) {
      insertThesis.run(
        runId,
        thesis.name,
        thesis.magnitude_claim,
        thesis.technical_driver,
        thesis.value_chain,
        thesis.why_it_matters,
        thesis.time_horizon,
        thesis.evidence_snippets.length
          ? JSON.stringify(thesis.evidence_snippets)
          : null,
      );
    }

    const insertClaim = db.prepare(`
      INSERT INTO claims (research_run_id, claim, importance, evidence_snippet)
      VALUES (?, ?, ?, ?)
    `);

    for (const claim of result.claims) {
      insertClaim.run(
        runId,
        claim.claim,
        claim.importance,
        claim.evidence_snippet,
      );
    }

    const upsertTicker = db.prepare(`
      INSERT INTO tickers (symbol, company_name)
      VALUES (?, ?)
      ON CONFLICT(symbol) DO UPDATE SET company_name = excluded.company_name
    `);

    const getTickerId = db.prepare(
      "SELECT id FROM tickers WHERE symbol = ?",
    );

    const insertMention = db.prepare(`
      INSERT INTO ticker_mentions (
        research_run_id, ticker_id, confidence, rationale, mention_type,
        themes, value_chain_layer, thesis_link, time_horizon, exchange, country,
        exposure_score, purity_score, asymmetry_score, mega_cap,
        evidence_snippet, counter_thesis
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ticker of result.tickers) {
      const symbol = ticker.symbol.toUpperCase().trim();
      if (!symbol) continue;

      upsertTicker.run(symbol, ticker.company_name.trim());
      const row = getTickerId.get(symbol) as { id: number };
      insertMention.run(
        runId,
        row.id,
        ticker.confidence,
        ticker.rationale,
        ticker.mention_type,
        ticker.themes.length ? ticker.themes.join(", ") : null,
        ticker.value_chain_layer,
        ticker.thesis_link,
        ticker.time_horizon,
        ticker.exchange,
        ticker.country,
        ticker.exposure_score,
        ticker.purity_score,
        ticker.asymmetry_score,
        ticker.mega_cap ? 1 : 0,
        ticker.evidence_snippet,
        ticker.counter_thesis,
      );
    }

    db.prepare(
      `
      UPDATE sources
      SET status = 'researched', error_message = NULL, updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(sourceId);
  });

  tx();
}

export function listTickers(): TickerListItem[] {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT
        t.symbol,
        t.company_name,
        COUNT(tm.id) AS mention_count,
        COUNT(DISTINCT rr.source_id) AS source_count,
        SUM(CASE WHEN tm.mention_type = 'second_order' THEN 1 ELSE 0 END) AS second_order_count,
        ROUND(AVG(tm.exposure_score), 1) AS avg_exposure_score,
        ROUND(AVG(tm.purity_score), 1) AS avg_purity_score,
        ROUND(AVG(tm.asymmetry_score), 1) AS avg_asymmetry_score,
        MAX(rr.created_at) AS latest_mention_at
      FROM tickers t
      JOIN ticker_mentions tm ON tm.ticker_id = t.id
      JOIN research_runs rr ON rr.id = tm.research_run_id
      GROUP BY t.id
      ORDER BY source_count DESC, mention_count DESC, t.symbol
    `,
    )
    .all() as TickerListItem[];
}

export function getTickerDetail(symbol: string): TickerDetail | null {
  const db = getDb();
  const normalized = symbol.toUpperCase();
  const ticker = db
    .prepare("SELECT * FROM tickers WHERE symbol = ?")
    .get(normalized) as { symbol: string; company_name: string } | undefined;

  if (!ticker) return null;

  const mentions = db
    .prepare(
      `
      SELECT
        s.id AS source_id,
        s.title AS source_title,
        s.url AS source_url,
        tm.confidence,
        tm.rationale,
        tm.mention_type,
        tm.themes,
        tm.value_chain_layer,
        tm.thesis_link,
        tm.time_horizon,
        tm.exchange,
        tm.country,
        tm.exposure_score,
        tm.purity_score,
        tm.asymmetry_score,
        tm.mega_cap,
        tm.evidence_snippet,
        tm.counter_thesis,
        rr.created_at AS researched_at
      FROM ticker_mentions tm
      JOIN tickers t ON t.id = tm.ticker_id
      JOIN research_runs rr ON rr.id = tm.research_run_id
      JOIN sources s ON s.id = rr.source_id
      WHERE t.symbol = ?
      ORDER BY tm.asymmetry_score DESC, rr.created_at DESC
    `,
    )
    .all(normalized) as TickerDetail["mentions"];

  return {
    symbol: ticker.symbol,
    company_name: ticker.company_name,
    mentions,
  };
}
