"use client";

import { useRef, useState, useTransition } from "react";
import SignaturePad, { type SignaturePadHandle } from "@/components/onboarding/SignaturePad";
import { useRouter } from "next/navigation";
import { confirmMetaAccess, resetMetaAccess } from "@/lib/actions/meta-access";
import {
  countersignAgreement,
  getOnboardingFileUrl,
  resendModelInfoToChatterPortal,
  revealLoginPassword,
  setOnboardingRequired,
} from "@/lib/actions/onboarding-admin";

// Opens a private file (ID, proof of address, signature) through a
// short-lived signed link, so nothing sensitive sits on a permanent URL.
export function PrivateFileLink({ path, label }: { path: string; label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function open() {
    setError(null);
    // Open the tab first (inside the click) so phones don't block it as a pop-up.
    const tab = window.open("", "_blank");
    startTransition(async () => {
      const { url, error } = await getOnboardingFileUrl(path);
      if (error || !url) {
        tab?.close();
        setError(error ?? "Couldn't open the file.");
        return;
      }
      if (tab) tab.location.href = url;
      else window.location.href = url;
    });
  }
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={open} disabled={isPending} className="text-left text-sm text-accent hover:underline disabled:opacity-50">
        {isPending ? "Opening…" : label}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

export function SignatureImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="Signature" className="h-24 w-auto rounded border border-border bg-white" />;
  }
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await getOnboardingFileUrl(path);
            if (r.url) setUrl(r.url);
            else setError(r.error ?? "Couldn't load the signature.");
          })
        }
        className="self-start text-sm text-accent hover:underline disabled:opacity-50"
      >
        {isPending ? "Loading…" : "Show signature"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

export function RevealPassword({ loginId }: { loginId: string }) {
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  if (password !== null) {
    return (
      <span className="flex items-center gap-2">
        <code className="rounded bg-surface-raised px-2 py-1 text-xs">{password}</code>
        <button type="button" onClick={() => navigator.clipboard?.writeText(password)} className="text-xs text-accent hover:underline">
          Copy
        </button>
        <button type="button" onClick={() => setPassword(null)} className="text-xs text-muted hover:underline">
          Hide
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await revealLoginPassword(loginId);
            if (r.password !== undefined) setPassword(r.password);
            else setError(r.error ?? "Couldn't reveal it.");
          })
        }
        className="self-start text-xs text-accent hover:underline disabled:opacity-50"
      >
        {isPending ? "Revealing…" : "Reveal password"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

export function RequireOnboardingToggle({ creatorId, required }: { creatorId: string; required: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const { error } = await setOnboardingRequired(creatorId, !required);
            if (error) setError(error);
            else router.refresh();
          })
        }
        className="self-start rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface-raised disabled:opacity-50"
      >
        {required ? "Don't require onboarding for this creator" : "Require onboarding for this creator"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

export function ResendModelInfoButton({ creatorId }: { creatorId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const { error } = await resendModelInfoToChatterPortal(creatorId);
            setMessage(error ?? "Sent to the Chatter Portal.");
            router.refresh();
          })
        }
        className="self-start rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface-raised disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send to Chatter Portal"}
      </button>
      {message && <span className="text-xs text-muted">{message}</span>}
    </span>
  );
}

export function CountersignForm({ agreementId, defaultName }: { agreementId: string; defaultName: string }) {
  const router = useRouter();
  const pad = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState(defaultName);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function sign() {
    setError(null);
    const signatureDataUrl = pad.current?.toDataUrl();
    if (!signatureDataUrl) {
      setError("Please draw your signature.");
      return;
    }
    startTransition(async () => {
      const { error } = await countersignAgreement({ agreementId, signerName: name, signatureDataUrl });
      if (error) setError(error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-accent/40 bg-accent/5 p-3">
      <p className="text-sm font-medium">Sign on behalf of LB Collective LTD</p>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
        Your full name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
      <SignaturePad ref={pad} onChange={setHasInk} />
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        type="button"
        onClick={sign}
        disabled={isPending || !hasInk || !name.trim()}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Signing…" : "Countersign agreement"}
      </button>
    </div>
  );
}

export function MetaAccessButtons({ creatorId, status }: { creatorId: string; status: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function run(action: (id: string) => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const { error } = await action(creatorId);
      if (error) setError(error);
      else router.refresh();
    });
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {status !== "confirmed" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(confirmMetaAccess)}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Mark access received
          </button>
        )}
        {status && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(resetMetaAccess)}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface-raised disabled:opacity-50"
          >
            {status === "confirmed" ? "Ask her to do it again" : "Not received, ask her to try again"}
          </button>
        )}
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
