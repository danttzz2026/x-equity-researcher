export type SourceStatus = "draft" | "researching" | "researched" | "error";

export type Confidence = "high" | "medium" | "speculative";

export type MentionType = "explicit" | "second_order" | "related";

export interface Source {
  id: number;
  title: string;
  url: string;
  show_host: string | null;
  notes: string | null;
  transcript: string;
  status: SourceStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchRun {
  id: number;
  source_id: number;
  model: string;
  summary: string;
  created_at: string;
}

export interface Theme {
  id: number;
  research_run_id: number;
  name: string;
  sector: string | null;
  description: string;
  market_structure: string | null;
}

export interface MarketThesis {
  id: number;
  research_run_id: number;
  name: string;
  magnitude_claim: string | null;
  technical_driver: string | null;
  value_chain: string | null;
  why_it_matters: string;
  time_horizon: string | null;
}

export interface Claim {
  id: number;
  research_run_id: number;
  claim: string;
  importance: string | null;
}

export interface Ticker {
  id: number;
  symbol: string;
  company_name: string;
  created_at: string;
}

export interface TickerMention {
  id: number;
  research_run_id: number;
  ticker_id: number;
  confidence: Confidence;
  rationale: string;
  mention_type: MentionType;
  themes: string | null;
  value_chain_layer: string | null;
  thesis_link: string | null;
  time_horizon: string | null;
}

export interface SourceListItem extends Source {
  ticker_count: number;
}

export interface SourceDetailTicker {
  symbol: string;
  company_name: string;
  confidence: Confidence;
  rationale: string;
  mention_type: MentionType;
  themes: string | null;
  value_chain_layer: string | null;
  thesis_link: string | null;
  time_horizon: string | null;
}

export interface SourceDetail extends Source {
  research: ResearchRun | null;
  themes: Theme[];
  market_theses: MarketThesis[];
  claims: Claim[];
  tickers: SourceDetailTicker[];
}

export interface TickerListItem {
  symbol: string;
  company_name: string;
  mention_count: number;
  source_count: number;
  latest_mention_at: string;
}

export interface TickerDetail {
  symbol: string;
  company_name: string;
  mentions: Array<{
    source_id: number;
    source_title: string;
    source_url: string;
    confidence: Confidence;
    rationale: string;
    mention_type: MentionType;
    themes: string | null;
    value_chain_layer: string | null;
    thesis_link: string | null;
    time_horizon: string | null;
    researched_at: string;
  }>;
}

export interface ResearchResult {
  summary: string;
  themes: Array<{
    name: string;
    sector: string | null;
    description: string;
    market_structure: string | null;
  }>;
  market_theses: Array<{
    name: string;
    magnitude_claim: string | null;
    technical_driver: string | null;
    value_chain: string | null;
    why_it_matters: string;
    time_horizon: string | null;
  }>;
  claims: Array<{
    claim: string;
    importance: string | null;
  }>;
  tickers: Array<{
    symbol: string;
    company_name: string;
    confidence: Confidence;
    rationale: string;
    mention_type: MentionType;
    themes: string[];
    value_chain_layer: string | null;
    thesis_link: string | null;
    time_horizon: string | null;
  }>;
}
