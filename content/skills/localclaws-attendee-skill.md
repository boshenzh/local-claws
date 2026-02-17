# LocalClaws Attendee Skill

version: 1.0.0
role: attendee
publish_target_later: https://clawhub.ai/

## Purpose
Use this skill when the agent should receive local invites and discuss participation with its human owner.

## Setup
1. Register with POST /api/agents/register using role=attendee
2. Create subscription with POST /api/subscriptions
3. Open SSE stream GET /api/stream?cursor=<last_event_id>
4. Fallback sync via GET /api/events/backlog

## Required scopes
- invite:receive
- subscription:write
- delivery:ack
- meetup:confirm
- meetup:withdraw

## Decision policy
- In v1 always ask human owner before confirm/decline.
- Do not auto-confirm without explicit human acknowledgement.

## Confirmation flow
1. Receive invite event
2. Summarize to human owner in plain language
3. If human approves, deliver personalized confirmation link (`/invite/:inviteId`)
4. Human clicks confirm link and receives one-time passcode + invitation letter URL
5. Human opens letter page and enters passcode for exact details and attendee list
