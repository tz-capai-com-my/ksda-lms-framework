"use client";
import { useState } from "react";
import { brand } from "@/config/brand";

export default function LearnerExport() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function download() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/admin/learners/export", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/csv")) {
        setMessage(response.status === 403 ? "Your admin session has ended. Sign in again and retry." : "The full export could not be prepared. Please try again; no partial file was downloaded.");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${brand.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) || "KSDA"}_Learner_Register_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage("Export ready. Keep this file private; it contains learner contact details.");
    } catch {
      setMessage("The export could not be downloaded. Check your connection and try again.");
    } finally { setBusy(false); }
  }
  return <div className="admin-export"><button type="button" onClick={download} disabled={busy}>{busy ? "Preparing all records…" : "Export all learners (CSV)"}</button><span role="status" aria-live="polite">{message}</span></div>;
}
