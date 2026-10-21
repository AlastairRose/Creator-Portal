"use client";

import { useState, useTransition } from "react";
import { requestMetaHelp, submitMetaAccess } from "@/lib/actions/meta-access";

// Walks a creator through giving LB Collective partner access to their
// Instagram (and Facebook Page) in Meta Business Suite. Asks a few questions
// first so each creator only sees the steps that apply to them.

type Device = "computer" | "iphone" | "android";
type Step = "device" | "professional" | "switch" | "suite" | "setup" | "check" | "share" | "finish";

const APPS = {
  instagram: {
    iphone: "https://apps.apple.com/app/instagram/id389801252",
    android: "https://play.google.com/store/apps/details?id=com.instagram.android",
  },
  suite: {
    iphone: "https://apps.apple.com/app/meta-business-suite/id514643583",
    android: "https://play.google.com/store/apps/details?id=com.facebook.pages.app",
  },
};

const STEP_TITLES: Record<Step, string> = {
  device: "Your device",
  professional: "Your Instagram account type",
  switch: "Switching to a professional account",
  suite: "Meta Business Suite",
  setup: "Setting up Meta Business Suite",
  check: "Checking your Instagram is connected",
  share: "Giving LB Collective access",
  finish: "Confirming",
};

const btn = "rounded-md bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const choice =
  "w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-left text-sm hover:border-accent";

