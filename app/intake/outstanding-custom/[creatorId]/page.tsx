import { getCreatorPublic } from "@/lib/queries";
import OutstandingCustomIntakeForm from "@/components/intake/OutstandingCustomIntakeForm";

// No cookies/headers dependency (public, unauthenticated) — force dynamic so
// Next.js doesn't freeze this at build time (it would otherwise 404 forever
// for any creator added after the last deploy).
export const dynamic = "force-dynamic";

export default async function OutstandingCustomIntakePage({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}) {
  const { creatorId } = await params;
  const creator = await getCreatorPublic(creatorId);

  if (!creator) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-2 px-4 py-12 text-sm text-muted">
        <p>This link isn&apos;t valid — ask your admin for the correct one.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New Custom Request — {creator.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Fill this out for every new custom request from a fan for {creator.name}.
        </p>
      </div>
      <OutstandingCustomIntakeForm creatorId={creator.id} />
    </div>
  );
}
