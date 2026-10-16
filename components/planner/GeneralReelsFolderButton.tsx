import DriveUploadButton from "@/components/shared/DriveUploadButton";

// The creator's general reels folder (the "weekly root" folder set on their
// Overall Plan, where each week's folder is created). For footage that isn't
// part of a particular week's plan — it lands in the general folder, not in
// any week's folder.
export default function GeneralReelsFolderButton({
  href,
  isStaff,
}: {
  href: string | null | undefined;
  isStaff: boolean;
}) {
  if (!href) {
    if (!isStaff) return null;
    return (
      <p className="text-xs text-muted">
        No general reels folder set for this creator yet. Add one under Creative Direction → Overall Plan to show an
        &quot;Upload to General Folder&quot; button here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <DriveUploadButton href={href} label="Upload to General Folder" />
      <p className="text-xs text-muted">
        For reels that aren&apos;t part of a week&apos;s plan. These go into the general folder, not this week&apos;s
        folder.
      </p>
    </div>
  );
}
