export interface AuditInput {
  segmentsTotal: number;
  segmentsProcessed: number;
  quotes: Array<{ quoteText: string; segmentText: string }>;
  tickers: Array<{ hasClaim: boolean; hasWebSource: boolean }>;
  /** Quotes kept as evidence but never anchored back to the transcript. */
  unverifiedQuotes?: number;
  /** Segments that produced no claims at all. */
  emptySegments?: number;
}

export function auditResearch(input: AuditInput) {
  const notes: string[] = [];
  const coverage = input.segmentsTotal ? Math.round((input.segmentsProcessed / input.segmentsTotal) * 100) : 0;
  const exactQuotes = input.quotes.every(({ quoteText, segmentText }) => segmentText.includes(quoteText));
  const groundedTickers = input.tickers.filter((ticker) => ticker.hasClaim && ticker.hasWebSource).length;
  if (coverage < 100) notes.push(`Segment coverage is ${coverage}%; complete every transcript segment before calling the run complete.`);
  if (!exactQuotes) notes.push("One or more stored quotes do not exactly match their transcript segment.");
  if (input.tickers.length && groundedTickers < input.tickers.length) notes.push("Some ticker expressions lack both transcript and web citation linkage.");
  const unverifiedQuotes = input.unverifiedQuotes ?? 0;
  const emptySegments = input.emptySegments ?? 0;
  if (unverifiedQuotes) notes.push(`${unverifiedQuotes} quote(s) could not be anchored to the transcript and are flagged unverified.`);
  if (emptySegments) notes.push(`${emptySegments} of ${input.segmentsTotal} segments yielded no investable claims.`);
  return { coverage, exactQuotes, groundedTickers, unverifiedQuotes, emptySegments, notes };
}
