import type { SegmentInput } from "./types";

const TARGET_CHARS = 8_000;
const OVERLAP_CHARS = 900;

/** Paragraph-aware chunks keep source offsets stable for evidence deep links. */
export function chunkTranscript(transcript: string): SegmentInput[] {
  const leadingWhitespace = transcript.length - transcript.trimStart().length;
  const text = transcript.trimStart();
  if (!text.trim()) return [];

  const paragraphs = Array.from(text.matchAll(/\S[\s\S]*?(?=\n\s*\n|$)/g));
  const paragraphUnits = paragraphs.length
    ? paragraphs.map((match) => ({
        text: match[0],
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      }))
    : [{ text, start: 0, end: text.length }];
  const units = paragraphUnits.flatMap((unit) => splitOversizedUnit(unit));

  const chunks: SegmentInput[] = [];
  let cursor = 0;
  while (cursor < units.length) {
    const start = units[cursor].start;
    let end = units[cursor].end;
    let next = cursor + 1;
    while (
      next < units.length &&
      units[next].end - start <= TARGET_CHARS
    ) {
      end = units[next].end;
      next += 1;
    }
    const segmentText = text.slice(start, end);
    chunks.push({
      uid: `seg-${chunks.length + 1}-${leadingWhitespace + start}-${leadingWhitespace + end}`,
      index: chunks.length,
      startOffset: leadingWhitespace + start,
      endOffset: leadingWhitespace + end,
      text: segmentText,
    });

    if (next >= units.length) break;
    const overlapStart = Math.max(start, end - OVERLAP_CHARS);
    const overlapIndex = units.findIndex((unit) => unit.end > overlapStart);
    cursor = Math.max(cursor + 1, overlapIndex === -1 ? next : overlapIndex);
  }

  return chunks;
}

function splitOversizedUnit(unit: { text: string; start: number; end: number }) {
  if (unit.text.length <= TARGET_CHARS) return [unit];
  const parts: Array<{ text: string; start: number; end: number }> = [];
  let cursor = 0;
  while (cursor < unit.text.length) {
    const upper = Math.min(unit.text.length, cursor + TARGET_CHARS);
    if (upper === unit.text.length) {
      parts.push({ text: unit.text.slice(cursor), start: unit.start + cursor, end: unit.end });
      break;
    }
    const search = unit.text.slice(cursor, upper);
    const breakAt = Math.max(search.lastIndexOf("\n"), search.lastIndexOf(". ") + 1, search.lastIndexOf("? ") + 1, search.lastIndexOf("! ") + 1);
    const end = breakAt > TARGET_CHARS / 2 ? cursor + breakAt : upper;
    parts.push({ text: unit.text.slice(cursor, end), start: unit.start + cursor, end: unit.start + end });
    cursor = end;
  }
  return parts;
}

export function findExactQuoteOffset(
  segment: SegmentInput,
  quote: string,
): { startOffset: number; endOffset: number } | null {
  const normalized = quote.trim();
  if (!normalized) return null;
  const index = segment.text.indexOf(normalized);
  if (index === -1) return null;
  return {
    startOffset: segment.startOffset + index,
    endOffset: segment.startOffset + index + normalized.length,
  };
}

/** How confidently a model-returned quote was anchored back to the transcript. */
export type QuoteMatchKind = "exact" | "normalized" | "fuzzy" | "unverified";

export interface QuoteAnchor {
  startOffset: number;
  endOffset: number;
  matchKind: QuoteMatchKind;
}

/**
 * Models retype quotes rather than copying bytes: smart quotes, collapsed
 * newlines and dropped filler all defeat a raw indexOf. Anchoring walks from
 * strict to loose so a cosmetic difference never costs us the evidence.
 */
export function findQuoteAnchor(segment: SegmentInput, quote: string): QuoteAnchor {
  const unverified: QuoteAnchor = {
    startOffset: segment.startOffset,
    endOffset: segment.endOffset,
    matchKind: "unverified",
  };
  const trimmed = quote.trim();
  if (!trimmed) return unverified;

  const exact = findExactQuoteOffset(segment, trimmed);
  if (exact) return { ...exact, matchKind: "exact" };

  const map = buildNormalizedIndex(segment.text);
  const needle = normalizeQuoteText(trimmed);
  if (!needle) return unverified;

  const at = map.normalized.indexOf(needle);
  if (at !== -1) {
    return {
      startOffset: segment.startOffset + map.toOriginal[at],
      endOffset: segment.startOffset + map.originalEndFor(at + needle.length - 1),
      matchKind: "normalized",
    };
  }

  return findFuzzyWindow(segment, map, needle) ?? unverified;
}

/** Fold away the differences a model introduces while retyping a quote. */
export function normalizeQuoteText(value: string) {
  return value
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[  -​]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalized text plus the original index each normalized character came from. */
function buildNormalizedIndex(text: string) {
  const chars: string[] = [];
  const toOriginal: number[] = [];
  let pendingSpace = false;

  for (let index = 0; index < text.length; index += 1) {
    const normalizedChar = normalizeQuoteText(text[index]);
    if (!normalizedChar) {
      // Whitespace (and anything that folds to nothing) collapses to one space.
      if (chars.length) pendingSpace = true;
      continue;
    }
    if (pendingSpace) {
      chars.push(" ");
      toOriginal.push(index);
      pendingSpace = false;
    }
    for (const char of normalizedChar) {
      chars.push(char);
      toOriginal.push(index);
    }
  }

  return {
    normalized: chars.join(""),
    toOriginal,
    // The last normalized char of a match may expand from one original char.
    originalEndFor: (normalizedIndex: number) =>
      (toOriginal[normalizedIndex] ?? text.length - 1) + 1,
  };
}

const FUZZY_MIN_TOKENS = 4;
const FUZZY_MIN_COVERAGE = 0.6;

/**
 * Last resort: slide a window the size of the quote across the segment and keep
 * the position sharing the most distinctive tokens with it.
 */
function findFuzzyWindow(
  segment: SegmentInput,
  map: ReturnType<typeof buildNormalizedIndex>,
  needle: string,
): QuoteAnchor | null {
  const tokens = needle.split(" ").filter((token) => token.length > 3);
  if (tokens.length < FUZZY_MIN_TOKENS) return null;

  const haystack = map.normalized;
  const windowSize = needle.length;
  const step = Math.max(1, Math.floor(windowSize / 8));
  let best = { score: 0, start: -1 };

  for (let start = 0; start < haystack.length; start += step) {
    const window = haystack.slice(start, start + windowSize);
    let hits = 0;
    for (const token of tokens) if (window.includes(token)) hits += 1;
    const score = hits / tokens.length;
    if (score > best.score) best = { score, start };
    if (score === 1) break;
  }

  if (best.start === -1 || best.score < FUZZY_MIN_COVERAGE) return null;
  const end = Math.min(best.start + windowSize, haystack.length) - 1;
  return {
    startOffset: segment.startOffset + map.toOriginal[best.start],
    endOffset: segment.startOffset + map.originalEndFor(end),
    matchKind: "fuzzy",
  };
}
