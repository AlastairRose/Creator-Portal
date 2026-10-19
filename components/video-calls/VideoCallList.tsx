"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToVideoCall } from "@/lib/actions/video-calls";
import { displayStatus, MAX_ALTERNATIVE_TIMES, STATUS_LABELS, type DisplayStatus, type VideoCallRequest } from "@/lib/video-calls";

type Row = VideoCallRequest & { creator_name: string };

const REFRESH_MS = 30_000;

// Times are formatted in the viewer's own timezone, which only exists in the
// browser - so render nothing on the server and fill in after mount.
const noopSubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function LocalTime({ iso, withDay = true }: { iso: string; withDay?: boolean }) {
  const mounted = useMounted();
  if (!mounted) return <span className="opacity-0">…</span>;
  const d = new Date(iso);
  return (
    <span>
      {d.toLocaleString(undefined, {
        weekday: withDay ? "short" : undefined,
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })}
    </span>
  );
}

function minutesLeft(iso: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000));
}

const STATUS_TONE: Record<DisplayStatus, string> = {
  pending: "bg-warning/15 text-warning",
  accepted: "bg-success/15 text-success",
  unavailable: "bg-orange/15 text-orange",
  declined: "bg-danger/15 text-danger",
  cancelled: "bg-surface-raised text-muted",
  expired: "bg-surface-raised text-muted",
};

