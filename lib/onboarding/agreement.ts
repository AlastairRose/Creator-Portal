// Agreement wording is plain text with blanks written in square brackets,
// e.g. "This agreement is between LBC and [Full legal name] of [Address]."
// Each distinct label becomes one input the creator fills in; the same label
// used twice is the same blank. Shared by the server (to fill in the signed
// copy) and the client (to render the inputs).

export type AgreementSegment = { type: "text"; text: string } | { type: "blank"; label: string; key: string };

const BLANK = /\[([^\[\]\n]{1,80})\]/g;

export function blankKey(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "blank";
}

export function parseAgreement(body: string): AgreementSegment[] {
  const segments: AgreementSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(BLANK)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ type: "text", text: body.slice(last, index) });
    const label = match[1].trim();
    segments.push({ type: "blank", label, key: blankKey(label) });
    last = index + match[0].length;
  }
  if (last < body.length) segments.push({ type: "text", text: body.slice(last) });
  return segments;
}

export function agreementBlanks(body: string): { key: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const s of parseAgreement(body)) if (s.type === "blank" && !seen.has(s.key)) seen.set(s.key, s.label);
  return [...seen].map(([key, label]) => ({ key, label }));
}

export function fillAgreement(body: string, values: Record<string, string>): string {
  return parseAgreement(body)
    .map((s) => (s.type === "text" ? s.text : (values[s.key] ?? "").trim()))
    .join("");
}

// Blanks with these labels are pre-filled for the creator (still editable).
export function isDateBlank(label: string): boolean {
  return /^(today'?s )?date$/i.test(label.trim());
}
