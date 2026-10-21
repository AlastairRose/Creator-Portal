"use server";

import { createCustomRequest, CUSTOM_TEXT_FIELDS, type NewCustomFields } from "@/lib/custom-intake";

// Public, unauthenticated intake — the sales team submits this via a plain
// shared link scoped to one creator, same as the old Airtable form. No
// Creator Portal login exists for them, so this uses the service-role
// client to write directly, bypassing RLS on purpose. Keep this action
// narrow: it can only insert a fresh 'outstanding' custom request for the
// bound creatorId, never read, update, or delete.
export type IntakeState = { error: string | null; success: boolean };

export async function submitOutstandingCustomIntake(
  creatorId: string,
  _prevState: IntakeState,
  formData: FormData
): Promise<IntakeState> {
  const field = (name: string) => String(formData.get(name) ?? "").trim() || null;
  const screenshots = formData.getAll("chat_screenshot").filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  const result = await createCustomRequest({
    creatorId,
    chatterName: String(formData.get("chatter_name") ?? "").trim().slice(0, 100),
    fields: {
      description: String(formData.get("description") ?? "").trim(),
      ...(Object.fromEntries(CUSTOM_TEXT_FIELDS.map((k) => [k, field(k)])) as Omit<NewCustomFields, "description">),
    },
    screenshots,
  });
  if ("error" in result) return { error: result.error, success: false };
  return { error: null, success: true };
}
