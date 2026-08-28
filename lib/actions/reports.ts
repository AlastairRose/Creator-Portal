"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import type { ReportPeriodType } from "@/lib/types";

export type ReportFields = {
  period_type: ReportPeriodType;
  period_start: string;
  period_end: string;
  revenue: number | null;
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
    revenue: fields.revenue,
    went_well: fields.went_well?.trim() || null,
    can_improve: fields.can_improve?.trim() || null,
    next_plan: fields.next_plan?.trim() || null,
  };
}

// Upserts on (creator_id, period_type, period_start) — re-generating a
// report for a period you've already created updates it in place rather
// than erroring on the unique constraint.
export async function createReport(creatorId: string, fields: ReportFields): Promise<string> {
  const profile = await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .upsert(
      { creator_id: creatorId, generated_by: profile.id, ...normalizeReportFields(fields) },
      { onConflict: "creator_id,period_type,period_start" }
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/reports");
  return data.id;
}

export async function updateReport(id: string, fields: ReportFields) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("reports").update(normalizeReportFields(fields)).eq("id", id);
  if (error) throw new Error(error.message);
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
