import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/roles";
import ChatTeam from "@/components/chat-team/ChatTeam";

export const dynamic = "force-dynamic";

// Creators message the chat team about customs, video calls and fan chats.
export default async function ChatTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string; call?: string; change?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "creator" || !profile.creator_id) redirect("/");

  const { chat, call, change } = await searchParams;
  const prefill = call
    ? {
        topic: "video_call" as const,
        videoCallId: call,
        message: change ? "I need to change the time of this call. Could we move it to: " : "",
      }
    : null;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Message the Chat Team</h1>
        <p className="mt-1 text-sm text-muted">
          For custom requests, video calls, or helping with a fan chat. For anything else, message management in your
          WhatsApp group.
        </p>
      </div>
      <ChatTeam initialChatId={chat ?? null} prefill={prefill} />
    </div>
  );
}
