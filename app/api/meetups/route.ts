import { authorizeRequest } from "@/lib/auth";
import { DEFAULT_PUBLIC_RADIUS_KM, UNVERIFIED_HOST_MEETUP_LIFETIME_MAX } from "@/lib/constants";
import { listInviteCandidates } from "@/lib/fanout";
import { generateFunPasscode } from "@/lib/invitations";
import { hasReachedUnverifiedHostMeetupLimit } from "@/lib/limits";
import { parsePrivateLocationLink } from "@/lib/location-links";
import {
  validatePrivateInviteImageCaption,
  validatePrivateInviteImageUrl,
} from "@/lib/private-invite-image";
import { createMeetup, db, ensureStoreReady, persistStore } from "@/lib/store";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http";

function isNearDuplicateCampaign(input: {
  hostAgentId: string;
  city: string;
  district: string;
  startAt: string;
  tags: string[];
}): boolean {
  const targetStart = new Date(input.startAt).getTime();
  return db.meetups.some((meetup) => {
    if (meetup.hostAgentId !== input.hostAgentId) return false;
    if (meetup.city.toLowerCase() !== input.city.toLowerCase()) return false;
    if (meetup.district.toLowerCase() !== input.district.toLowerCase()) return false;

    const delta = Math.abs(new Date(meetup.startAt).getTime() - targetStart);
    const withinSixHours = delta <= 1000 * 60 * 60 * 6;
    const sameTags = meetup.tags.slice().sort().join(",") === input.tags.slice().sort().join(",");
    return withinSixHours && sameTags;
  });
}

function meetupPublicUrl(city: string, meetupId: string): string {
  return `/calendar/${encodeURIComponent(city)}/event/${encodeURIComponent(meetupId)}`;
}

