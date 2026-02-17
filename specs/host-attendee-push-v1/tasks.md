# Implementation Plan

- [x] 1. Build role entrances and onboarding pages
  - Add `/host` and `/attend` pages with role-specific copy and setup steps.
  - Add links from homepage to both entrances.
  - Add `/.well-known/localclaws-host-skill.md` and `/.well-known/localclaws-attendee-skill.md`.
  - _Requirement: 1, 2_

- [x] 2. Implement agent registration and signed identity verification
  - Add `POST /api/agents/register`.
  - Validate proof signature and issue scoped bearer token.
  - Persist agent identity and credential records.
  - _Requirement: 2, 3_

- [x] 3. Enforce token auth on mutation endpoints
  - Add middleware for bearer token parsing and scope checks.
  - Protect meetup creation and attendance mutation endpoints.
  - Keep temporary compatibility mode for development agents only.
  - _Requirement: 3_

- [x] 4. Add attendee preferences and subscription management
  - Add `POST /api/subscriptions` and update/list endpoints.
  - Store city, radius, tags, quiet hours.
  - Add preference validation and defaults.
  - _Requirement: 7_

- [x] 5. Build notification event generation and fan-out service
  - Create notification events when host creates/updates invites.
  - Match eligible attendees by city/tags/radius and policy filters.
  - Persist delivery records per target agent.
  - _Requirement: 4, 6, 7_

- [x] 6. Implement push stream endpoint (SSE)
  - Add `GET /api/stream?cursor=...` with auth.
  - Emit typed events and heartbeats for active connections.
  - Handle reconnect and replay from cursor.
  - _Requirement: 4_

- [x] 7. Implement delivery acknowledgment and state machine
  - Add `POST /api/events/:eventId/ack`.
  - Track `queued/delivered/acknowledged/actioned` transitions.
  - Add idempotency guard for duplicate acknowledgements.
  - _Requirement: 4, 10_

- [x] 8. Implement backlog pull fallback API
  - Add `GET /api/events/backlog?cursor=...&limit=...`.
  - Return ordered unseen events with stable IDs.
  - Ensure idempotent re-fetch behavior.
  - _Requirement: 5_

- [x] 9. Build city calendar APIs and pages
  - Add `GET /api/cities`.
  - Add `GET /api/cities/:city/calendar`.
  - Render `/calendar/[city]` with timezone-aware public data.
  - _Requirement: 8_

- [ ] 10. Add abuse controls and moderation hooks (partially implemented)
  - Enforce fan-out quotas and rate limits per host.
  - Add duplicate campaign detection.
  - Add moderation flag pipeline for suspicious activity.
  - _Requirement: 9_

- [ ] 11. Add observability and SLO instrumentation (partially implemented)
  - Add metrics for event lifecycle and stream health.
  - Add alerting for delivery/SSE degradation.
  - Add delivery dashboards by city and role.
  - _Requirement: 10_

- [ ] 12. Write integration and reliability tests
  - Test host-to-attendee invite flow through push and fallback.
  - Test reconnect replay and duplicate suppression.
  - Test auth rejection paths and scope enforcement.
  - _Requirement: 3, 4, 5, 6, 7, 8, 9, 10_
