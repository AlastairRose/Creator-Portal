"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToVideoCall, type VideoCallResponse } from "@/lib/actions/video-calls";
import {
  DECLINE_REASON_LABELS,
  displayStatus,
  MAX_ALTERNATIVE_TIMES,
  statusLabel,
  type DeclineReason,
  type DisplayStatus,
  type VideoCallRequest,
} from "@/lib/video-calls";

type Row = VideoCallRequest & { creator_name: string };

const REFRESH_MS = 20_000;

// Times are formatted in the viewer's own timezone, which only exists in the
// browser - so render nothing on the server and fill in after mount.
const noopSubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function LocalTime({ iso }: { iso: string }) {
  const mounted = useMounted();
  if (!mounted) return <span className="opacity-0">…</span>;
  return (
    <span>
      {new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
    </span>
  );
}

function minutesLeft(iso: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000));
}

const STATUS_TONE: Record<DisplayStatus, string> = {
  pending: "bg-warning/15 text-warning",
  no_reply: "bg-danger/15 text-danger",
  missed: "bg-orange/15 text-orange",
  accepted: "bg-warning/15 text-warning",
  ready: "bg-success/15 text-success",
  declined: "bg-surface-raised text-muted",
  cancelled: "bg-surface-raised text-muted",
};

function StatusPill({ r, now }: { r: Row; now: number }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[displayStatus(r, now)]}`}>{statusLabel(r, now)}</span>;
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

const inputClass = "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

/** Up to 3 "I'm free at…" slots. Values are the phone's own local time. */
function TimeSlots({ times, setTimes, now, firstRequired }: { times: string[]; setTimes: (t: string[]) => void; now: number; firstRequired: boolean }) {
  // The earliest pickable time depends on the phone's timezone, so only set
  // it in the browser - setting it during server render caused a mismatch.
  const mounted = useMounted();
  const minInput = mounted ? toLocalInputValue(new Date(now)) : undefined;
  return (
    <>
      {times.map((t, i) => (
        <label key={i} className="flex flex-col gap-1 text-xs text-muted">
          Time {i + 1}
          {i === 0 && firstRequired ? "" : " (optional)"}
          <input
            type="datetime-local"
            value={t}
            min={minInput}
            onChange={(e) => setTimes(times.map((p, j) => (j === i ? e.target.value : p)))}
            className={inputClass}
          />
        </label>
      ))}
    </>
  );
}

function toIsoList(times: string[]): string[] {
  return times.filter(Boolean).map((t) => new Date(t).toISOString()); // datetime-local is the phone's own time
}

function useRespond(id: string, onDone: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(response: VideoCallResponse) {
    setError(null);
    startTransition(async () => {
      const result = await respondToVideoCall(id, response);
      if (result.error) setError(result.error);
      else onDone();
    });
  }
  return { error, setError, pending, submit };
}

function Note({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={500} placeholder={placeholder} className={inputClass} />
    </label>
  );
}

/** A request still inside its 20-minute reply window. */
function AnswerCard({ r, now, onDone }: { r: Row; now: number; onDone: () => void }) {
  const [mode, setMode] = useState<"choose" | "reasons" | DeclineReason>("choose");
  const [times, setTimes] = useState<string[]>(Array(MAX_ALTERNATIVE_TIMES).fill(""));
  const [note, setNote] = useState("");
  const { error, pending, submit } = useRespond(r.id, onDone);
  const left = minutesLeft(r.expires_at, now);

  return (
    <div id={r.id} className="scroll-mt-6 rounded-lg border border-accent/50 bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{r.timing === "asap" ? "Video call - now" : "Video call request"}</p>
        <p className={`text-xs ${left <= 5 ? "font-medium text-danger" : "text-muted"}`}>Reply within {left} min</p>
      </div>
      <Details r={r} showCreator={false} />
      {r.notes && <p className="mt-3 whitespace-pre-wrap rounded-md bg-surface-raised p-3 text-sm">{r.notes}</p>}

      {mode === "choose" && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            onClick={() => setMode("reasons")}
            className="rounded-md border border-border bg-surface-raised px-3 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            Can&apos;t do it
          </button>
        </div>
      )}

      {mode === "reasons" && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm font-medium">Why not?</p>
          {(["unavailable", "price_too_low", "not_interested"] as const).map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => setMode(reason)}
              className="rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-surface-raised"
            >
              {reason === "unavailable" ? "Not available right now" : reason === "price_too_low" ? "Price is too low" : "I don't want to do this one"}
            </button>
          ))}
          <button type="button" onClick={() => setMode("choose")} className="self-start px-1 py-1 text-sm text-muted hover:text-foreground">
            Back
          </button>
        </div>
      )}

      {mode === "unavailable" && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-medium">When could you do it instead?</p>
          <p className="-mt-2 text-xs text-muted">Optional, but it really helps the team still make the sale.</p>
          <TimeSlots times={times} setTimes={setTimes} now={now} firstRequired={false} />
          <Note value={note} onChange={setNote} label="Note for the chat team (optional)" />
          <Buttons
            pending={pending}
            label="Send"
            onSend={() => submit({ action: "decline", reason: "unavailable", times: toIsoList(times), note })}
            onBack={() => setMode("reasons")}
          />
        </div>
      )}

      {mode === "price_too_low" && (
        <div className="mt-4 flex flex-col gap-3">
          <Note value={note} onChange={setNote} label="What would you do it for? (optional)" placeholder="e.g. $200 for 10 minutes" />
          <Buttons pending={pending} label="Send" onSend={() => submit({ action: "decline", reason: "price_too_low", note })} onBack={() => setMode("reasons")} />
        </div>
      )}

      {mode === "not_interested" && (
        <div className="mt-4 flex flex-col gap-3">
          <Note value={note} onChange={setNote} label="Reason (optional)" placeholder="e.g. Not comfortable with this one" />
          <Buttons
            pending={pending}
            label="Decline"
            danger
            onSend={() => submit({ action: "decline", reason: "not_interested", note })}
            onBack={() => setMode("reasons")}
          />
        </div>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}

function Buttons({ pending, label, onSend, onBack, danger }: { pending: boolean; label: string; onSend: () => void; onBack: () => void; danger?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={onSend}
        className={`rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 ${danger ? "bg-danger" : "bg-accent"}`}
      >
        {pending ? "Sending…" : label}
      </button>
      <button type="button" disabled={pending} onClick={onBack} className="px-3 py-2 text-sm text-muted hover:text-foreground">
        Back
      </button>
    </div>
  );
}

/** Reply window passed without an answer: offer the fan another time instead. */
function MissedCard({ r, now, onDone }: { r: Row; now: number; onDone: () => void }) {
  const [times, setTimes] = useState<string[]>(Array(MAX_ALTERNATIVE_TIMES).fill(""));
  const [note, setNote] = useState("");
  const { error, setError, pending, submit } = useRespond(r.id, onDone);

  function send() {
    const list = toIsoList(times);
    if (list.length === 0) return setError("Add at least one time you'd be available.");
    submit({ action: "suggest_times", times: list, note });
  }

  return (
    <div id={r.id} className="scroll-mt-6 rounded-lg border border-danger/40 bg-surface p-4 shadow-sm">
      <p className="text-sm font-semibold text-danger">Missed video call</p>
      <p className="mt-1 text-sm">Suggest a time you&apos;d be available for this fan and the chat team will offer it to them.</p>
      <div className="mt-3">
        <Details r={r} showCreator={false} />
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <TimeSlots times={times} setTimes={setTimes} now={now} firstRequired />
        <Note value={note} onChange={setNote} label="Note for the chat team (optional)" />
        <button
          type="button"
          disabled={pending}
          onClick={send}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send times"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}

/** Accepted (waiting for the fan to pay) or paid and ready. */
function InProgressCard({ r, now }: { r: Row; now: number }) {
  const ready = r.status === "ready";
  return (
    <div id={r.id} className={`scroll-mt-6 rounded-lg border p-4 shadow-sm ${ready ? "border-success/50 bg-success/10" : "border-border bg-surface"}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className={`text-sm font-semibold ${ready ? "text-success" : ""}`}>
          {ready ? "Your video call is ready" : "Waiting for the fan to pay…"}
        </p>
        {!ready && r.payment_deadline && <p className="text-xs text-muted">Up to {minutesLeft(r.payment_deadline, now)} min</p>}
      </div>
      <p className="mb-3 text-sm text-muted">
        {ready
          ? "Payment's in - get ready for the call."
          : "You accepted. The chat team is confirming payment - we'll notify you as soon as it's ready (or if the fan doesn't pay)."}
      </p>
      <Details r={r} showCreator={false} />
      {r.notes && <p className="mt-3 whitespace-pre-wrap rounded-md bg-surface-raised p-3 text-sm">{r.notes}</p>}
    </div>
  );
}

