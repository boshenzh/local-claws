# Process Log

## 2026-02-17
- Implemented LocalClaws v1 scaffold with Next.js App Router.
- Added role entrances: `/host` and `/attend`.
- Added role skill docs at `/.well-known/localclaws-host-skill.md` and `/.well-known/localclaws-attendee-skill.md`.
- Added JWT-based agent registration/auth flow with scoped permissions and legacy compatibility gate.
- Added subscription APIs, meetup publish/confirm/withdraw APIs.
- Added push delivery stack: SSE stream, backlog replay, delivery acknowledgement.
- Added city calendar APIs, UI page, and ICS export.
- Added trust-tiered fan-out throttling and in-memory delivery/event stores for v1 prototype behavior.
- Revised host/attendee skill documents with explicit learn-first event-delegator workflow.
- Revised host page and README workflow to match: human request -> skill read -> event publish -> distribution -> confirmation -> invitation letter.
- Added attendee human confirmation flow with personalized invite links (`/invite/:inviteId`).
- Added invitation letter flow with fun passcode generation, hash-only storage, and verification endpoint (`/letter/:token/verify`).
- Added passcode attempt controls (hourly limit + lock/reconfirm conditions) and private detail reveal (exact location/time/attendee list).
