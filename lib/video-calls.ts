// Shared shape and rules for video call requests. The Chatter Portal keeps a
// copy of the state logic (src/lib/videoCallState.ts) - keep the two in step.
//
//   pending  -> creator has 20 min to reply; after that it shows as "missed"
//   missed   -> she replied late with times to offer the fan instead
//   accepted -> waiting for the fan to pay (chat team has 20 min)
//   ready    -> paid; creator told the call is ready
//   declined -> not available / price too low / not interested
//   cancelled-> by the chat team, or the fan didn't pay

export type VideoCallStatus = "pending" | "missed" | "accepted" | "ready" | "declined" | "cancelled";
export type DeclineReason = "unavailable" | "price_too_low" | "not_interested";
export type CancelReason = "chatter_cancelled" | "fan_didnt_pay";

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
  expires_at: string; // reply deadline
  status: VideoCallStatus;
  decline_reason: DeclineReason | null;
  decline_note: string | null;
  alternative_times: string[];
  responded_at: string | null;
  accepted_at: string | null;
  payment_deadline: string | null;
  paid_at: string | null;
  paid_by_name: string | null;
  cancel_reason: CancelReason | null;
  cancelled_by_name: string | null;
  team_seen_at: string | null;
  team_seen_by_name: string | null;
  created_at: string;
};

/** Minutes the creator has to answer before the request counts as missed. */
export const REPLY_WINDOW_MINUTES = 20;
/** Minutes the chat team has to get the fan's payment once she accepts. */
export const PAYMENT_WINDOW_MINUTES = 20;
/** Most "I'm free at…" times a creator can offer. */
export const MAX_ALTERNATIVE_TIMES = 3;

export const VIDEO_CALL_COLUMNS =
  "id, creator_id, chatter_portal_creator_id, requested_by_name, requested_by_ref, fan_name, length_minutes, price_usd, notes, timing, requested_for, expires_at, status, decline_reason, decline_note, alternative_times, responded_at, accepted_at, payment_deadline, paid_at, paid_by_name, cancel_reason, cancelled_by_name, team_seen_at, team_seen_by_name, created_at";

/** Waiting on the creator but past the reply window. */
export function isNoReply(r: Pick<VideoCallRequest, "status" | "expires_at">, now = Date.now()): boolean {
  return r.status === "pending" && new Date(r.expires_at).getTime() < now;
}

/** Accepted, but the fan still hasn't paid after the payment window. */
export function isPaymentOverdue(r: Pick<VideoCallRequest, "status" | "payment_deadline">, now = Date.now()): boolean {
  return r.status === "accepted" && !!r.payment_deadline && new Date(r.payment_deadline).getTime() < now;
}

export type DisplayStatus = VideoCallStatus | "no_reply";

export function displayStatus(r: Pick<VideoCallRequest, "status" | "expires_at">, now = Date.now()): DisplayStatus {
  return isNoReply(r, now) ? "no_reply" : r.status;
}

export const DECLINE_REASON_LABELS: Record<DeclineReason, string> = {
  unavailable: "Not available",
  price_too_low: "Price too low",
  not_interested: "Doesn't want to do it",
};

export function statusLabel(r: Pick<VideoCallRequest, "status" | "expires_at" | "decline_reason" | "cancel_reason">, now = Date.now()): string {
  const s = displayStatus(r, now);
  switch (s) {
    case "pending":
      return "Waiting for creator";
    case "no_reply":
      return "Missed - no reply";
    case "missed":
      return "Missed - times suggested";
    case "accepted":
      return "Accepted - waiting for payment";
    case "ready":
      return "Paid - call ready";
    case "declined":
      return `Declined - ${DECLINE_REASON_LABELS[r.decline_reason ?? "not_interested"].toLowerCase()}`;
    case "cancelled":
      return r.cancel_reason === "fan_didnt_pay" ? "Cancelled - fan didn't pay" : "Cancelled";
  }
}
