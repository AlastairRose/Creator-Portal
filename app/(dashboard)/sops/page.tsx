import { requireStaff } from "@/lib/roles";
import { getSops } from "@/lib/queries";
import SopsBoard from "@/components/sops/SopsBoard";

export default async function SopsPage() {
  await requireStaff();
  const sops = await getSops();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">SOPs</h1>
        <p className="mt-1 text-sm text-muted">
          Standard operating procedures and guides — upload a document, link a walkthrough video,
          or both.
        </p>
      </div>

      <SopsBoard sops={sops} />
    </div>
  );
}
