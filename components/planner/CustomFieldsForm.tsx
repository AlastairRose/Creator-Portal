"use client";

import type { CustomFields } from "@/lib/actions/customs";
import ChatScreenshotThumbnail from "./ChatScreenshotThumbnail";

const fieldClass =
  "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70";

export default function CustomFieldsForm({
  fields,
  onChange,
  onBlurField,
  disabled,
  currentScreenshotPaths,
  onScreenshotFilesChange,
  onRemoveScreenshot,
}: {
  fields: CustomFields;
  onChange: (fields: CustomFields) => void;
  onBlurField?: () => void;
  disabled?: boolean;
  currentScreenshotPaths?: string[];
  onScreenshotFilesChange?: (files: File[]) => void;
  onRemoveScreenshot?: (path: string) => void;
}) {
  function set<K extends keyof CustomFields>(key: K, value: CustomFields[K]) {
    onChange({ ...fields, [key]: value });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <LabeledInput
        label="Sub username"
        value={fields.sub_username ?? ""}
        onChange={(v) => set("sub_username", v)}
        onBlur={onBlurField}
        disabled={disabled}
      />
      <LabeledInput
        label="Sub name"
        value={fields.sub_name ?? ""}
        onChange={(v) => set("sub_name", v)}
        onBlur={onBlurField}
        disabled={disabled}
      />
      <LabeledInput
        label="Length of video or call"
        value={fields.length_of_video_or_call ?? ""}
        onChange={(v) => set("length_of_video_or_call", v)}
        onBlur={onBlurField}
        disabled={disabled}
      />
      <LabeledInput
        label="Custom or call"
        value={fields.custom_or_call ?? ""}
        onChange={(v) => set("custom_or_call", v)}
        onBlur={onBlurField}
        disabled={disabled}
      />
      <LabeledInput
        label="Outfit"
        value={fields.outfit ?? ""}
        onChange={(v) => set("outfit", v)}
        onBlur={onBlurField}
        disabled={disabled}
      />
      <LabeledInput
        label="Location"
        value={fields.location ?? ""}
        onChange={(v) => set("location", v)}
        onBlur={onBlurField}
        disabled={disabled}
      />
      <div className="col-span-2 flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Description</label>
        <textarea
          value={fields.description}
          onChange={(e) => set("description", e.target.value)}
          onBlur={onBlurField}
          disabled={disabled}
          rows={3}
          className={fieldClass}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Screenshots of chat</label>
        {currentScreenshotPaths && currentScreenshotPaths.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {currentScreenshotPaths.map((path) => (
              <div key={path} className="relative">
                <ChatScreenshotThumbnail path={path} />
                {onRemoveScreenshot && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemoveScreenshot(path)}
                    aria-label="Remove screenshot"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-xs text-white hover:opacity-90 disabled:opacity-50"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {onScreenshotFilesChange && (
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={disabled}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) onScreenshotFilesChange(files);
              e.target.value = "";
            }}
            className="w-full text-sm text-muted file:mr-3 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:text-white disabled:opacity-70"
          />
        )}
      </div>
      <LabeledInput
        label="Link to the chat"
        value={fields.chat_link ?? ""}
        onChange={(v) => set("chat_link", v)}
        onBlur={onBlurField}
        disabled={disabled}
        span={2}
      />
      <LabeledInput
        label="Custom price agreed"
        value={fields.custom_price_agreed ?? ""}
        onChange={(v) => set("custom_price_agreed", v)}
        onBlur={onBlurField}
        disabled={disabled}
      />
      <LabeledInput
        label="Snapchat (if required)"
        value={fields.snapchat_handle ?? ""}
        onChange={(v) => set("snapchat_handle", v)}
        onBlur={onBlurField}
        disabled={disabled}
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Due by</label>
        <input
          type="date"
          value={fields.due_by ?? ""}
          onChange={(e) => set("due_by", e.target.value || null)}
          onBlur={onBlurField}
          disabled={disabled}
          className={fieldClass}
        />
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  onBlur,
  disabled,
  span = 1,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  span?: 1 | 2;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${span === 2 ? "col-span-2" : ""}`}>
      <label className="text-xs font-medium text-muted">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        className={fieldClass}
      />
    </div>
  );
}
