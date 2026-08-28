"use client";

import { useActionState } from "react";
import { submitOutstandingCustomIntake, type IntakeState } from "@/lib/actions/intake";

const initialState: IntakeState = { error: null, success: false };

const fieldClass =
  "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

export default function OutstandingCustomIntakeForm({ creatorId }: { creatorId: string }) {
  const action = submitOutstandingCustomIntake.bind(null, creatorId);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.success) {
    return (
      <div className="rounded-lg border border-success/40 bg-success/10 p-6 text-sm">
        <p className="font-medium text-success">Submitted — thanks!</p>
        <p className="mt-1 text-muted">The request has been added to this creator&apos;s Outstanding Customs.</p>
        <a href={`/intake/outstanding-custom/${creatorId}`} className="mt-4 inline-block text-accent hover:underline">
          Submit another
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Sub username">
          <input name="sub_username" className={fieldClass} />
        </Field>
        <Field label="Sub name">
          <input name="sub_name" className={fieldClass} />
        </Field>
        <Field label="Length of video or call">
          <input name="length_of_video_or_call" placeholder="e.g. 5 mins" className={fieldClass} />
        </Field>
        <Field label="Custom or call">
          <input name="custom_or_call" placeholder="e.g. Custom" className={fieldClass} />
        </Field>
        <Field label="Outfit">
          <input name="outfit" className={fieldClass} />
        </Field>
        <Field label="Location">
          <input name="location" className={fieldClass} />
        </Field>
      </div>

      <Field label="Description">
        <textarea name="description" required rows={4} className={fieldClass} />
      </Field>

      <Field label="Screenshot of chat">
        <input
          name="chat_screenshot"
          type="file"
          accept="image/*"
          className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none file:mr-3 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:text-white"
        />
      </Field>

      <Field label="Link to the chat">
        <input name="chat_link" className={fieldClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Custom price agreed">
          <input name="custom_price_agreed" placeholder="e.g. $50" className={fieldClass} />
        </Field>
        <Field label="Snapchat (if required)">
          <input name="snapchat_handle" className={fieldClass} />
        </Field>
      </div>
      <p className="text-xs text-muted">
        The due date is set automatically — 72 hours from when you submit this.
      </p>

      {state.error && (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
