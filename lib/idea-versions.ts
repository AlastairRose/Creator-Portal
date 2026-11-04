// Names for duplicated ideas: "Beach walk" -> "Beach walk (v2)" -> "(v3)"…
// Duplicating any version picks the next free number for that idea.
const VERSION_SUFFIX = /\s*\((?:v(\d+)|copy)\)\s*$/i;

export function baseIdeaName(name: string): string {
  return name.replace(VERSION_SUFFIX, "").trim() || name.trim();
}

export function nextVersionName(name: string, existingNames: string[]): string {
  const base = baseIdeaName(name);
  let highest = 1;
  for (const existing of existingNames) {
    if (baseIdeaName(existing).toLowerCase() !== base.toLowerCase()) continue;
    const match = VERSION_SUFFIX.exec(existing);
    const n = match?.[1] ? Number(match[1]) : 1;
    if (n > highest) highest = n;
  }
  return `${base} (v${highest + 1})`;
}

/** Escapes a value for a Postgres ILIKE prefix match. */
export function likePrefix(value: string): string {
  return `${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
