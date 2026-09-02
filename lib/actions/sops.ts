"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import { deleteSopDocument, uploadSopDocument } from "@/lib/storage";

export type SopFields = {
  title: string;
  category: string | null;
  description: string | null;
  video_link: string | null;
};

function normalizeFields(fields: SopFields) {
  if (!fields.title.trim()) throw new Error("Give the SOP a title.");
  return {
    title: fields.title.trim(),
    category: fields.category?.trim() || null,
    description: fields.description?.trim() || null,
    video_link: fields.video_link?.trim() || null,
  };
}

export async function createSop(fields: SopFields, file?: File | null) {
  const profile = await requireStaff();
  const normalized = normalizeFields(fields);

  let document_path: string | null = null;
  let document_filename: string | null = null;
  if (file && file.size > 0) {
    const uploaded = await uploadSopDocument(file);
    document_path = uploaded.path;
    document_filename = uploaded.filename;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sops").insert({
    added_by: profile.id,
    document_path,
    document_filename,
    ...normalized,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/sops");
}

export async function updateSop(id: string, fields: SopFields, file?: File | null) {
  await requireStaff();
  const normalized = normalizeFields(fields);

  const supabase = await createClient();
  const update: Record<string, unknown> = { ...normalized };

  if (file && file.size > 0) {
    const { data: existing } = await supabase.from("sops").select("document_path").eq("id", id).single();
    const uploaded = await uploadSopDocument(file);
    update.document_path = uploaded.path;
    update.document_filename = uploaded.filename;
    if (existing?.document_path) await deleteSopDocument(existing.document_path);
  }

  const { error } = await supabase.from("sops").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/sops");
}

export async function removeSopDocument(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data: existing } = await supabase.from("sops").select("document_path").eq("id", id).single();
  if (existing?.document_path) await deleteSopDocument(existing.document_path);

  const { error } = await supabase
    .from("sops")
    .update({ document_path: null, document_filename: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/sops");
}

export async function deleteSop(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data: existing } = await supabase.from("sops").select("document_path").eq("id", id).single();

  const { error } = await supabase.from("sops").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (existing?.document_path) await deleteSopDocument(existing.document_path);
  revalidatePath("/sops");
}
