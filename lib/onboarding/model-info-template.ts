/**
 * COPY of the Chatter Portal's src/lib/modelInfoTemplate.ts — the onboarding
 * model info form asks exactly these fields, and its answers are sent to the
 * Chatter Portal's Model Information page under these same keys. If the
 * Chatter Portal's template changes, update this copy to match.
 */

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export interface FieldDef {
  key: string;
  label: string;
}

export interface FieldGroup {
  groupKey: string;
  groupLabel: string;
  fields: FieldDef[];
}

function fieldGroup(groupKey: string, groupLabel: string, labels: string[]): FieldGroup {
  return {
    groupKey,
    groupLabel,
    fields: labels.map((label) => ({ key: slugify(label), label })),
  };
}

export const FIELD_GROUPS: FieldGroup[] = [
  fieldGroup("basic_info", "Basic Info", [
    "Stage name",
    "Location",
    "Hometown",
    "Relationship Status",
    "Sexual Orientation",
    "Religion",
    "Age",
    "Date of Birth",
    "Height",
    "Weight",
    "Body Type",
    "Foot Size",
    "Bra Size",
    "Favourite Drinks",
    "Tattoos",
    "Kids",
    "Education",
    "Favourite Music",
    "Boobs (Natural/Fake)",
    "Favourite Colour",
    "Disliked Colour",
    "Favourite Food",
    "Disliked Food",
    "Allergies",
  ]),
  fieldGroup("home_life", "Home Life", ["Family", "Housemates", "Pets", "TV/Movies", "Books", "A Day at Home"]),
  fieldGroup("sexual_preferences", "Sexual Preferences", [
    "Dom/Sub",
    "Favourite Positions",
    "Favourite Sexual Actions",
    "Craziest Place You've Had Sex",
  ]),
  fieldGroup("boundaries", "Sexual Boundaries + Custom Request Info", [
    "5 min custom",
    "10 min custom",
    "Video Call",
    "Anal",
    "DP (Pussy and Anal)",
    "DP (Pussy only)",
    "Squirt",
    "Dick rate",
    "Use fan's name",
    "Write fan's name somewhere",
    "Dildo",
    "JOI",
    "Spit",
    "Fingering",
    "Dominant play",
    "Submissive play",
    "Roleplay",
    "Ageplay",
    "Raceplay",
  ]),
];

export interface ListSectionDef {
  listKey: string;
  groupLabel: string;
  hasTitle: boolean;
  addButtonLabel: string;
  titlePlaceholder?: string;
  contentPlaceholder: string;
}

/** Sections whose content is a variable-length list of items, not a fixed field set. */
export const LIST_SECTIONS: ListSectionDef[] = [
  {
    listKey: "hobbies",
    groupLabel: "Hobbies",
    hasTitle: true,
    addButtonLabel: "Add hobby",
    titlePlaceholder: "e.g. Gym",
    contentPlaceholder: "Describe it in her voice...",
  },
  {
    listKey: "stories",
    groupLabel: "Sexual Stories",
    hasTitle: false,
    addButtonLabel: "Add story",
    contentPlaceholder: "A story fans might ask about...",
  },
  {
    listKey: "ambitions",
    groupLabel: "Ambitions + Future Plans",
    hasTitle: false,
    addButtonLabel: "Add item",
    contentPlaceholder: "A goal, plan, or ambition...",
  },
  {
    listKey: "anecdotes",
    groupLabel: "Anecdotes + Stories",
    hasTitle: false,
    addButtonLabel: "Add item",
    contentPlaceholder: "An anecdote or memorable story...",
  },
];

/** Where each section appears on the page, interleaving fixed-field and list sections. */
export const SECTION_ORDER = [
  "basic_info",
  "hobbies",
  "home_life",
  "sexual_preferences",
  "stories",
  "boundaries",
  "ambitions",
  "anecdotes",
] as const;

export function newListItemKey(listKey: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${listKey}__${Date.now()}-${random}`;
}

export function fieldSectionKey(groupKey: string, fieldKey: string): string {
  return `${groupKey}__${fieldKey}`;
}
