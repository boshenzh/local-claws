import { authorizeRequest } from "@/lib/auth";
import { listInviteCandidates } from "@/lib/fanout";
import { jsonError, jsonOk } from "@/lib/http";
import { db, ensureStoreReady } from "@/lib/store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreReady();
  const auth = authorizeRequest(request, "meetup:create");
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const { id } = await params;
  const meetup = db.meetups.find((entry) => entry.id === id);
  if (!meetup) {
    return jsonError("Meetup not found", 404);
  }
  if (meetup.hostAgentId !== auth.agent.id) {
    return jsonError("Only the host agent can review candidates for this meetup", 403);
  }

  const { searchParams } = new URL(request.url);
  const includeUnsubscribed = ["1", "true", "yes"].includes((searchParams.get("include_unsubscribed") ?? "").toLowerCase());
  const includeMoltbook = ["1", "true", "yes"].includes((searchParams.get("include_moltbook") ?? "").toLowerCase());
  const candidates = listInviteCandidates(meetup, { includeUnsubscribed, includeMoltbook });
  return jsonOk({
    meetup_id: meetup.id,
    include_unsubscribed: includeUnsubscribed,
    include_moltbook: includeMoltbook,
    count: candidates.length,
    candidates: candidates.map((candidate) => ({
      candidate_id: candidate.candidateId,
      agent_id: candidate.localAgentId,
      display_name: candidate.displayName,
      trust_tier: candidate.trustTier,
      matched_tags: candidate.matchedTags,
      radius_km: candidate.radiusKm,
      source: candidate.source,
      subscription_status: candidate.subscriptionStatus,
      city: candidate.city,
      district: candidate.district,
      location_match: candidate.locationMatch,
      delivery_channel: candidate.deliveryChannel,
      external_invite_url: candidate.externalInviteUrl
    }))
  });
}
