"use client";

import { useState, useTransition } from "react";
import { sendDiscordTestMessage } from "@/lib/actions/discord";

export default function DiscordTestButton() {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const { error } = await sendDiscordTestMessage();
            setResult(error ? { ok: false, text: error } : { ok: true, text: "Sent. Check your Discord channel." });
          })
        }
        className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface-raised disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send a test message to Discord"}
      </button>
      {result && <span className={`text-sm ${result.ok ? "text-success" : "text-danger"}`}>{result.text}</span>}
    </div>
  );
}
