// Minimal Resend sender (https://resend.com/docs/api-reference/emails/send-email).
// Server-only. EMAIL_FROM must be an address on a domain verified in Resend;
// without one, Resend only delivers to the Resend account's own address.
export async function sendEmail({ to, subject, html }: { to: string[]; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email isn't configured yet (missing RESEND_API_KEY).");
  const from = process.env.EMAIL_FROM || "Creator Portal <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Sending email failed: ${await res.text()}`);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
