import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/roles";
import ChatTeam from "@/components/chat-team/ChatTeam";

export const dynamic = "force-dynamic";

// Creators message the chat team about one of their video calls. A chat can
// only be started from a call ("Message the chat team about this call").
export default async function ChatTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string; call?: string; change?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "creator" || !profile.creator_id) redirect("/");

  const { chat, call, change } = await searchParams;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Message the Chat Team</h1>
        <p className="mt-1 text-sm text-muted">
          About your video call requests. For anything else, message management in your WhatsApp group.
        </p>
      </div>
      <ChatTeam initialChatId={chat ?? null} callId={call ?? null} changeTime={!!change} />
    </div>
  );
}
