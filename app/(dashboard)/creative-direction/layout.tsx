import { requireStaff } from "@/lib/roles";
import { getCreators } from "@/lib/queries";
import CreativeDirectionShell from "@/components/creative-direction/CreativeDirectionShell";

export default async function CreativeDirectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff();
  const creators = await getCreators();

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-xl font-semibold tracking-tight">Creative Direction</h1>
        <p className="mt-1 text-sm text-muted">
          Plan reel ideas and each creator&apos;s overall content strategy. Nothing here is
          visible to creators.
        </p>
      </div>
      <CreativeDirectionShell creators={creators}>{children}</CreativeDirectionShell>
    </div>
  );
}
