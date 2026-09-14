"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AddSourceForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [filename, setFilename] = useState("");
  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/sources", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.get("title"), url: form.get("url"), show_host: form.get("show_host"), notes: form.get("notes"), transcript }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save source.");
      router.push(`/sources/${data.id}`); router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save source."); setLoading(false);
    }
  }
  return <form className="source-form" onSubmit={onSubmit}>
    <section className="panel source-input-panel"><span className="eyebrow">01 / Source details</span><h2>What are you researching?</h2>
      <label className="field"><span>Title</span><input name="title" required placeholder="Give this source a recognizable title" autoComplete="off" /></label>
      <label className="field"><span>Original source URL</span><input name="url" type="url" required placeholder="https://youtube.com/watch?v=… or an article URL" autoComplete="off" /></label>
      <p className="helper-text">The link is saved as a reference. Add the transcript or article text below; the app doesn’t fetch it automatically.</p>
      <details className="optional-details"><summary>Host and personal notes <span>Optional</span></summary><label className="field"><span>Show / host</span><input name="show_host" placeholder="Podcast, publication, or interviewer" /></label><label className="field"><span>Your notes</span><textarea name="notes" rows={3} placeholder="Why this source caught your attention. These notes are for your reference." /></label></details>
    </section>
    <section className="panel source-input-panel"><div className="panel-title-row"><div><span className="eyebrow">02 / Source material</span><h2>Add the text to analyze</h2></div><span className="result-count" role="status">{words.toLocaleString()} words</span></div>
      <label className="file-import"><span>Import a text file</span><input type="file" accept=".txt,.md,.srt,.vtt,text/plain" disabled={loading} onChange={async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setError(null);
        try {
          if (!/\.(txt|md|srt|vtt)$/i.test(file.name)) throw new Error("Choose a .txt, .md, .srt, or .vtt file.");
          if (file.size > 2_000_000) throw new Error("Choose a text file smaller than 2 MB.");
          setTranscript(await file.text()); setFilename(file.name);
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not read file."); }
        event.target.value = "";
      }} /><small>{filename || ".txt, .md, .srt, or .vtt · up to 2 MB"}</small></label>
      <label className="field field-transcript"><span>Or paste the transcript / article text</span><textarea name="transcript" rows={14} required value={transcript} onChange={(event) => { setTranscript(event.target.value); setFilename(""); }} placeholder="Paste the complete text. Speaker names and timestamps can stay in." /></label>
      <details className="optional-details"><summary>Where do I find a transcript?</summary><p>For YouTube, expand the video description and look for “Show transcript.” Copy the transcript text. For podcasts, use the publisher’s transcript when available. For articles, paste the body text you have access to.</p></details>
    </section>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={loading || !words}>{loading ? "Saving source…" : "Save and open source →"}</button><span className="helper-text">Saving is local. You choose when to start research.</span></div>
  </form>;
}
