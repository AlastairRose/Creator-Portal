const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Formats a date for display as UK-standard day/month/year. Plain
// YYYY-MM-DD strings (date-only columns) are string-split rather than
// parsed as a Date, to avoid timezone drift — see lib/weeks.ts. Full ISO
// timestamps (created_at etc.) are parsed normally and reformatted using
// the viewer's local time.
export function formatDateUK(value: string | null | undefined): string {
  if (!value) return "—";
  if (PLAIN_DATE.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}
