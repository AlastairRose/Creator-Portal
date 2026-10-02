"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import { deleteReportScreenshot, uploadReportScreenshot } from "@/lib/storage";
import type { ReportPeriodType } from "@/lib/types";

export type ReportFields = {
  period_type: ReportPeriodType;
  period_start: string;
  period_end: string;
  total_revenue: number | null;
  agency_share: number | null;
  creator_share: number | null;
  went_well: string | null;
  can_improve: string | null;
  next_plan: string | null;
};

function normalizeReportFields(fields: ReportFields) {
  if (!fields.period_start || !fields.period_end) {
    throw new Error("Pick a start and end date for this report.");
  }
  return {
    period_type: fields.period_type,
    period_start: fields.period_start,
    period_end: fields.period_end,
    total_revenue: fields.total_revenue,
    agency_share: fields.agency_share,
    creator_share: fields.creator_share,
    went_well: fields.went_well?.trim() || null,
    can_improve: fields.can_improve?.trim() || null,
    next_plan: fields.next_plan?.trim() || null,
  };
}

// Upserts on (creator_id, period_type, period_start) — re-generating a
// report for a period you've already created updates it in place rather
// than erroring on the unique constraint.
export async function createReport(
  creatorId: string,
  fields: ReportFields,
  screenshotFiles?: File[] | null
): Promise<string> {
  const profile = await requireStaff();
  const screenshot_paths = screenshotFiles?.length
    ? await Promise.all(screenshotFiles.map((file) => uploadReportScreenshot(file)))
    : [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .upsert(
      { creator_id: creatorId, generated_by: profile.id, screenshot_paths, ...normalizeReportFields(fields) },
      { onConflict: "creator_id,period_type,period_start" }
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/reports");
  return data.id;
}

export async function updateReport(id: string, fields: ReportFields, newScreenshotFiles?: File[] | null) {
  await requireStaff();
  const supabase = await createClient();
  const update: Record<string, unknown> = normalizeReportFields(fields);

  if (newScreenshotFiles && newScreenshotFiles.length > 0) {
    const uploaded = await Promise.all(newScreenshotFiles.map((file) => uploadReportScreenshot(file)));
    const { data: current, error: fetchError } = await supabase
      .from("reports")
      .select("screenshot_paths")
      .eq("id", id)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    update.screenshot_paths = [...(current?.screenshot_paths ?? []), ...uploaded];
  }

  const { error } = await supabase.from("reports").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/reports");
  revalidatePath(`/reports/${id}`);
}

// Removes one screenshot from a report's gallery — fetches the current list
// rather than trusting the client's copy, same reasoning as the Outstanding
// Customs equivalent.
export async function removeReportScreenshot(id: string, path: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data: current, error: fetchError } = await supabase
    .from("reports")
    .select("screenshot_paths")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const remaining = (current?.screenshot_paths ?? []).filter((p: string) => p !== path);
  const { error } = await supabase.from("reports").update({ screenshot_paths: remaining }).eq("id", id);
  if (error) throw new Error(error.message);

  await deleteReportScreenshot(path);
  revalidatePath("/reports");
  revalidatePath(`/reports/${id}`);
}

export async function deleteReport(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/reports");
}
