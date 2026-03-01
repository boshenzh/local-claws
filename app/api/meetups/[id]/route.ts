import { authorizeRequest } from "@/lib/auth";
import { deliverInviteEventToAgents } from "@/lib/fanout";
import { jsonError, jsonOk } from "@/lib/http";
import { parsePrivateLocationLink } from "@/lib/location-links";
import {
  validatePrivateInviteImageCaption,
  validatePrivateInviteImageUrl,
} from "@/lib/private-invite-image";
import { db, ensureStoreReady, persistStore } from "@/lib/store";

function hasOwn(input: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function collectAffectedAgentIds(
  meetupId: string,
  hostAgentId: string,
  options?: { includePendingJoinRequests?: boolean }
): string[] {
  const inviteEventIds = new Set(
    db.notificationEvents
      .filter(
        (event) =>
          event.meetupId === meetupId &&
          (event.eventType === "invite.created" || event.eventType === "invite.updated")
      )
      .map((event) => event.id)
  );

  const agentIds = new Set<string>();
  for (const delivery of db.notificationDeliveries) {
    if (!inviteEventIds.has(delivery.eventId)) continue;
    agentIds.add(delivery.agentId);
  }

  for (const attendee of db.attendees) {
    if (attendee.meetupId !== meetupId || attendee.status !== "confirmed") continue;
    agentIds.add(attendee.agentId);
  }

  if (options?.includePendingJoinRequests) {
    for (const joinRequest of db.joinRequests) {
      if (joinRequest.meetupId !== meetupId || joinRequest.status !== "pending") continue;
      agentIds.add(joinRequest.attendeeAgentId);
    }
  }

  agentIds.delete(hostAgentId);
  return Array.from(agentIds);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreReady();
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "meetup:create", {
    legacyAgentId:
      typeof body === "object" &&
      body !== null &&
      typeof (body as { agent_id?: unknown }).agent_id === "string"
        ? (body as { agent_id: string }).agent_id
        : undefined
  });
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }
  if (!body || typeof body !== "object") {
    return jsonError("Invalid JSON body", 400);
  }

  const payload = body as Record<string, unknown>;
  const { id } = await params;
  const meetup = db.meetups.find((entry) => entry.id === id);
  if (!meetup) {
    return jsonError("Meetup not found", 404);
  }
  if (meetup.hostAgentId !== auth.agent.id) {
    return jsonError("Only the host agent can edit this meetup", 403);
  }
  if (meetup.status !== "open") {
    return jsonError(`Meetup can only be edited when status is open (current: ${meetup.status})`, 409);
  }

  const updates: Record<string, unknown> = {};
  const updatedFields: string[] = [];
  const pushUpdatedField = (field: string) => {
    if (!updatedFields.includes(field)) {
      updatedFields.push(field);
    }
  };

  if (hasOwn(payload, "name")) {
    if (typeof payload.name !== "string" || !payload.name.trim()) {
      return jsonError("name must be a non-empty string", 400);
    }
    updates.name = payload.name.trim();
    pushUpdatedField("name");
  }

  if (hasOwn(payload, "city")) {
    if (typeof payload.city !== "string" || !payload.city.trim()) {
      return jsonError("city must be a non-empty string", 400);
    }
    updates.city = payload.city.trim().toLowerCase();
    pushUpdatedField("city");
  }

  if (hasOwn(payload, "district")) {
    if (typeof payload.district !== "string" || !payload.district.trim()) {
      return jsonError("district must be a non-empty string", 400);
    }
    updates.district = payload.district.trim();
    pushUpdatedField("district");
  }

  if (hasOwn(payload, "start_at")) {
    if (typeof payload.start_at !== "string" || !payload.start_at.trim()) {
      return jsonError("start_at must be an ISO date string", 400);
    }
    const parsed = new Date(payload.start_at);
    if (Number.isNaN(parsed.valueOf())) {
      return jsonError("start_at must be an ISO date string", 400);
    }
    updates.startAt = parsed.toISOString();
    pushUpdatedField("start_at");
  }

  if (hasOwn(payload, "tags")) {
    if (!Array.isArray(payload.tags) || payload.tags.some((value) => typeof value !== "string")) {
      return jsonError("tags must be an array of strings", 400);
    }
    const tags = Array.from(
      new Set(payload.tags.map((value) => value.trim()).filter((value) => Boolean(value)))
    );
    updates.tags = tags;
    pushUpdatedField("tags");
  }

  if (hasOwn(payload, "max_participants")) {
    if (
      typeof payload.max_participants !== "number" ||
      !Number.isInteger(payload.max_participants) ||
      payload.max_participants < 1 ||
      payload.max_participants > 100
    ) {
      return jsonError("max_participants must be an integer between 1 and 100", 400);
    }
    const confirmedCount = db.attendees.filter(
      (entry) => entry.meetupId === meetup.id && entry.status === "confirmed"
    ).length;
    if (payload.max_participants < confirmedCount) {
      return jsonError(`max_participants cannot be lower than confirmed attendees (${confirmedCount})`, 409);
    }
    updates.maxParticipants = payload.max_participants;
    pushUpdatedField("max_participants");
  }

  if (hasOwn(payload, "public_radius_km")) {
    if (typeof payload.public_radius_km !== "number" || Number.isNaN(payload.public_radius_km)) {
      return jsonError("public_radius_km must be a number between 1 and 30", 400);
    }
    const rounded = Math.round(payload.public_radius_km);
    if (rounded < 1 || rounded > 30) {
      return jsonError("public_radius_km must be between 1 and 30", 400);
    }
    updates.publicRadiusKm = rounded;
    pushUpdatedField("public_radius_km");
  }

  if (hasOwn(payload, "private_location_link")) {
    if (typeof payload.private_location_link !== "string" || !payload.private_location_link.trim()) {
      return jsonError("private_location_link must be a valid map URL", 400);
    }
    const parsedLocation = parsePrivateLocationLink(payload.private_location_link);
    if (!parsedLocation.ok) {
      return jsonError(parsedLocation.error, 400);
    }

    const nextLabel = parsedLocation.venue.label ?? meetup.privateLocationLabel ?? meetup.privateLocation;
    updates.privateLocationLink = parsedLocation.venue.canonicalUrl;
    updates.privateLocationProvider = parsedLocation.venue.provider;
    updates.privateLocationProviderHost = parsedLocation.venue.providerHost;
    updates.privateLocationLabel = nextLabel ?? "";
    updates.privateLocation = nextLabel ?? meetup.privateLocation;
    updates.privateLocationLat = parsedLocation.venue.latitude;
    updates.privateLocationLon = parsedLocation.venue.longitude;
    updates.privateLocationParseStatus = parsedLocation.venue.parseStatus;
    pushUpdatedField("private_location_link");
  }

  if (hasOwn(payload, "private_location_note")) {
    if (typeof payload.private_location_note !== "string") {
      return jsonError("private_location_note must be a string", 400);
    }
    updates.privateLocationNote = payload.private_location_note.trim();
    pushUpdatedField("private_location_note");
  }

  if (hasOwn(payload, "host_notes")) {
    if (typeof payload.host_notes !== "string") {
      return jsonError("host_notes must be a string", 400);
    }
    updates.hostNotes = payload.host_notes.trim();
    pushUpdatedField("host_notes");
  }

  const hasPrivateInviteImageUrl = hasOwn(payload, "private_invite_image_url");
  const hasPrivateInviteImageCaption = hasOwn(payload, "private_invite_image_caption");
  if (hasPrivateInviteImageUrl || hasPrivateInviteImageCaption) {
    let nextUrl = (meetup.privateInviteImageUrl ?? "").trim();
    let nextCaption = (meetup.privateInviteImageCaption ?? "").trim();

    if (hasPrivateInviteImageUrl) {
      if (payload.private_invite_image_url === null) {
        nextUrl = "";
        nextCaption = "";
      } else if (typeof payload.private_invite_image_url !== "string") {
        return jsonError("private_invite_image_url must be a string or null", 400);
      } else {
        const normalized = payload.private_invite_image_url.trim();
        if (!normalized) {
          nextUrl = "";
          nextCaption = "";
        } else {
          const imageValidation = validatePrivateInviteImageUrl(normalized);
          if (!imageValidation.ok) {
            return jsonError(imageValidation.error, 400);
          }
          nextUrl = imageValidation.canonicalUrl;
        }
      }
      pushUpdatedField("private_invite_image_url");
      pushUpdatedField("private_invite_image_caption");
    }

    if (hasPrivateInviteImageCaption) {
      if (payload.private_invite_image_caption === null) {
        nextCaption = "";
      } else if (typeof payload.private_invite_image_caption !== "string") {
        return jsonError("private_invite_image_caption must be a string or null", 400);
      } else {
        const captionValidation = validatePrivateInviteImageCaption(payload.private_invite_image_caption);
        if (!captionValidation.ok) {
          return jsonError(captionValidation.error, 400);
        }
        nextCaption = captionValidation.caption;
      }
      pushUpdatedField("private_invite_image_caption");
    } else {
      const captionValidation = validatePrivateInviteImageCaption(nextCaption);
      if (!captionValidation.ok) {
        return jsonError(captionValidation.error, 400);
      }
      nextCaption = captionValidation.caption;
    }

    if (!nextUrl && nextCaption) {
      return jsonError("private_invite_image_caption requires private_invite_image_url", 400);
    }

    updates.privateInviteImageUrl = nextUrl;
    updates.privateInviteImageCaption = nextCaption;
  }

  if (hasOwn(payload, "secret_code")) {
    if (typeof payload.secret_code !== "string" || !payload.secret_code.trim()) {
      return jsonError("secret_code must be a non-empty string", 400);
    }
    const secretCode = payload.secret_code.trim();
    if (secretCode.length > 80) {
      return jsonError("secret_code must be 80 characters or fewer", 400);
    }
    updates.secretCode = secretCode;
    pushUpdatedField("secret_code");
  }

  if (updatedFields.length === 0) {
    return jsonError(
      "Provide at least one editable field: name, city, district, start_at, tags, max_participants, public_radius_km, private_location_link, private_location_note, private_invite_image_url, private_invite_image_caption, host_notes, secret_code",
      400
    );
  }

  Object.assign(meetup, updates);
  const affectedAgentIds = collectAffectedAgentIds(meetup.id, meetup.hostAgentId);
  const inviteUpdate = deliverInviteEventToAgents(meetup, "invite.updated", affectedAgentIds);
  await persistStore();

  return jsonOk({
    status: "updated",
    meetup_id: meetup.id,
    updated_fields: updatedFields,
    invite_update_event_id: inviteUpdate.event?.id ?? null,
    invite_update_delivery_count: inviteUpdate.deliveries.length,
    private_location_resolution: {
      provider: meetup.privateLocationProvider ?? null,
      provider_host: meetup.privateLocationProviderHost || "",
      parse_status: meetup.privateLocationParseStatus ?? "unresolved",
      label: meetup.privateLocationLabel || null,
      has_coordinates: meetup.privateLocationLat !== null && meetup.privateLocationLon !== null
    },
    private_invite_image: meetup.privateInviteImageUrl
      ? {
          url: meetup.privateInviteImageUrl,
          caption: meetup.privateInviteImageCaption || null
        }
      : null,
    secret_code: meetup.secretCode || null
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreReady();
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "meetup:create", {
    legacyAgentId:
      typeof body === "object" &&
      body !== null &&
      typeof (body as { agent_id?: unknown }).agent_id === "string"
        ? (body as { agent_id: string }).agent_id
        : undefined
  });
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const { id } = await params;
  const meetup = db.meetups.find((entry) => entry.id === id);
  if (!meetup) {
    return jsonError("Meetup not found", 404);
  }
  if (meetup.hostAgentId !== auth.agent.id) {
    return jsonError("Only the host agent can delete this meetup", 403);
  }
  if (meetup.status === "canceled") {
    return jsonOk({ status: "already_canceled", meetup_id: meetup.id });
  }

  const affectedAgentIds = collectAffectedAgentIds(meetup.id, meetup.hostAgentId, {
    includePendingJoinRequests: true
  });
  meetup.status = "canceled";

  const decidedAt = new Date().toISOString();
  let canceledJoinRequests = 0;
  for (const joinRequest of db.joinRequests) {
    if (joinRequest.meetupId !== meetup.id || joinRequest.status !== "pending") continue;
    joinRequest.status = "canceled";
    joinRequest.decidedAt = decidedAt;
    joinRequest.decidedByAgentId = auth.agent.id;
    joinRequest.decisionReason = "meetup_canceled_by_host";
    canceledJoinRequests += 1;
  }

  let invalidatedInvitationCount = 0;
  for (const attendee of db.attendees) {
    if (attendee.meetupId !== meetup.id) continue;
    const hadCredentials = Boolean(attendee.invitationToken || attendee.passcodeHash);
    attendee.invitationToken = null;
    attendee.passcodeHash = null;
    attendee.passcodeIssuedAt = null;
    attendee.failedAttempts = 0;
    attendee.failedWindowStart = null;
    attendee.totalFailures = 0;
    attendee.lockedUntil = null;
    if (attendee.status === "confirmed") {
      attendee.status = "withdrawn";
    }
    if (hadCredentials) {
      invalidatedInvitationCount += 1;
    }
  }

  const inviteWithdraw = deliverInviteEventToAgents(meetup, "invite.withdrawn", affectedAgentIds);
  await persistStore();

  return jsonOk({
    status: "canceled",
    meetup_id: meetup.id,
    canceled_join_request_count: canceledJoinRequests,
    invalidated_invitation_count: invalidatedInvitationCount,
    invite_withdraw_event_id: inviteWithdraw.event?.id ?? null,
    invite_withdraw_delivery_count: inviteWithdraw.deliveries.length
  });
}
