"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteSourceButton({ sourceId }: { sourceId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (!window.confirm("Delete this source and its research?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed.");
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Delete failed.");
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={onDelete}
      disabled={loading}
    >
      {loading ? "Deleting…" : "Delete"}
    </button>
  );
}
