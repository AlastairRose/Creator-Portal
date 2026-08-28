import type { ReelDraftFields } from "@/lib/actions/creative-direction";

// The founder wants every field filled in before a reel can be
// added/saved, to force a consistently detailed brief each time.
export const REEL_FIELD_LABELS: Record<keyof ReelDraftFields, string> = {
  name: "Name",
  idea: "Idea",
  inspo_link: "Inspo link",
  required_shots: "Required shots",
  hook: "Hook",
  outfit: "Outfit",
  location: "Location",
  filming_style: "Filming style",
  vertical: "Vertical",
  editing_notes: "Editing notes",
  posting_notes: "Posting notes",
};

export const REQUIRED_REEL_FIELDS = Object.keys(REEL_FIELD_LABELS) as (keyof ReelDraftFields)[];

export function getMissingReelFields(fields: ReelDraftFields): string[] {
  return REQUIRED_REEL_FIELDS.filter((key) => !fields[key]?.trim()).map(
    (key) => REEL_FIELD_LABELS[key]
  );
}
