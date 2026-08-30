"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateContentWeekDriveLink } from "@/lib/actions/planner";
import WeekPicker from "@/components/shared/WeekPicker";
import type {
  ContentWeek,
  Creator,
  CreatorDriveLinks,
  OnlyfansContentRequestWithItems,
  OutstandingCustom,
  Reel,
} from "@/lib/types";
import ReelsToFilmSection from "./ReelsToFilmSection";
import OnlyfansContentSection from "./OnlyfansContentSection";
import OutstandingCustomsSection from "./OutstandingCustomsSection";

export default function ContentPlannerView({
  creator,
  weekStartDate,
  contentWeek,
  reels,
  onlyfansRequests,
  outstandingCustoms,
  driveLinks,
  isStaff,
}: {
  creator: Creator;
  weekStartDate: string;
  contentWeek: ContentWeek | null;
  reels: Reel[];
  onlyfansRequests: OnlyfansContentRequestWithItems[];
  outstandingCustoms: OutstandingCustom[];
  driveLinks: CreatorDriveLinks | null;
  isStaff: boolean;
}) {
  const router = useRouter();

  function navigateWeek(week: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("week", week);
    router.push(`${url.pathname}${url.search}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{creator.name}&apos;s Content Planner</h1>
        <p className="mt-1 text-sm text-muted">Reels to film, uploads, and this week&apos;s status.</p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Week</label>
          <WeekPicker weekStartDate={weekStartDate} onChange={navigateWeek} />
        </div>
        {contentWeek && <DriveLinkField contentWeekId={contentWeek.id} initialLink={contentWeek.drive_link} />}
      </div>

      {!contentWeek ? (
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">
          Nothing has been published for this week yet.
        </div>
      ) : (
        <ReelsToFilmSection reels={reels} isStaff={isStaff} />
      )}

      <OnlyfansContentSection
        creatorId={creator.id}
        requests={onlyfansRequests}
        driveLink={driveLinks?.onlyfans_drive_link ?? null}
        isStaff={isStaff}
      />

      <OutstandingCustomsSection
        creatorId={creator.id}
        customs={outstandingCustoms}
        driveLink={driveLinks?.customs_drive_link ?? null}
        isStaff={isStaff}
      />
    </div>
  );
}

function DriveLinkField({
  contentWeekId,
  initialLink,
}: {
  contentWeekId: string;
  initialLink: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialLink ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    if (value === (initialLink ?? "")) return;
    startTransition(async () => {
      await updateContentWeekDriveLink(contentWeekId, value);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">Google Drive upload link</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        disabled={isPending}
        placeholder="Paste this week's shared Drive folder link"
        className="w-80 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70"
      />
    </div>
  );
}
