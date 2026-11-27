"use server";

import { getCurrentProfile } from "@/lib/roles";
import { sendDiscordTest } from "@/lib/discord";

export async function sendDiscordTestMessage(): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "owner") return { error: "Only the owner can send a test." };
  return sendDiscordTest();
}
