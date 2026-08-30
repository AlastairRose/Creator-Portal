"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// Staff set this; creators only ever need to read it to know where to
// upload, so it's a plain link for them and an editable field for staff.
export default function CreatorDriveLinkField({
  label,
  initialLink,
  isStaff,
  onSave,
}: {
  label: string;
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
          <a
            href={initialLink}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-accent hover:underline"
          >
            {initialLink}
          </a>
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
    </div>
  );
}
