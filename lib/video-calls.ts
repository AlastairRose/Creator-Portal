// Shared shape and rules for video call requests (see the
// 20261019010000_video_call_requests migration). Safe to import anywhere.

export type VideoCallStatus = "pending" | "accepted" | "unavailable" | "declined" | "cancelled";

export type VideoCallRequest = {
  id: string;
  creator_id: string;
  chatter_portal_creator_id: string | null;
  requested_by_name: string;
  requested_by_ref: string | null;
  fan_name: string;
  length_minutes: number;
  price_usd: number | null;
  notes: string | null;
  timing: "asap" | "scheduled";
  requested_for: string | null;
  expires_at: string;
  status: VideoCallStatus;
  decline_note: string | null;
  alternative_times: string[];
  responded_at: string | null;
  created_at: string;
};

/** How long an ASAP request waits for the creator before it lapses. */
export const ASAP_EXPIRY_MINUTES = 20;

/** Most "I'm free at…" times a creator can offer when not available now. */
export const MAX_ALTERNATIVE_TIMES = 3;

export const VIDEO_CALL_COLUMNS =
  "id, creator_id, chatter_portal_creator_id, requested_by_name, requested_by_ref, fan_name, length_minutes, price_usd, notes, timing, requested_for, expires_at, status, decline_note, alternative_times, responded_at, created_at";

/** Pending but past its expiry - shown as "Expired" and can no longer be answered. */
export function isExpired(r: Pick<VideoCallRequest, "status" | "expires_at">, now = Date.now()): boolean {
  return r.status === "pending" && new Date(r.expires_at).getTime() < now;
}

export type DisplayStatus = VideoCallStatus | "expired";

export function displayStatus(r: Pick<VideoCallRequest, "status" | "expires_at">, now = Date.now()): DisplayStatus {
  return isExpired(r, now) ? "expired" : r.status;
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  pending: "Waiting for reply",
  accepted: "Accepted",
  unavailable: "Not available - suggested times",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired - no reply",
};
