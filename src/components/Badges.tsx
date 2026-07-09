import type { Confidence, MentionType, SourceStatus } from "@/lib/types";

const statusLabels: Record<SourceStatus, string> = {
  draft: "Draft",
  researching: "Researching",
  researched: "Researched",
  error: "Error",
};

const mentionLabels: Record<MentionType, string> = {
  explicit: "named",
  second_order: "second-order",
  related: "related",
};

export function StatusBadge({ status }: { status: SourceStatus }) {
  return (
    <span className={`badge badge-${status}`}>{statusLabels[status]}</span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span className={`badge badge-confidence-${confidence}`}>
      {confidence}
    </span>
  );
}

export function MentionBadge({ type }: { type: MentionType | string }) {
  const normalized =
    type === "explicit" || type === "second_order" || type === "related"
      ? type
      : "related";
  return (
    <span className={`badge badge-mention-${normalized}`}>
      {mentionLabels[normalized]}
    </span>
  );
}

export function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value.endsWith("Z") ? value : `${value}Z`));
  } catch {
    return value;
  }
}
