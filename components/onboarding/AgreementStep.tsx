"use client";

import { Fragment, useMemo, useRef, useState, useTransition } from "react";
import { agreementBlanks, isDateBlank, parseAgreement } from "@/lib/onboarding/agreement";
import { signAgreement } from "@/lib/actions/onboarding";
import SignaturePad, { type SignaturePadHandle } from "./SignaturePad";

const inputClass =
  "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

export default function AgreementStep({
  title,
  body,
  version,
  defaults,
  onDone,
}: {
  title: string;
  body: string;
  version: number;
  defaults: { fullName: string };
  onDone: () => void;
}) {
  const segments = useMemo(() => parseAgreement(body), [body]);
  const blanks = useMemo(() => agreementBlanks(body), [body]);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    for (const b of blanks) {
      if (isDateBlank(b.label)) initial[b.key] = today;
      else if (/full (legal )?name/i.test(b.label)) initial[b.key] = defaults.fullName;
    }
    return initial;
  });
  const [signerName, setSignerName] = useState(defaults.fullName);
  const [agreed, setAgreed] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pad = useRef<SignaturePadHandle>(null);

  if (!body.trim()) {
    return (
      <p className="text-sm text-muted">
        Your agreement isn&apos;t ready yet. Please check back shortly or contact your manager.
      </p>
    );
  }

  const missing = blanks.filter((b) => !(values[b.key] ?? "").trim());
  const canSign = missing.length === 0 && signerName.trim() && hasInk && agreed;

  function submit() {
    setError(null);
    const signatureDataUrl = pad.current?.toDataUrl();
    if (!signatureDataUrl) {
      setError("Please draw your signature.");
      return;
    }
    startTransition(async () => {
      const { error } = await signAgreement({ values, signerName, signatureDataUrl, agreementVersion: version });
      if (error) setError(error);
      else onDone();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-border bg-surface-raised p-4">
        <p className="text-sm font-medium">Fill in your details</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {blanks.map((b) => (
            <label key={b.key} className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              {b.label}
              <input
                value={values[b.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [b.key]: e.target.value }))}
                className={inputClass}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-border bg-surface p-4 text-sm leading-6">
        <h3 className="mb-3 text-base font-semibold">{title}</h3>
        <div className="whitespace-pre-wrap">
          {segments.map((s, i) =>
            s.type === "text" ? (
              <Fragment key={i}>{s.text}</Fragment>
            ) : (
              <mark
                key={i}
                className={`rounded px-1 ${
                  (values[s.key] ?? "").trim() ? "bg-accent/15 text-foreground" : "bg-warning/20 text-warning"
                }`}
              >
                {(values[s.key] ?? "").trim() || s.label}
              </mark>
            )
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Type your full name
          <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className={inputClass} />
        </label>
        <SignaturePad ref={pad} onChange={setHasInk} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
          <span>
            I&apos;ve read this agreement and agree to its terms. I understand that signing here is the same as signing
            on paper.
          </span>
        </label>
      </div>

      {missing.length > 0 && (
        <p className="text-xs text-warning">Still to fill in: {missing.map((m) => m.label).join(", ")}</p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={!canSign || isPending}
        className="w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Signing…" : "Sign agreement"}
      </button>
    </div>
  );
}