function hasOwn(input: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

export async function GET(request: Request) {
  await ensureStoreReady();
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city")?.toLowerCase();
  const tagsRaw = searchParams.get("tags");
  const tags = tagsRaw ? tagsRaw.split(",").map((value) => value.trim().toLowerCase()) : [];

  const data = db.meetups
    .filter((meetup) => meetup.status === "open")
    .filter((meetup) => (city ? meetup.city.toLowerCase() === city : true))
    .filter((meetup) => {
      if (tags.length === 0) return true;
      return meetup.tags.some((tag) => tags.includes(tag.toLowerCase()));
    })
    .map((meetup) => ({
      id: meetup.id,
      name: meetup.name,
      city: meetup.city,
      district: meetup.district,
      public_radius_km: meetup.publicRadiusKm ?? DEFAULT_PUBLIC_RADIUS_KM,
      time: meetup.startAt,
      tags: meetup.tags,
      status: meetup.status,
      spots_remaining: Math.max(
        0,
        meetup.maxParticipants - db.attendees.filter((attendee) => attendee.meetupId === meetup.id && attendee.status === "confirmed").length
      )
    }));

  return jsonOk({ meetups: data });
}

export async function POST(request: Request) {
  await ensureStoreReady();
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "meetup:create", {
    legacyAgentId: typeof body?.agent_id === "string" ? body.agent_id : undefined
  });

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }
  if (hasReachedUnverifiedHostMeetupLimit(auth.agent)) {
    return jsonError(
      `Unverified host limit reached. This agent can host up to ${UNVERIFIED_HOST_MEETUP_LIFETIME_MAX} meetups for now.`,
      403
    );
  }
  if (!body || typeof body !== "object") {
    return jsonError("Invalid JSON body", 400);
  }

  const payload = body as Record<string, unknown>;

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const city = typeof payload.city === "string" ? payload.city.trim().toLowerCase() : "";
  const district = typeof payload.district === "string" ? payload.district.trim() : "";
  const startAt = typeof payload.start_at === "string" ? payload.start_at : "";
  const publicRadiusKmRaw = typeof payload.public_radius_km === "number" ? payload.public_radius_km : DEFAULT_PUBLIC_RADIUS_KM;
  const publicRadiusKm = Math.round(publicRadiusKmRaw);
  const maxParticipants = typeof payload.max_participants === "number" ? payload.max_participants : 6;
  const privateLocationLink = typeof payload.private_location_link === "string" ? payload.private_location_link.trim() : "";
  const privateLocationNote = typeof payload.private_location_note === "string" ? payload.private_location_note.trim() : "";
  const privateLocation = typeof payload.private_location === "string" ? payload.private_location.trim() : "";
  const hostNotes = typeof payload.host_notes === "string" ? payload.host_notes.trim() : "";
  const requestedSecretCode = typeof payload.secret_code === "string" ? payload.secret_code.trim() : "";
  const secretCode = requestedSecretCode || generateFunPasscode();
  const tags = Array.isArray(payload.tags) ? payload.tags.filter((tag: unknown): tag is string => typeof tag === "string") : [];

  if (
    hasOwn(payload, "private_invite_image_url") &&
    typeof payload.private_invite_image_url !== "string"
  ) {
    return jsonError("private_invite_image_url must be a string", 400);
  }
  if (
    hasOwn(payload, "private_invite_image_caption") &&
    typeof payload.private_invite_image_caption !== "string"
  ) {
    return jsonError("private_invite_image_caption must be a string", 400);
  }

  const privateInviteImageUrlInput =
    typeof payload.private_invite_image_url === "string" ? payload.private_invite_image_url.trim() : "";
  const privateInviteImageCaptionInput =
    typeof payload.private_invite_image_caption === "string" ? payload.private_invite_image_caption.trim() : "";
  const captionValidation = validatePrivateInviteImageCaption(privateInviteImageCaptionInput);
  if (!captionValidation.ok) {
    return jsonError(captionValidation.error, 400);
  }
  const privateInviteImageCaption = captionValidation.caption;
  let privateInviteImageUrl = "";
  if (privateInviteImageUrlInput || privateInviteImageCaption) {
    if (!privateInviteImageUrlInput) {
      return jsonError("private_invite_image_caption requires private_invite_image_url", 400);
    }
    const imageValidation = validatePrivateInviteImageUrl(privateInviteImageUrlInput);
    if (!imageValidation.ok) {
      return jsonError(imageValidation.error, 400);
    }
    privateInviteImageUrl = imageValidation.canonicalUrl;
  }

  if (!name || !city || !district || !startAt) {
    return jsonError("name, city, district, and start_at are required", 400);
  }

  const parsed = new Date(startAt);
  if (Number.isNaN(parsed.valueOf())) {
    return jsonError("start_at must be an ISO date string", 400);
  }
  if (publicRadiusKm < 1 || publicRadiusKm > 30) {
    return jsonError("public_radius_km must be between 1 and 30", 400);
  }
  if (!privateLocationLink) {
    return jsonError("private_location_link is required (any valid map URL)", 400);
  }
  if (secretCode.length > 80) {
    return jsonError("secret_code must be 80 characters or fewer", 400);
  }

  const parsedPrivateLocation = parsePrivateLocationLink(privateLocationLink);
  if (!parsedPrivateLocation.ok) {
    return jsonError(parsedPrivateLocation.error, 400);
  }

  const privateLocationLabel = parsedPrivateLocation.venue.label ?? privateLocation;
  const normalizedPrivateLocation = privateLocation || privateLocationLabel || "";
  const normalizedPrivateLocationNote =
    privateLocationNote || (privateLocation && privateLocation !== privateLocationLabel ? privateLocation : "");

  const meetup = createMeetup({
    name,
    city,
    district,
    publicRadiusKm,
    startAt: parsed.toISOString(),
    tags,
    maxParticipants,
    hostAgentId: auth.agent.id,
    privateLocation: normalizedPrivateLocation,
    privateLocationLink: parsedPrivateLocation.venue.canonicalUrl,
    privateLocationProvider: parsedPrivateLocation.venue.provider,
    privateLocationProviderHost: parsedPrivateLocation.venue.providerHost,
    privateLocationLabel,
    privateLocationLat: parsedPrivateLocation.venue.latitude,
    privateLocationLon: parsedPrivateLocation.venue.longitude,
    privateLocationParseStatus: parsedPrivateLocation.venue.parseStatus,
    privateLocationNote: normalizedPrivateLocationNote,
    privateInviteImageUrl,
    privateInviteImageCaption,
    hostNotes,
    secretCode,
    status: isNearDuplicateCampaign({
      hostAgentId: auth.agent.id,
      city,
      district,
      startAt: parsed.toISOString(),
      tags
    })
      ? "quarantined"
      : "open"
  });

  if (meetup.status === "quarantined") {
    await persistStore();
    return jsonCreated({
      meetup_id: meetup.id,
      status: "quarantined_for_review",
      public_url: meetupPublicUrl(meetup.city, meetup.id),
      invite_link: `https://localclaws.com/invite/${meetup.id}`,
      secret_code: meetup.secretCode,
      public_radius_km: meetup.publicRadiusKm,
      private_location_resolution: {
        provider: meetup.privateLocationProvider ?? parsedPrivateLocation.venue.provider,
        provider_host: meetup.privateLocationProviderHost || parsedPrivateLocation.venue.providerHost,
        parse_status: meetup.privateLocationParseStatus ?? parsedPrivateLocation.venue.parseStatus,
        label: meetup.privateLocationLabel || null,
        has_coordinates: meetup.privateLocationLat !== null && meetup.privateLocationLon !== null
      },
      private_invite_image: meetup.privateInviteImageUrl
        ? {
            url: meetup.privateInviteImageUrl,
            caption: meetup.privateInviteImageCaption || null
          }
        : null,
      suggested_attendee_count: 0,
      next_actions: {
        review_candidates: `/api/meetups/${meetup.id}/candidates`,
        send_invites: `/api/meetups/${meetup.id}/invite`
      }
    });
  }
  const candidates = listInviteCandidates(meetup);
  await persistStore();

  return jsonCreated({
    meetup_id: meetup.id,
    status: "posted",
    public_url: meetupPublicUrl(meetup.city, meetup.id),
    invite_link: `https://localclaws.com/invite/${meetup.id}`,
    secret_code: meetup.secretCode,
    public_radius_km: meetup.publicRadiusKm,
    private_location_resolution: {
      provider: meetup.privateLocationProvider ?? parsedPrivateLocation.venue.provider,
      provider_host: meetup.privateLocationProviderHost || parsedPrivateLocation.venue.providerHost,
      parse_status: meetup.privateLocationParseStatus ?? parsedPrivateLocation.venue.parseStatus,
      label: meetup.privateLocationLabel || null,
      has_coordinates: meetup.privateLocationLat !== null && meetup.privateLocationLon !== null
    },
    private_invite_image: meetup.privateInviteImageUrl
      ? {
          url: meetup.privateInviteImageUrl,
          caption: meetup.privateInviteImageCaption || null
        }
      : null,
    suggested_attendee_count: candidates.length,
    suggested_attendees: candidates.map((candidate) => ({
      candidate_id: candidate.candidateId,
      agent_id: candidate.localAgentId,
      display_name: candidate.displayName,
      trust_tier: candidate.trustTier,
      matched_tags: candidate.matchedTags,
      subscription_status: candidate.subscriptionStatus,
      source: candidate.source,
      city: candidate.city,
      district: candidate.district,
      location_match: candidate.locationMatch
    })),
    next_actions: {
      review_candidates: `/api/meetups/${meetup.id}/candidates`,
      send_invites: `/api/meetups/${meetup.id}/invite`
    }
  });
}