function HistoryRow({ r, now, showCreator }: { r: Row; now: number; showCreator: boolean }) {
  return (
    <div id={r.id} className="scroll-mt-6 rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <StatusPill r={r} now={now} />
        <p className="text-xs text-muted">
          Sent <LocalTime iso={r.created_at} />
        </p>
      </div>
      <Details r={r} showCreator={showCreator} />
      {r.notes && <p className="mt-2 text-xs text-muted">Notes: {r.notes}</p>}
      {r.alternative_times.length > 0 && (
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
      {r.decline_reason && r.status === "declined" && <p className="mt-1 text-xs text-muted">Reason: {DECLINE_REASON_LABELS[r.decline_reason]}</p>}
    </div>
  );
}

export default function VideoCallList({
  requests,
  canRespond,
  showCreator,
  renderedAt,
}: {
  requests: Row[];
  canRespond: boolean;
  showCreator: boolean;
  renderedAt: number; // server clock at render, so the first paint matches on server and phone
}) {
  const router = useRouter();
  const [now, setNow] = useState(renderedAt);

  // Keep countdowns and new requests fresh while the page is open.
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    const refresh = setInterval(() => router.refresh(), REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router]);

  const byStatus = (s: DisplayStatus) => requests.filter((r) => displayStatus(r, now) === s);
  // A waiting fan comes first, then whatever runs out soonest.
  const toAnswer = byStatus("pending").sort((a, b) =>
    a.timing === b.timing ? a.expires_at.localeCompare(b.expires_at) : a.timing === "asap" ? -1 : 1
  );
  const missed = byStatus("no_reply");
  const inProgress = requests.filter((r) => r.status === "accepted" || r.status === "ready").filter((r) => r.status === "accepted" || !r.paid_at || now - new Date(r.paid_at).getTime() < 12 * 3600e3);
  const shownIds = new Set([...toAnswer, ...missed, ...inProgress].map((r) => r.id));
  const history = requests.filter((r) => !shownIds.has(r.id));
  const onDone = () => router.refresh();

  return (
    <div className="flex flex-col gap-6">
      {(canRespond || toAnswer.length > 0) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Needs your answer</h2>
          {toAnswer.length === 0 ? (
            <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">No video call requests waiting.</div>
          ) : (
            toAnswer.map((r) => (canRespond ? <AnswerCard key={r.id} r={r} now={now} onDone={onDone} /> : <HistoryRow key={r.id} r={r} now={now} showCreator={showCreator} />))
          )}
        </section>
      )}

      {missed.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Missed</h2>
          {missed.map((r) => (canRespond ? <MissedCard key={r.id} r={r} now={now} onDone={onDone} /> : <HistoryRow key={r.id} r={r} now={now} showCreator={showCreator} />))}
        </section>
      )}

      {inProgress.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Accepted</h2>
          {inProgress.map((r) => (canRespond ? <InProgressCard key={r.id} r={r} now={now} /> : <HistoryRow key={r.id} r={r} now={now} showCreator={showCreator} />))}
        </section>
      )}

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
