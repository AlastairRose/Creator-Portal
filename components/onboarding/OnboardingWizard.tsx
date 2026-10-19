"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_STEPS } from "@/lib/onboarding/state";
import { markNotificationsStepDone, markWelcomeVideoWatched } from "@/lib/actions/onboarding";
import { NotificationSetupInline } from "@/components/shared/NotificationSetup";
import AgreementStep from "./AgreementStep";
import DetailsStep from "./DetailsStep";
import ModelInfoStep from "./ModelInfoStep";

type DoneMap = Record<(typeof ONBOARDING_STEPS)[number]["key"], boolean>;

export default function OnboardingWizard({
  creatorId,
  creatorName,
  initialStep,
  done: initialDone,
  agreement,
  videoEmbedUrl,
  defaultEmail,
}: {
  creatorId: string;
  creatorName: string;
  initialStep: number;
  done: DoneMap;
  agreement: { title: string; body: string; version: number };
  videoEmbedUrl: string | null;
  defaultEmail: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [done, setDone] = useState(initialDone);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const requiredDone = done.agreement && done.details;
  const onNotificationsChange = useCallback((enabled: boolean) => setNotificationsOn(enabled), []);

  function complete(key: keyof DoneMap) {
    setDone((d) => ({ ...d, [key]: true }));
    setError(null);
    const nextStep = Math.min(step + 1, ONBOARDING_STEPS.length);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
    router.refresh();
  }

  function finishNotifications() {
    startTransition(async () => {
      const { error } = await markNotificationsStepDone();
      if (error) setError(error);
      else complete("notifications");
    });
  }

  function finishVideo() {
    startTransition(async () => {
      const { error } = await markWelcomeVideoWatched();
      if (error) {
        setError(error);
        return;
      }
      setDone((d) => ({ ...d, video: true }));
      router.push("/");
      router.refresh();
    });
  }

  const current = ONBOARDING_STEPS.find((s) => s.step === step)!;
  const canOpen = (s: number) => s <= 2 ? s === 1 || done.agreement : requiredDone;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Welcome, {creatorName}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Let&apos;s get you set up</h1>
        <p className="mt-1 text-sm text-muted">
          Five quick steps. The first two are needed before you can use the portal.
        </p>
      </div>

      <ol className="grid grid-cols-5 gap-2">
        {ONBOARDING_STEPS.map((s) => {
          const isDone = done[s.key];
          const isCurrent = s.step === step;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => canOpen(s.step) && setStep(s.step)}
                disabled={!canOpen(s.step)}
                className="flex w-full flex-col items-center gap-1.5 text-center disabled:opacity-40"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                    isDone ? "bg-success/20 text-success" : isCurrent ? "bg-accent text-white" : "bg-surface-raised text-muted"
                  }`}
                >
                  {isDone ? "✓" : s.step}
                </span>
                <span className={`text-[11px] leading-tight ${isCurrent ? "text-foreground" : "text-muted"}`}>{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">
          Step {current.step}: {current.title}
        </h2>

        {step === 1 &&
          (done.agreement ? (
            <DoneNote text="You've signed your agreement." onNext={() => setStep(2)} />
          ) : (
            <AgreementStep {...agreement} defaults={{ fullName: "" }} onDone={() => complete("agreement")} />
          ))}

        {step === 2 &&
          (done.details ? (
            <DoneNote text="Your details are saved." onNext={() => setStep(3)} />
          ) : (
            <DetailsStep defaultEmail={defaultEmail} onDone={() => complete("details")} />
          ))}

        {step === 3 &&
          (done.model_info ? (
            <DoneNote text="Thanks, your answers are saved." onNext={() => setStep(4)} />
          ) : (
            <ModelInfoStep creatorId={creatorId} onDone={() => complete("model_info")} />
          ))}

        {step === 4 && (
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-muted">
              Get an alert on your phone for new custom requests, new reels to film and new content requests.
            </p>
            <NotificationSetupInline onEnabledChange={onNotificationsChange} />
            <button
              type="button"
              onClick={finishNotifications}
              disabled={isPending}
              className="w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {notificationsOn ? "Continue" : "Continue without notifications"}
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-4">
            {videoEmbedUrl ? (
              <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
                <iframe
                  src={videoEmbedUrl}
                  title="Welcome to the Creator Portal"
                  className="h-full w-full"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                />
              </div>
            ) : (
              <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
                Your welcome video is coming soon. You can still go ahead and explore the portal.
              </p>
            )}
            <button
              type="button"
              onClick={finishVideo}
              disabled={isPending}
              className="w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Finishing…" : "Finish and go to my portal"}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {requiredDone && step >= 3 && step < 5 && (
          <button
            type="button"
            onClick={() => router.push("/")}
            className="self-center py-2 text-sm text-muted hover:underline"
          >
            Do the rest later
          </button>
        )}
      </section>
    </div>
  );
}

function DoneNote({ text, onNext }: { text: string; onNext: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
      <p className="text-sm text-success">✓ {text}</p>
      <button type="button" onClick={onNext} className="self-start text-sm font-medium text-accent hover:underline">
        Next step →
      </button>
    </div>
  );
}
