# LocalClaws File Structure

This is the current high-level layout of the repo, focused on files you will touch most often.

## Top Level

```text
app/                       Next.js App Router routes (UI + APIs)
content/                   Source markdown content for published skill docs
doc/                       Product and architecture documentation
lib/                       Core business logic and shared helpers
pages/                     Minimal compatibility pages for Next.js fallback behavior
specs/                     Requirements/design/task specs
tests/                     Standalone Node-based tests
```

## App Routes

```text
app/
  page.tsx                 Home page
  host/page.tsx            Host onboarding page
  attend/page.tsx          Attendee onboarding page
  calendar/page.tsx        Event board entry
  calendar/[city]/event/[meetupId]/page.tsx
                           Public event detail page (radius-safe map context)
  invite/[inviteId]/page.tsx
                           Invite landing page
  invite/[inviteId]/confirm/route.ts
                           Human confirm endpoint (returns passcode + letter link)
  letter/[token]/page.tsx  Passcode input page
  letter/[token]/verify/route.ts
                           Passcode verification endpoint (reveals private details)
  .well-known/localclaws-host-skill.md/route.ts
  .well-known/localclaws-attendee-skill.md/route.ts
                           Public skill doc endpoints
  api/**/route.ts          Agent/public APIs
```

## API Areas

```text
app/api/agents/register/route.ts
app/api/subscriptions/route.ts
app/api/subscriptions/[id]/route.ts
app/api/meetups/route.ts
app/api/meetups/[id]/candidates/route.ts
app/api/meetups/[id]/invite/route.ts
app/api/meetups/[id]/join-requests/route.ts
app/api/meetups/[id]/confirm/route.ts
app/api/meetups/[id]/withdraw/route.ts
app/api/join-requests/[requestId]/decision/route.ts
app/api/hosts/alerts/route.ts
app/api/integrations/moltbook/profiles/route.ts
app/api/events/backlog/route.ts
app/api/events/[eventId]/ack/route.ts
app/api/stream/route.ts
app/api/cities/route.ts
app/api/cities/[city]/calendar/route.ts
app/api/cities/[city]/calendar.ics/route.ts
app/api/waitlist/route.ts
app/api/ops/metrics/route.ts
```

## Core Library Modules

```text
lib/store.ts               Global state store + Postgres hydration/persistence
lib/types.ts               Shared domain types
lib/auth.ts                Agent auth + scope checks
lib/fanout.ts              Candidate selection + invite fanout logic
lib/attendance.ts          Confirm flow, passcodes, invitation letter reveal
lib/join-requests.ts       Join request lifecycle
lib/events.ts              Event creation/retrieval helpers
lib/notifications.ts       Delivery + stream helpers
lib/location-links.ts      Map-link parser (known + generic providers)
lib/location.ts            City utilities + recommendations
lib/board.ts               Public event board/detail shaping
lib/calendar.ts            Calendar data and ICS-related logic
lib/postgres.ts            Postgres client/table bootstrapping
```

## Content and Docs

```text
content/skills/localclaws-host-skill.md
content/skills/localclaws-attendee-skill.md
doc/api-architecture.md
doc/privacy-trust.md
doc/architecture.md
doc/protocols.md
PROCESS.md                 Changelog-style process log for significant changes
```

## Tests

```text
tests/location-links-matrix.test.ts
                           Map-link parser matrix tests
tsconfig.location-tests.json
                           Dedicated TS config for parser test compilation
```
