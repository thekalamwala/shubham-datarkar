"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Admin-only: approve a finished article for a brand (with category) or reject it. */
export function ApproveControl({
  id, brand, categories, defaultCategory, initialState,
}: { id: string; brand: string; categories: string[]; defaultCategory: string; initialState: string }) {
  const [category, setCategory] = useState(defaultCategory);
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function send(decision: "approve" | "reject") {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/kalamai/articles/${id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brand, category, decision }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok) setState(data.publish_state);
    else setErr(data?.error ?? "Request failed.");
    setBusy(false);
  }

  return (
    <div className="rounded-card border border-border bg-card p-5">
      <p className="text-sm font-medium text-foreground">Publish to {brand}</p>
      <p className="mt-1 text-xs text-muted-foreground">State: {state}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          aria-label="Category"
        >
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <Button size="sm" disabled={busy} onClick={() => send("approve")}>Approve</Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => send("reject")}>Reject</Button>
      </div>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
