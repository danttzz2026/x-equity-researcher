import { describe, expect, it } from "vitest";
import { chunkTranscript, findExactQuoteOffset, findQuoteAnchor } from "./chunk-transcript";
import { auditResearch } from "./audit-report";

describe("evidence-first segmentation", () => {
  it("covers the complete transcript with stable offsets and usable overlap", () => {
    const transcript = Array.from({ length: 120 }, (_, index) => `Paragraph ${index}: inference rack density increases the demand for power delivery and liquid cooling.`).join("\n\n");
    const first = chunkTranscript(transcript); const second = chunkTranscript(transcript);
    expect(first).toEqual(second);
    expect(first[0].startOffset).toBe(0);
    expect(first.at(-1)?.endOffset).toBe(transcript.length);
    expect(first.length).toBeGreaterThan(1);
    expect(first[1].startOffset).toBeLessThan(first[0].endOffset);
  });

  it("only accepts exact transcript quotes and makes audit failures explicit", () => {
    const [segment] = chunkTranscript("Power availability is the deployment bottleneck for dense inference clusters.");
    const quote = "deployment bottleneck for dense inference";
    expect(findExactQuoteOffset(segment, quote)).toEqual({ startOffset: segment.text.indexOf(quote), endOffset: segment.text.indexOf(quote) + quote.length });
    expect(findExactQuoteOffset(segment, "invented quote")).toBeNull();
    const audit = auditResearch({ segmentsTotal: 2, segmentsProcessed: 1, quotes: [{ quoteText: "not here", segmentText: segment.text }], tickers: [{ hasClaim: false, hasWebSource: false }] });
    expect(audit.coverage).toBe(50);
    expect(audit.exactQuotes).toBe(false);
    expect(audit.notes).toHaveLength(3);
  });

  it("splits an unbroken timestamp transcript at safe sentence boundaries", () => {
    const transcript = Array.from({ length: 160 }, () => "0:00 This is a single pasted paragraph with a technical claim about power density. ").join("");
    const segments = chunkTranscript(transcript);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.at(-1)?.endOffset).toBe(transcript.length);
  });

  it("does not flag a fully covered source for having few findings", () => {
    const audit = auditResearch({
      segmentsTotal: 1, segmentsProcessed: 1,
      quotes: [{ quoteText: "Power is constrained.", segmentText: "Power is constrained." }],
      tickers: [],
    });
    expect(audit.coverage).toBe(100);
    expect(audit.notes).toEqual([]);
  });
});

describe("quote anchoring survives model retyping", () => {
  const transcript = [
    "Speaker A: The thing people miss is that power availability,",
    "not silicon supply, is the real deployment bottleneck for dense",
    "inference clusters — and it’s a five-year problem, not a one-year problem.",
  ].join("\n");
  const [segment] = chunkTranscript(transcript);

  const anchored = (quote: string) => {
    const anchor = findQuoteAnchor(segment, quote);
    return {
      matchKind: anchor.matchKind,
      text: transcript.slice(anchor.startOffset, anchor.endOffset),
    };
  };

  it("anchors a byte-identical quote exactly", () => {
    const result = anchored("power availability,");
    expect(result.matchKind).toBe("exact");
    expect(result.text).toBe("power availability,");
  });

  it("anchors across collapsed newlines and straightened quote marks", () => {
    // The model returns one flowing line with an ASCII apostrophe; the
    // transcript has a hard wrap and a curly one.
    const result = anchored("real deployment bottleneck for dense inference clusters — and it's a five-year problem");
    expect(result.matchKind).toBe("normalized");
    expect(result.text).toContain("deployment bottleneck");
    expect(result.text).toContain("five-year problem");
  });

  it("falls back to a fuzzy window when the model drops filler words", () => {
    const result = anchored("power availability is the real deployment bottleneck for dense inference clusters");
    expect(result.matchKind).toBe("fuzzy");
    expect(result.text).toContain("deployment bottleneck");
  });

  it("flags an invented quote as unverified instead of discarding it", () => {
    const anchor = findQuoteAnchor(segment, "margins will compress across the memory supply chain next year");
    expect(anchor.matchKind).toBe("unverified");
    expect(anchor.startOffset).toBe(segment.startOffset);
    expect(anchor.endOffset).toBe(segment.endOffset);
  });

  it("keeps anchored offsets inside the segment", () => {
    for (const quote of ["power availability,", "deployment bottleneck for dense", "invented text entirely"]) {
      const anchor = findQuoteAnchor(segment, quote);
      expect(anchor.startOffset).toBeGreaterThanOrEqual(segment.startOffset);
      expect(anchor.endOffset).toBeLessThanOrEqual(segment.endOffset);
      expect(anchor.endOffset).toBeGreaterThan(anchor.startOffset);
    }
  });
});
