import { createAdminClient } from "@/lib/supabase/admin";
import type { SignedAgreement } from "@/components/onboarding/AgreementDocument";

// Latest signed agreement for a creator plus short-lived links to both
// signature images. Callers must check the viewer may see it first.
export async function loadSignedAgreement(creatorId: string): Promise<{
  agreement: SignedAgreement;
  signatureUrl: string | null;
  countersignatureUrl: string | null;
} | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("creator_agreements")
    .select("*")
    .eq("creator_id", creatorId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data: signed } = await admin.storage.from("creator-onboarding").createSignedUrl(path, 60 * 60);
    return signed?.signedUrl ?? null;
  };
  const [signatureUrl, countersignatureUrl] = await Promise.all([sign(data.signature_path), sign(data.countersignature_path)]);
  return { agreement: data as SignedAgreement, signatureUrl, countersignatureUrl };
}
