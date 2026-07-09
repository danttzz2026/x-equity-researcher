"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResearchButton({
  sourceId,
  disabled,
  hasResearch,
}: {
  sourceId: number;
  disabled?: boolean;
  hasResearch?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runResearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sources/${sourceId}/research`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Research failed.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="action-stack">
      <button
        type="button"
        className="btn btn-primary"
        onClick={runResearch}
        disabled={disabled || loading}
      >
        {loading ? (
          <span className="btn-loading">
            <span className="pulse-dot" aria-hidden />
            Deep researching…
          </span>
        ) : hasResearch ? (
          "Re-run deep research"
        ) : (
          "Run deep research"
        )}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
