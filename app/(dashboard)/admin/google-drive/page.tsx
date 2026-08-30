import { requireOwner } from "@/lib/roles";
import { getGoogleDriveConnection } from "@/lib/google-drive";
import { disconnectGoogleDriveAction } from "@/lib/actions/google-drive";

export default async function GoogleDrivePage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  await requireOwner();
  const { connected, error } = await searchParams;
  const connection = await getGoogleDriveConnection();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Google Drive</h1>
        <p className="mt-1 text-sm text-muted">
          Connect a Google account so publishing a creator&apos;s week automatically creates a dated Drive
          folder for it, instead of pasting the link in by hand.
        </p>
      </div>

      {connected && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Connected successfully.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        {connection ? (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm">
                Connected as <span className="font-medium">{connection.google_account_email ?? "unknown account"}</span>
              </p>
              <a
                href={`https://drive.google.com/drive/folders/${connection.root_folder_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:underline"
              >
                Open the &quot;Creator Portal&quot; folder in Drive
              </a>
            </div>
            <form action={disconnectGoogleDriveAction}>
              <button
                type="submit"
                className="self-start rounded-md border border-danger/40 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
              >
                Disconnect
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">No Google account connected yet.</p>
            <a
              href="/api/auth/google/connect"
              className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Connect Google Drive
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
