"use client";

import { useState, useTransition } from "react";
import { agreementBlanks } from "@/lib/onboarding/agreement";
import { toEmbedUrl } from "@/lib/onboarding/video";
import { saveOnboardingSettings } from "@/lib/actions/onboarding-admin";

const inputClass =
  "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

export default function OnboardingSettingsForm({
  initial,
}: {
  initial: { agreementTitle: string; agreementBody: string; agreementVersion: number; welcomeVideoUrl: string; metaBusinessId: string };
}) {
  const [title, setTitle] = useState(initial.agreementTitle);
  const [body, setBody] = useState(initial.agreementBody);
  const [videoUrl, setVideoUrl] = useState(initial.welcomeVideoUrl);
  const [metaBusinessId, setMetaBusinessId] = useState(initial.metaBusinessId);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const blanks = agreementBlanks(body);
  const embed = toEmbedUrl(videoUrl);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const { error } = await saveOnboardingSettings({ agreementTitle: title, agreementBody: body, welcomeVideoUrl: videoUrl, metaBusinessId });
      setMessage(error ? { ok: false, text: error } : { ok: true, text: "Saved." });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Agreement</h2>
        <p className="text-xs text-muted">
          Write blanks for the creator to fill in using square brackets, like <code>[Full legal name]</code>. Using the
          same label twice gives the same blank. <code>[Date]</code> is pre-filled with today&apos;s date. The signature,
          typed name and signing time are added automatically, so don&apos;t include a signature section. Editing the
          wording creates a new version (currently v{initial.agreementVersion}). Agreements already signed keep the
          wording they were signed with.
        </p>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Wording
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={20} className={`${inputClass} font-mono text-xs`} />
        </label>
        <p className="text-xs text-muted">
          Blanks the creator will fill in: {blanks.length ? blanks.map((b) => b.label).join(", ") : "none"}
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Welcome video</h2>
        <p className="text-xs text-muted">
          Paste a YouTube (unlisted is fine), Vimeo or Loom link. It plays inside the portal on the last onboarding step.
        </p>
        <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtu.be/…" className={inputClass} />
        {videoUrl && !embed && <p className="text-xs text-danger">That link can&apos;t be played in the portal.</p>}
        {embed && (
          <div className="aspect-video w-full max-w-md overflow-hidden rounded-md border border-border bg-black">
            <iframe src={embed} title="Welcome video preview" className="h-full w-full" allowFullScreen />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Instagram / Facebook access</h2>
        <p className="text-xs text-muted">
          Your agency&apos;s Meta business portfolio ID, from business.facebook.com/settings → Business info. Creators
          paste it when they give you partner access from Instagram Access in their menu. Until it&apos;s set, that page
          tells them it isn&apos;t ready yet.
        </p>
        <input
          id="meta-business-id"
          value={metaBusinessId}
          onChange={(e) => setMetaBusinessId(e.target.value)}
          inputMode="numeric"
          placeholder="e.g. 1234567890123456"
          className={`${inputClass} font-mono`}
        />
      </section>

      {message && <p className={`text-sm ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</p>}
      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
