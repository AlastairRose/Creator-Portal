// Public (no login) — linked from the Google OAuth consent screen, which
// requires a reachable privacy policy before the app can leave "Testing".
// See the /privacy exemption in proxy.ts.
export const metadata = { title: "Privacy Policy – Creator Portal" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 text-sm leading-6">
      <h1 className="text-xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-1 text-muted">Last updated 12 October 2026</p>

      <h2 className="mt-8 font-semibold">About Creator Portal</h2>
      <p className="mt-2 text-muted">
        Creator Portal is a private, invite-only tool used by our agency&apos;s staff and the creators we work with
        to plan, film and deliver content. It is not available to the general public.
      </p>

      <h2 className="mt-8 font-semibold">Information we keep</h2>
      <p className="mt-2 text-muted">
        We store the account details of invited users (name, email address and role) and the content plans,
        ideas and status updates entered into the portal. This information is used only to run the portal and is
        never sold or shared with advertisers.
      </p>

      <h2 className="mt-8 font-semibold">Google Drive access</h2>
      <p className="mt-2 text-muted">
        The agency owner can connect one Google account to the portal. The portal uses that access only to create
        dated weekly folders for each creator&apos;s uploads and to save links to those folders in the portal. It
        does not read, download or change the contents of other files. Google user data is handled in line with
        the Google API Services User Data Policy, including its Limited Use requirements. The connection can be
        removed at any time from the portal&apos;s admin settings or from the Google account&apos;s security
        settings.
      </p>

      <h2 className="mt-8 font-semibold">Contact</h2>
      <p className="mt-2 text-muted">
        Questions about this policy can be sent to{" "}
        <a href="mailto:lolasbunnycollective@gmail.com" className="text-accent hover:underline">
          lolasbunnycollective@gmail.com
        </a>
        .
      </p>
    </main>
  );
}
