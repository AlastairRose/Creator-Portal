"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/roles";
import { disconnectGoogleDrive as disconnect } from "@/lib/google-drive";

export async function disconnectGoogleDriveAction() {
  await requireOwner();
  await disconnect();
  revalidatePath("/admin/google-drive");
}
