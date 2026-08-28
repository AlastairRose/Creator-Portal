"use client";

import type { ReelDraftFields } from "@/lib/actions/creative-direction";

const textFieldClass =
  "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70";

// Shared between the Reel Planner's "Add reel"/edit form and R&D's idea
// form, so the two can never drift apart. Whether every field is actually
// required is enforced by the caller's server action, not here.
export default function ReelFieldsForm({
  fields,
  onChange,
  onBlurField,
  disabled,
  footer,
}: {
  fields: ReelDraftFields;
  onChange: (fields: ReelDraftFields) => void;
  onBlurField?: () => void;
  disabled: boolean;
  footer?: React.ReactNode;
}) {
  function set<K extends keyof ReelDraftFields>(key: K, value: ReelDraftFields[K]) {
    onChange({ ...fields, [key]: value });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" span={2}>
          <input
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            placeholder="Short label shown when sharing a summary"
            className={textFieldClass}
          />
        </Field>
        <Field label="Idea" span={2}>
          <input
            value={fields.idea}
            onChange={(e) => set("idea", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            placeholder="Overall idea explained clearly"
            className={textFieldClass}
          />
        </Field>
        <Field label="Inspo link" span={2}>
          <input
            value={fields.inspo_link ?? ""}
            onChange={(e) => set("inspo_link", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            placeholder="Link to a similar reel"
            className={textFieldClass}
          />
        </Field>
        <Field label="Required shots" span={2}>
          <textarea
            value={fields.required_shots ?? ""}
            onChange={(e) => set("required_shots", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            rows={3}
            placeholder={"All required shots go here eg.\nShot 1 - ...\nShot 2 - ...\nShot 3 - ..."}
            className={textFieldClass}
          />
        </Field>
        <Field label="Hook (first 1-3 seconds)">
          <input
            value={fields.hook ?? ""}
            onChange={(e) => set("hook", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            className={textFieldClass}
          />
        </Field>
        <Field label="Outfit">
          <input
            value={fields.outfit ?? ""}
            onChange={(e) => set("outfit", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            className={textFieldClass}
          />
        </Field>
        <Field label="Location">
          <input
            value={fields.location ?? ""}
            onChange={(e) => set("location", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            className={textFieldClass}
          />
        </Field>
        <Field label="Filming style">
          <input
            value={fields.filming_style ?? ""}
            onChange={(e) => set("filming_style", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            className={textFieldClass}
          />
        </Field>
        <Field label="Vertical">
          <input
            value={fields.vertical ?? ""}
            onChange={(e) => set("vertical", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            placeholder="e.g. Skit, Snapchat, Fundamental, Talking Head etc."
            className={textFieldClass}
          />
        </Field>
        <Field label="Editing notes" span={2}>
          <textarea
            value={fields.editing_notes ?? ""}
            onChange={(e) => set("editing_notes", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            rows={2}
            placeholder={
              "E.g. Music suggestion, Text on screen, Chop at X seconds, Transition between Shot 1 to shot 2"
            }
            className={textFieldClass}
          />
        </Field>
        <Field label="Posting notes" span={2}>
          <textarea
            value={fields.posting_notes ?? ""}
            onChange={(e) => set("posting_notes", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            rows={2}
            placeholder="E.g. Caption to be used or # to be used or tracker marker to be used"
            className={textFieldClass}
          />
        </Field>
      </div>
      {footer}
    </div>
  );
}

function Field({
  label,
  span = 1,
  children,
}: {
  label: string;
  span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${span === 2 ? "col-span-2" : ""}`}>
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
