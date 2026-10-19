"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  hasAnyPushSubscription,
  isPushSubscriptionSaved,
  removePushSubscription,
  savePushSubscription,
  sendTestNotification,
} from "@/lib/actions/push";

// Walks a creator through turning on phone notifications, with steps that
// match their device. iPhones only allow website notifications once the
// site has been added to the home screen and opened from there, so they get
// that walkthrough first; Android and computers can turn them on directly.
//
// Pops up once on a device that isn't set up yet. If dismissed, a small
// banner stays at the top of the page so it can be finished later.

type Platform = "ios" | "android" | "desktop";
type Status =
  | "checking"
  | "enabled"
  | "enabled-elsewhere" // this device isn't set up, but another one is — no nagging
  | "ios-install" // iPhone in a normal Safari tab: needs Add to Home Screen first
  | "ios-other-browser" // iPhone in Chrome/Firefox/etc. tab
  | "in-app-browser" // Instagram / TikTok / Snapchat built-in browser
  | "ios-too-old"
  | "ready" // can ask for permission now
  | "denied"
  | "unsupported";

const SNOOZE_KEY = "creator-portal:notification-setup-snoozed-until";
const SNOOZE_DAYS = 3;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function readSnoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

function writeSnooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
  } catch {
    // private browsing — the guide just shows again next time
  }
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export default function NotificationSetup() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [status, setStatus] = useState<Status>("checking");
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const evaluate = useCallback(async (): Promise<Status> => {
    const p = detectPlatform();
    const ua = navigator.userAgent;

    if (/Instagram|FBAN|FBAV|Snapchat|TikTok|musical_ly|Line\//i.test(ua)) return "in-app-browser";

    if (p === "ios" && !isStandalone()) {
      // Third-party iPhone browsers can't reliably add a notification-capable
      // home screen app, so steer them to Safari.
      return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? "ios-other-browser" : "ios-install";
    }

    if (!isPushSupported()) return p === "ios" ? "ios-too-old" : "unsupported";
    if (Notification.permission === "denied") return "denied";

    if (Notification.permission === "granted") {
      try {
        const reg = await getRegistration();
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const saved = await isPushSubscriptionSaved(sub.endpoint);
          if (!saved) {
            // Re-sync a device the server forgot about (e.g. it was cleaned up).
            const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
            const { error } = await savePushSubscription(json, navigator.userAgent);
            if (error) return "ready";
          }
          return "enabled";
        }
      } catch {
        return "ready";
      }
    }
    return "ready";
  }, []);

  useEffect(() => {
    let cancelled = false;
    evaluate()
      .then(async (s): Promise<Status> => {
        if (s === "enabled") return s;
        try {
          return (await hasAnyPushSubscription()) ? "enabled-elsewhere" : s;
        } catch {
          return s;
        }
      })
      .then((s) => {
      if (cancelled) return;
      setPlatform(detectPlatform());
      setStatus(s);
      if (s !== "enabled" && s !== "enabled-elsewhere" && s !== "unsupported" && !readSnoozed()) setIsOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [evaluate]);

  function close() {
    writeSnooze();
    setIsOpen(false);
  }

  function turnOn() {
    setError(null);
    startTransition(async () => {
      try {
        if (!VAPID_PUBLIC_KEY) {
          setError("Notifications haven't been switched on for the portal yet. Please let your manager know.");
          return;
        }
        // Must be called straight from the tap, or iPhones ignore it.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "ready");
          if (permission !== "denied") setError("You'll need to tap Allow when your phone asks.");
          return;
        }
        const reg = await getRegistration();
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          }));
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const { error } = await savePushSubscription(json, navigator.userAgent);
        if (error) {
          setError(error);
          return;
        }
        setStatus("enabled");
        const test = await sendTestNotification();
        setTestSent(!test.error);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong turning notifications on.");
      }
    });
  }

  function turnOff() {
    startTransition(async () => {
      try {
        const reg = await getRegistration();
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
      } catch {
        // best effort
      }
      setStatus("ready");
      setTestSent(false);
    });
  }

  if (status === "checking" || status === "unsupported" || status === "enabled-elsewhere") return null;

  return (
    <>
      {status !== "enabled" && !isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-left text-sm"
        >
          <span>
            <span className="font-medium">🔔 Turn on notifications</span>
            <span className="text-muted"> so you never miss a new request.</span>
          </span>
          <span className="shrink-0 font-medium text-accent">Set up</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={close}>
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">
                  {status === "enabled" ? "Notifications are on" : "Set up notifications"}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Get an alert on your phone for new custom requests, new reels to film and new content requests.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg text-muted hover:bg-surface-raised hover:text-foreground"
              >
                ×
              </button>
            </div>

            <GuideBody status={status} platform={platform} />

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <div className="mt-6 flex flex-col gap-2">
              {status === "ready" && (
                <button
                  type="button"
                  onClick={turnOn}
                  disabled={isPending}
                  className="w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? "Turning on…" : "Turn on notifications"}
                </button>
              )}
              {status === "enabled" && (
                <>
                  <p className="text-sm text-success">
                    {testSent ? "✓ We've sent you a test notification." : "✓ This device will get notifications."}
                  </p>
                  <button
                    type="button"
                    onClick={close}
                    className="w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={turnOff}
                    disabled={isPending}
                    className="text-xs text-muted hover:underline"
                  >
                    Turn off notifications on this device
                  </button>
                </>
              )}
              {status !== "enabled" && (
                <button type="button" onClick={close} className="py-2 text-sm text-muted hover:underline">
                  Remind me later
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
            {i + 1}
          </span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function ShareIcon() {
  return (
    <svg
      aria-label="Share"
      viewBox="0 0 24 24"
      className="mx-0.5 inline h-4 w-4 -translate-y-px align-middle"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}

function GuideBody({ status, platform }: { status: Status; platform: Platform }) {
  switch (status) {
    case "ios-install":
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            On iPhone, notifications only work once the portal is on your home screen. It takes 30 seconds:
          </p>
          <Steps
            steps={[
              <>
                Tap the <strong>Share</strong> button <ShareIcon /> at the bottom of Safari.
              </>,
              <>
                Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
              </>,
              <>
                Close Safari and open <strong>Creator Portal</strong> from the new icon on your home screen. You may
                need to sign in again.
              </>,
              <>
                This guide will pop up again. Tap <strong>Turn on notifications</strong> and choose{" "}
                <strong>Allow</strong>.
              </>,
            ]}
          />
        </div>
      );
    case "ios-other-browser":
      return (
        <Steps
          steps={[
            <>
              Copy this page&apos;s address and open it in <strong>Safari</strong>. Notifications on iPhone only work
              through Safari.
            </>,
            <>Sign in, and this guide will walk you through the rest.</>,
          ]}
        />
      );
    case "in-app-browser":
      return (
        <Steps
          steps={[
            <>
              You&apos;re inside another app&apos;s browser, which can&apos;t show notifications. Tap the{" "}
              <strong>⋯</strong> menu and choose <strong>Open in {platform === "ios" ? "Safari" : "Chrome"}</strong>{" "}
              (or Open in browser).
            </>,
            <>Sign in there, and this guide will walk you through the rest.</>,
          ]}
        />
      );
    case "ios-too-old":
      return (
        <p className="text-sm text-muted">
          Your iPhone needs updating to turn on notifications. Go to <strong>Settings → General → Software Update</strong>{" "}
          (iOS 16.4 or newer is needed), then open the portal from your home screen again.
        </p>
      );
    case "denied":
      return platform === "ios" ? (
        <Steps
          steps={[
            <>
              Open your iPhone&apos;s <strong>Settings</strong> app and tap <strong>Notifications</strong>.
            </>,
            <>
              Find <strong>Creator Portal</strong> in the list and turn on <strong>Allow Notifications</strong>.
            </>,
            <>Come back here and reopen this guide.</>,
          ]}
        />
      ) : platform === "android" ? (
        <Steps
          steps={[
            <>
              Tap the <strong>lock icon</strong> (or <strong>⋮ → Settings</strong>) next to the web address.
            </>,
            <>
              Tap <strong>Permissions → Notifications</strong> and choose <strong>Allow</strong>.
            </>,
            <>Reload the page and reopen this guide.</>,
          ]}
        />
      ) : (
        <Steps
          steps={[
            <>
              Click the <strong>lock icon</strong> next to the web address.
            </>,
            <>
              Set <strong>Notifications</strong> to <strong>Allow</strong>, then reload the page.
            </>,
          ]}
        />
      );
    case "ready":
      return platform === "android" ? (
        <Steps
          steps={[
            <>
              Tap <strong>Turn on notifications</strong> below.
            </>,
            <>
              When your phone asks, tap <strong>Allow</strong>.
            </>,
            <>
              Optional: tap <strong>⋮ → Add to Home screen</strong> in Chrome so the portal opens like an app.
            </>,
          ]}
        />
      ) : platform === "ios" ? (
        <Steps
          steps={[
            <>
              Tap <strong>Turn on notifications</strong> below.
            </>,
            <>
              When your iPhone asks, tap <strong>Allow</strong>.
            </>,
          ]}
        />
      ) : (
        <Steps
          steps={[
            <>
              Click <strong>Turn on notifications</strong> below, then <strong>Allow</strong>.
            </>,
            <>
              For alerts on the go, open the portal on your phone as well. It will guide you there too.
            </>,
          ]}
        />
      );
    default:
      return null;
  }
}