function StatusPill({ status }: { status: DisplayStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[status]}`}>{STATUS_LABELS[status]}</span>;
}

function Details({ r, showCreator }: { r: Row; showCreator: boolean }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-4">
      {showCreator && (
        <div>
          <dt>Creator</dt>
          <dd className="text-sm text-foreground">{r.creator_name || "—"}</dd>
        </div>
      )}
      <div>
        <dt>Fan</dt>
        <dd className="text-sm text-foreground">{r.fan_name}</dd>
      </div>
      <div>
        <dt>Length</dt>
        <dd className="text-sm text-foreground">{r.length_minutes} min</dd>
      </div>
      <div>
        <dt>Price</dt>
        <dd className="text-sm text-foreground">{r.price_usd !== null ? `$${Number(r.price_usd).toFixed(2)}` : "—"}</dd>
      </div>
      <div>
        <dt>When</dt>
        <dd className="text-sm text-foreground">{r.timing === "asap" ? "As soon as possible" : r.requested_for ? <LocalTime iso={r.requested_for} /> : "—"}</dd>
      </div>
      <div>
        <dt>From</dt>
        <dd className="text-sm text-foreground">{r.requested_by_name}</dd>
      </div>
    </dl>
  );
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PendingCard({ r, now, onDone }: { r: Row; now: number; onDone: () => void }) {
  const [mode, setMode] = useState<"choose" | "unavailable" | "decline">("choose");
  const [times, setTimes] = useState<string[]>(Array(MAX_ALTERNATIVE_TIMES).fill(""));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const minInput = toLocalInputValue(new Date(now));

  function submit(response: Parameters<typeof respondToVideoCall>[1]) {
    setError(null);
    startTransition(async () => {
      const result = await respondToVideoCall(r.id, response);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  function submitUnavailable() {
    const chosen = times.filter(Boolean).map((t) => new Date(t).toISOString()); // datetime-local is the phone's own time
    if (chosen.length === 0) {
      setError("Add at least one time you'd be available.");
      return;
    }
    submit({ action: "unavailable", times: chosen, note });
  }

  const left = minutesLeft(r.expires_at, now);

  return (
    <div id={r.id} className="scroll-mt-6 rounded-lg border border-accent/50 bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {r.timing === "asap" ? "Video call - now" : "Video call request"}
        </p>
        <p className="text-xs text-muted">
          {r.timing === "asap" ? `Expires in ${left} min` : <>Sent <LocalTime iso={r.created_at} /></>}
        </p>
      </div>

      <Details r={r} showCreator={false} />
      {r.notes && <p className="mt-3 whitespace-pre-wrap rounded-md bg-surface-raised p-3 text-sm">{r.notes}</p>}

      {mode === "choose" && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => submit({ action: "accept" })}
            className="rounded-md bg-success px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Accept"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode("unavailable")}
            className="rounded-md border border-border bg-surface-raised px-3 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            Not available now
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode("decline")}
            className="rounded-md border border-danger/40 px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}

      {mode === "unavailable" && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-medium">When could you do it instead? Add up to {MAX_ALTERNATIVE_TIMES} times.</p>
          {times.map((t, i) => (
            <label key={i} className="flex flex-col gap-1 text-xs text-muted">
              Option {i + 1}
              {i === 0 ? "" : " (optional)"}
              <input
                type="datetime-local"
                value={t}
                min={minInput}
                onChange={(e) => {
                  setError(null);
                  setTimes((prev) => prev.map((p, j) => (j === i ? e.target.value : p)));
                }}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs text-muted">
            Note for the chat team (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={submitUnavailable}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send times"}
            </button>
            <button type="button" disabled={pending} onClick={() => setMode("choose")} className="px-3 py-2 text-sm text-muted hover:text-foreground">
              Back
            </button>
          </div>
        </div>
      )}

      {mode === "decline" && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-medium">Decline this video call?</p>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Reason (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. Not comfortable with this one"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => submit({ action: "decline", note })}
              className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Sending…" : "Decline"}
            </button>
            <button type="button" disabled={pending} onClick={() => setMode("choose")} className="px-3 py-2 text-sm text-muted hover:text-foreground">
              Back
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}

function HistoryRow({ r, now, showCreator }: { r: Row; now: number; showCreator: boolean }) {
  const status = displayStatus(r, now);
  return (
    <div id={r.id} className="scroll-mt-6 rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <StatusPill status={status} />
        <p className="text-xs text-muted">
          Sent <LocalTime iso={r.created_at} />
        </p>
      </div>
      <Details r={r} showCreator={showCreator} />
      {r.notes && <p className="mt-2 text-xs text-muted">Notes: {r.notes}</p>}
      {status === "unavailable" && r.alternative_times.length > 0 && (
        <div className="mt-2 text-sm">
          <span className="text-xs text-muted">Suggested times: </span>
          {r.alternative_times.map((t, i) => (
            <span key={t}>
              {i > 0 && ", "}
              <LocalTime iso={t} />
            </span>
          ))}
        </div>
      )}
      {r.decline_note && <p className="mt-2 text-xs text-muted">Note: {r.decline_note}</p>}
    </div>
  );
}

export default function VideoCallList({ requests, canRespond, showCreator }: { requests: Row[]; canRespond: boolean; showCreator: boolean }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  // Keep countdowns and new requests fresh while the page is open.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    const refresh = setInterval(() => router.refresh(), REFRESH_MS);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router]);

  // A waiting fan comes first, then whatever expires soonest.
  const waiting = requests
    .filter((r) => displayStatus(r, now) === "pending")
    .sort((a, b) => (a.timing === b.timing ? a.expires_at.localeCompare(b.expires_at) : a.timing === "asap" ? -1 : 1));
  const history = requests.filter((r) => displayStatus(r, now) !== "pending");

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Waiting for a reply</h2>
        {waiting.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">No video call requests waiting.</div>
        ) : (
          waiting.map((r) =>
            canRespond ? (
              <PendingCard key={r.id} r={r} now={now} onDone={() => router.refresh()} />
            ) : (
              <HistoryRow key={r.id} r={r} now={now} showCreator={showCreator} />
            )
          )
        )}
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Earlier</h2>
          {history.map((r) => (
            <HistoryRow key={r.id} r={r} now={now} showCreator={showCreator} />
          ))}
        </section>
      )}
    </div>
  );
}
