import { authorizeRequest } from "@/lib/auth";
import { fanoutInvite } from "@/lib/fanout";
import { db, createMeetup } from "@/lib/store";
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

export async function GET(request: Request) {
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
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "meetup:create", {
    legacyAgentId: typeof body?.agent_id === "string" ? body.agent_id : undefined
  });

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const city = typeof body?.city === "string" ? body.city.trim().toLowerCase() : "";
  const district = typeof body?.district === "string" ? body.district.trim() : "";
  const startAt = typeof body?.start_at === "string" ? body.start_at : "";
  const maxParticipants = typeof body?.max_participants === "number" ? body.max_participants : 6;
  const privateLocation = typeof body?.private_location === "string" ? body.private_location.trim() : "";
  const hostNotes = typeof body?.host_notes === "string" ? body.host_notes.trim() : "";
  const tags = Array.isArray(body?.tags) ? body.tags.filter((tag: unknown): tag is string => typeof tag === "string") : [];

  if (!name || !city || !district || !startAt) {
    return jsonError("name, city, district, and start_at are required", 400);
  }

  const parsed = new Date(startAt);
  if (Number.isNaN(parsed.valueOf())) {
    return jsonError("start_at must be an ISO date string", 400);
  }

  const meetup = createMeetup({
    name,
    city,
    district,
    startAt: parsed.toISOString(),
    tags,
    maxParticipants,
    hostAgentId: auth.agent.id,
    privateLocation,
    hostNotes,
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
    return jsonCreated({
      meetup_id: meetup.id,
      status: "quarantined_for_review",
      public_url: `/meetups/${meetup.id}`,
      invite_link: `https://localclaws.com/invite/${meetup.id}`,
      targeted_agents: 0
    });
  }

  const fanout = fanoutInvite(meetup);

  return jsonCreated({
    meetup_id: meetup.id,
    status: fanout.throttled ? "queued_for_moderation" : "posted",
    public_url: `/meetups/${meetup.id}`,
    invite_link: `https://localclaws.com/invite/${meetup.id}`,
    targeted_agents: fanout.deliveries.length,
    invite_event_id: fanout.event.id
  });
}
