"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AddSourceForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") || ""),
      url: String(form.get("url") || ""),
      show_host: String(form.get("show_host") || ""),
      notes: String(form.get("notes") || ""),
      transcript: String(form.get("transcript") || ""),
    };

    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not save source.");
      }
      router.push(`/sources/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save source.");
      setLoading(false);
    }
  }

  return (
    <form className="source-form" onSubmit={onSubmit}>
      <label className="field">
        <span>Title</span>
        <input
          name="title"
          required
          placeholder="Episode or article title"
          autoComplete="off"
        />
      </label>

      <label className="field">
        <span>URL</span>
        <input
          name="url"
          type="url"
          required
          placeholder="https://youtube.com/... or article link"
          autoComplete="off"
        />
      </label>

      <label className="field">
        <span>Show / host</span>
        <input
          name="show_host"
          placeholder="Optional — podcast or interviewer"
          autoComplete="off"
        />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea
          name="notes"
          rows={3}
          placeholder="Optional context for the research run"
        />
      </label>

      <label className="field field-transcript">
        <span>Transcript</span>
        <textarea
          name="transcript"
          rows={18}
          required
          placeholder="Paste the full transcript here"
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Saving…" : "Save source"}
        </button>
      </div>
    </form>
  );
}
