import { requireStaff } from "@/lib/roles";
import { getCreators } from "@/lib/queries";
import IntakeLinksList from "@/components/admin/IntakeLinksList";

export default async function IntakeLinksPage() {
  await requireStaff();
  const creators = await getCreators();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Custom Request Links</h1>
        <p className="mt-1 text-sm text-muted">
          Each creator has their own link for the sales team to submit new custom requests — no
          login needed. Share the right one with whoever handles that creator&apos;s chats.
        </p>
      </div>

      <IntakeLinksList creators={creators} />
    </div>
  );
}
