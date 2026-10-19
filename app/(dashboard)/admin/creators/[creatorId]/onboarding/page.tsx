import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeOnboardingState, ONBOARDING_STEPS, type ModelInfoAnswers, type OnboardingRow } from "@/lib/onboarding/state";
import { FIELD_GROUPS, LIST_SECTIONS, fieldSectionKey } from "@/lib/onboarding/model-info-template";
import { formatDateUK } from "@/lib/format";
import {
  PrivateFileLink,
  RequireOnboardingToggle,
  ResendModelInfoButton,
  RevealPassword,
  SignatureImage,
} from "@/components/admin/OnboardingAdminControls";

// Per-creator onboarding record. Uses the service-role client, so access is
// enforced here by role: agreement, details and documents for management
// (owner + creative director); logins for the owner only; progress and
// model info for all staff.
export default async function CreatorOnboardingPage({ params }: { params: Promise<{ creatorId: string }> }) {
  const profile = await requireStaff();
  const { creatorId } = await params;
  const isOwner = profile.role === "owner";
  const isManagement = isOwner || profile.role === "creative_director";

  const admin = createAdminClient();
  const { data: creator } = await admin.from("creators").select("id, name").eq("id", creatorId).maybeSingle();
  if (!creator) notFound();

  const [{ data: row }, { data: modelInfo }, agreementRes, detailsRes, docsRes, loginsRes] = await Promise.all([
    admin.from("creator_onboarding").select("*").eq("creator_id", creatorId).maybeSingle(),
    admin.from("creator_model_info").select("*").eq("creator_id", creatorId).maybeSingle(),
    isManagement
      ? admin.from("creator_agreements").select("*").eq("creator_id", creatorId).order("signed_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    isManagement
      ? admin.from("creator_personal_details").select("*").eq("creator_id", creatorId).maybeSingle()
      : Promise.resolve({ data: null }),
    isManagement
      ? admin.from("creator_documents").select("*").eq("creator_id", creatorId).order("uploaded_at", { ascending: true })
      : Promise.resolve({ data: null }),
    isOwner
      ? admin.from("creator_account_logins").select("id, platform, username, notes, created_at").eq("creator_id", creatorId).order("created_at")
      : Promise.resolve({ data: null }),
  ]);
  const state = computeOnboardingState(row as OnboardingRow | null);
  const agreement = agreementRes.data;
  const details = detailsRes.data;
  const documents = (docsRes.data ?? []) as { id: string; kind: string; path: string; original_name: string | null; uploaded_at: string }[];
  const logins = (loginsRes.data ?? []) as { id: string; platform: string; username: string; notes: string | null }[];
  const answers = (modelInfo?.answers ?? null) as ModelInfoAnswers | null;
  const stepTimes: Record<string, string | null | undefined> = {
    agreement: row?.agreement_signed_at,
    details: row?.details_submitted_at,
    model_info: row?.model_info_submitted_at,
    notifications: row?.notifications_done_at,
    video: row?.video_watched_at,
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/admin/creators" className="text-xs text-accent hover:underline">
          ← Creators
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{creator.name}: onboarding</h1>
      </div>

      <Card title="Progress">
        {state.exempt ? (
          <p className="text-sm text-muted">
            Onboarding isn&apos;t required for this creator. They were already set up before onboarding was switched on.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {ONBOARDING_STEPS.map((s) => (
              <li key={s.key} className="flex justify-between gap-4">
                <span>
                  {state.done[s.key] ? "✓" : "○"} {s.title}
                  {s.required ? <span className="text-xs text-muted"> (required)</span> : null}
                </span>
                <span className="text-xs text-muted">{stepTimes[s.key] ? formatDateUK(stepTimes[s.key]!) : "Not yet"}</span>
              </li>
            ))}
          </ul>
        )}
        {isManagement && <RequireOnboardingToggle creatorId={creatorId} required={!state.exempt} />}
      </Card>

      {isManagement && (
        <Card title="Signed agreement">
          {agreement ? (
            <>
              <p className="text-sm">
                Signed by <span className="font-medium">{agreement.signer_name}</span> on {formatDateUK(agreement.signed_at)}{" "}
                at {new Date(agreement.signed_at).toLocaleTimeString("en-GB", { timeZone: "UTC" })} UTC
                {agreement.signer_ip ? ` · IP ${agreement.signer_ip}` : ""} · version {agreement.agreement_version}
              </p>
              <SignatureImage path={agreement.signature_path} />
              <details className="rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">Read the signed copy</summary>
                <h3 className="mt-3 text-sm font-semibold">{agreement.agreement_title}</h3>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{agreement.agreement_text}</div>
              </details>
            </>
          ) : (
            <p className="text-sm text-muted">Not signed yet.</p>
          )}
        </Card>
      )}

      {isManagement && (
        <Card title="Personal details and ID">
          {details ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Name</dt>
              <dd>
                {details.first_name} {details.last_name}
              </dd>
              <dt className="text-muted">Phone</dt>
              <dd>{details.phone}</dd>
              <dt className="text-muted">Email</dt>
              <dd>{details.email}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted">Not submitted yet.</p>
          )}
          {documents.length > 0 && (
            <div className="flex flex-col gap-1">
              {documents.map((d) => (
                <PrivateFileLink
                  key={d.id}
                  path={d.path}
                  label={`${d.kind === "id_document" ? "Photo ID" : "Proof of address"}: ${d.original_name ?? "file"}`}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {isOwner && (
        <Card title="Account logins">
          {logins.length === 0 ? (
            <p className="text-sm text-muted">None saved.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {logins.map((l) => (
                <li key={l.id} className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
                  <span className="font-medium">{l.platform}</span>
                  <span className="text-muted">{l.username}</span>
                  {l.notes && <span className="text-xs text-muted">{l.notes}</span>}
                  <RevealPassword loginId={l.id} />
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">Only you can see these. Each time a password is revealed, it&apos;s logged.</p>
        </Card>
      )}

      <Card title="Model info">
        {answers ? (
          <>
            <p className="text-xs text-muted">
              Submitted {formatDateUK(modelInfo!.submitted_at)}.{" "}
              {modelInfo!.chatter_portal_synced_at
                ? `Sent to the Chatter Portal on ${formatDateUK(modelInfo!.chatter_portal_synced_at)}.`
                : modelInfo!.chatter_portal_sync_error
                  ? `Not sent to the Chatter Portal yet: ${modelInfo!.chatter_portal_sync_error}`
                  : "Not sent to the Chatter Portal yet."}
            </p>
            <ResendModelInfoButton creatorId={creatorId} />
            <details className="rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">See answers</summary>
              <div className="mt-3 flex flex-col gap-4 text-sm">
                {FIELD_GROUPS.map((g) => {
                  const rows = g.fields
                    .map((f) => [f.label, answers.fields[fieldSectionKey(g.groupKey, f.key)]] as const)
                    .filter(([, v]) => v);
                  if (rows.length === 0) return null;
                  return (
                    <div key={g.groupKey}>
                      <p className="font-medium">{g.groupLabel}</p>
                      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                        {rows.map(([label, value]) => (
                          <div key={label} className="contents">
                            <dt className="text-muted">{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  );
                })}
                {LIST_SECTIONS.map((l) => {
                  const items = answers.lists[l.listKey] ?? [];
                  if (items.length === 0) return null;
                  return (
                    <div key={l.listKey}>
                      <p className="font-medium">{l.groupLabel}</p>
                      <ul className="mt-1 list-disc pl-5">
                        {items.map((i, n) => (
                          <li key={n}>
                            {i.title ? <span className="font-medium">{i.title}: </span> : null}
                            {i.content}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </details>
          </>
        ) : (
          <p className="text-sm text-muted">Not submitted yet.</p>
        )}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
