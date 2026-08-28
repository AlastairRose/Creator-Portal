"use client";

import { useEffect, useState } from "react";
import { getChatScreenshotSignedUrl } from "@/lib/storage";

export default function ChatScreenshotThumbnail({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    if (!path) return;
    let active = true;
    getChatScreenshotSignedUrl(path).then((signed) => {
      if (active) setUrl(signed);
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (!path) return <span className="text-xs text-muted">No screenshot</span>;
  if (!url) return <span className="text-xs text-muted">Loading…</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setEnlarged(true)}
        className="block h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Chat screenshot" className="h-full w-full object-cover" />
      </button>
      {enlarged && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          onClick={() => setEnlarged(false)}
        >
          <button
            type="button"
            onClick={() => setEnlarged(false)}
            aria-label="Close"
            className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-lg text-foreground hover:bg-surface-raised"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Chat screenshot"
            className="h-[88vh] w-[88vw] rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}
