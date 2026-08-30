"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import DriveUploadButton from "./DriveUploadButton";

// Staff set this; creators only ever need to read it to know where to
// upload, so it's a plain link for them and an editable field for staff.
export default function CreatorDriveLinkField({
  label,
  buttonLabel,
  initialLink,
  isStaff,
  onSave,
}: {
  label: string;
  buttonLabel: string;
  initialLink: string | null;
  isStaff: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialLink ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    if (value === (initialLink ?? "")) return;
    startTransition(async () => {
      await onSave(value);
      router.refresh();
    });
  }

  if (!isStaff) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">{label}</label>
        {initialLink ? (
          <DriveUploadButton href={initialLink} label={buttonLabel} />
        ) : (
          <span className="text-sm text-muted">Not set yet.</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">{label}</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        disabled={isPending}
        placeholder="Paste the shared Drive folder link"
        className="w-80 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70"
      />
      {initialLink && <DriveUploadButton href={initialLink} label={buttonLabel} />}
    </div>
  );
}