export default function MetaAccessWizard({ businessId, initialHandle }: { businessId: string; initialHandle: string }) {
  const [device, setDevice] = useState<Device | null>(null);
  const [history, setHistory] = useState<Step[]>(["device"]);
  const step = history[history.length - 1];
  const [handle, setHandle] = useState(initialHandle);
  const [copied, setCopied] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpText, setHelpText] = useState("");
  const [done, setDone] = useState<null | "submitted" | "help">(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const onPhone = device === "iphone" || device === "android";

  function go(next: Step) {
    setError(null);
    setHistory((h) => [...h, next]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function back() {
    setError(null);
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(businessId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const { error } = await submitMetaAccess({ instagramHandle: handle });
      if (error) setError(error);
      else setDone("submitted");
    });
  }

  function sendHelp() {
    setError(null);
    startTransition(async () => {
      const { error } = await requestMetaHelp({ instagramHandle: handle, message: helpText, stuckAt: STEP_TITLES[step] });
      if (error) setError(error);
      else setDone("help");
    });
  }

  if (done === "submitted") {
    return (
      <Panel>
        <p className="text-base font-semibold">Thank you! 🎉</p>
        <p className="text-sm text-muted">
          We&apos;ve been told. We&apos;ll check the access has come through and let you know once it&apos;s received.
        </p>
      </Panel>
    );
  }
  if (done === "help") {
    return (
      <Panel>
        <p className="text-base font-semibold">Help is on the way</p>
        <p className="text-sm text-muted">
          We&apos;ve let your manager know where you got stuck. They&apos;ll be in touch to help you finish, or they may
          send you an access request to approve instead.
        </p>
      </Panel>
    );
  }

  const appLink = (app: keyof typeof APPS, label: string) =>
    device === "iphone" || device === "android" ? (
      <a href={APPS[app][device]} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
        {label} ({device === "iphone" ? "App Store" : "Google Play"})
      </a>
    ) : null;

  const browserTip = onPhone ? (
    <Tip>
      These settings are easiest on a computer. On your phone, open the link in{" "}
      {device === "iphone" ? "Safari" : "Chrome"} rather than the Facebook app. If the page looks cut down, tap{" "}
      {device === "iphone" ? (
        <>
          <strong>aA</strong> in the address bar and choose <strong>Request Desktop Website</strong>
        </>
      ) : (
        <>
          the <strong>⋮</strong> menu and tick <strong>Desktop site</strong>
        </>
      )}
      .
    </Tip>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <Progress step={step} />
      <Panel>
        {step === "device" && (
          <>
            <Question>What are you using right now?</Question>
            <div className="flex flex-col gap-2">
              {(
                [
                  ["computer", "💻 A computer or laptop"],
                  ["iphone", "📱 An iPhone"],
                  ["android", "📱 An Android phone"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={choice}
                  onClick={() => {
                    setDevice(value);
                    go("professional");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === "professional" && (
          <>
            <Question>Is your Instagram a professional account (Creator or Business)?</Question>
            <p className="text-sm text-muted">
              Not sure? Open your Instagram profile. If you can see <strong>Professional dashboard</strong> under your
              bio, it is.
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" className={choice} onClick={() => go("suite")}>
                Yes, it&apos;s a Creator or Business account
              </button>
              <button type="button" className={choice} onClick={() => go("switch")}>
                No, or I&apos;m not sure
              </button>
            </div>
          </>
        )}

        {step === "switch" && (
          <>
            <Question>Switch to a Creator account</Question>
            <p className="text-sm text-muted">It&apos;s free, takes a minute, and you keep all your posts and followers.</p>
            <Steps
              steps={[
                <>
                  Open the Instagram app {onPhone ? <>({appLink("instagram", "download it here")} if you need it)</> : "on your phone"}.
                </>,
                <>Go to your profile and tap the <strong>☰</strong> menu at the top right.</>,
                <>
                  Tap <strong>Account type and tools</strong>, then <strong>Switch to professional account</strong>.
                </>,
                <>
                  Choose <strong>Creator</strong>, pick a category that fits you, and tap <strong>Done</strong>.
                </>,
              ]}
            />
            <button type="button" className={btn} onClick={() => go("suite")}>
              Done, it&apos;s a Creator account now
            </button>
          </>
        )}

        {step === "suite" && (
          <>
            <Question>Do you already use Meta Business Suite?</Question>
            <p className="text-sm text-muted">
              It&apos;s Meta&apos;s free tool for managing your Instagram and Facebook as a business. If you&apos;ve never
              set it up, that&apos;s normal.
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" className={choice} onClick={() => go("check")}>
                Yes, I already use it
              </button>
              <button type="button" className={choice} onClick={() => go("setup")}>
                No, or I&apos;m not sure
              </button>
            </div>
          </>
        )}

        {step === "setup" && (
          <>
            <Question>Set up Meta Business Suite</Question>
            <p className="text-sm text-muted">This only needs doing once.</p>
            {onPhone && (
              <Tip>
                You can do this in the {appLink("suite", "Meta Business Suite app")}, but the last step is easier in a
                browser, so we&apos;ll use the website throughout.
              </Tip>
            )}
            <Steps
              steps={[
                <>
                  Open{" "}
                  <a href="https://business.facebook.com/settings" target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                    business.facebook.com/settings
                  </a>{" "}
                  and log in with your Facebook account. No Facebook account? You can create one there for free.
                </>,
                <>
                  Meta will ask you to <strong>create a business portfolio</strong>. Use your creator name as the business
                  name and follow the prompts.
                </>,
                <>
                  In the menu, open <strong>Accounts</strong> then <strong>Instagram accounts</strong>, tap{" "}
                  <strong>Add</strong>, and log in to your Instagram.
                </>,
                <>
                  Have a Facebook Page too? Add it under <strong>Accounts</strong> then <strong>Pages</strong>. If you
                  don&apos;t have one, skip this.
                </>,
              ]}
            />
            {browserTip}
            <button type="button" className={btn} onClick={() => go("share")}>
              Done, my Instagram is added
            </button>
          </>
        )}

        {step === "check" && (
          <>
            <Question>Check your Instagram is connected</Question>
            <Steps
              steps={[
                <>
                  Open{" "}
                  <a href="https://business.facebook.com/settings" target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                    business.facebook.com/settings
                  </a>{" "}
                  and make sure your own business portfolio is selected at the top.
                </>,
                <>
                  Go to <strong>Accounts</strong> then <strong>Instagram accounts</strong>. Is your Instagram listed?
                </>,
                <>
                  If not, tap <strong>Add</strong> and log in to your Instagram.
                </>,
              ]}
            />
            {browserTip}
            <button type="button" className={btn} onClick={() => go("share")}>
              My Instagram is there
            </button>
          </>
        )}

        {step === "share" && (
          <>
            <Question>Give LB Collective access</Question>
            <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/10 p-4">
              <span className="text-xs font-medium text-muted">Our business portfolio ID</span>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-lg font-semibold tracking-wider">{businessId}</span>
                <button type="button" onClick={copyId} className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium">
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>
            <Steps
              steps={[
                <>
                  In{" "}
                  <a href="https://business.facebook.com/settings" target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                    business.facebook.com/settings
                  </a>
                  , open <strong>Users</strong> then <strong>Partners</strong>.
                </>,
                <>
                  Tap <strong>Add</strong> and choose <strong>Give a partner access to your assets</strong>.
                </>,
                <>Paste our ID above and tap <strong>Next</strong>.</>,
                <>
                  Tick your <strong>Instagram account</strong> (and your Facebook Page if you have one), and turn on{" "}
                  <strong>full control</strong> or every permission it offers.
                </>,
                <>
                  Tap <strong>Assign assets</strong>. That&apos;s it!
                </>,
              ]}
            />
            {browserTip}
            <Tip>You stay the owner. You can see or remove our access at any time under Users then Partners.</Tip>
            <button type="button" className={btn} onClick={() => go("finish")}>
              I&apos;ve done it
            </button>
          </>
        )}

        {step === "finish" && (
          <>
            <Question>Last thing: what&apos;s your Instagram username?</Question>
            <input
              id="meta-ig-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@yourname"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full rounded-md border border-border bg-surface-raised px-3 py-3 text-sm outline-none focus:border-accent"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="button" className={btn} onClick={submit} disabled={isPending}>
              {isPending ? "Sending…" : "Let LB Collective know"}
            </button>
          </>
        )}

        {step !== "device" && (
          <button type="button" onClick={back} className="self-start text-xs text-muted hover:underline">
            ← Back
          </button>
        )}
      </Panel>

      {step !== "device" && !helpOpen && (
        <button type="button" onClick={() => setHelpOpen(true)} className="self-start text-sm text-accent hover:underline">
          I&apos;m stuck, I need help
        </button>
      )}
      {helpOpen && (
        <Panel>
          <p className="text-sm font-semibold">Tell us where you got stuck</p>
          <p className="text-xs text-muted">We&apos;ll let your manager know you&apos;re on: {STEP_TITLES[step]}.</p>
          <input
            id="meta-help-handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="Your Instagram username"
            autoCapitalize="none"
            className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <textarea
            id="meta-help-message"
            value={helpText}
            onChange={(e) => setHelpText(e.target.value)}
            rows={3}
            placeholder="What happened? (optional)"
            className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button type="button" className={btn} onClick={sendHelp} disabled={isPending}>
              {isPending ? "Sending…" : "Ask for help"}
            </button>
            <button type="button" onClick={() => setHelpOpen(false)} className="text-sm text-muted hover:underline">
              Cancel
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}

const ORDER: Step[] = ["device", "professional", "suite", "share", "finish"];
function Progress({ step }: { step: Step }) {
  const position = { switch: 1, setup: 2, check: 2 } as Partial<Record<Step, number>>;
  const index = position[step] ?? ORDER.indexOf(step);
  return (
    <div className="flex gap-1.5" aria-label={`Step ${index + 1} of ${ORDER.length}`}>
      {ORDER.map((s, i) => (
        <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-accent" : "bg-surface-raised"}`} />
      ))}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">{children}</section>;
}
function Question({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold">{children}</h2>;
}
function Tip({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-surface-raised px-3 py-2 text-xs text-muted">{children}</p>;
}
function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
            {i + 1}
          </span>
          <span className="pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );
}
