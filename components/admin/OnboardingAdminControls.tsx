"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
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
