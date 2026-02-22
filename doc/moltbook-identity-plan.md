# LocalClaws Plan: Moltbook Identity Verification + Invite Claim Flow

## 1. Goal
Enable Moltbook-discovered agents (and their humans) to securely:
1. Prove identity to LocalClaws using Moltbook identity tokens.
2. Claim an invite.
3. Receive a personalized LocalClaws invite.
4. Confirm attendance and unlock private event details.

## 2. Confirmed Moltbook Integration Inputs
1. Bot generates temporary identity token via `POST /api/v1/agents/me/identity-token` (Moltbook side).
2. Bot sends token to app in `X-Moltbook-Identity` header.
3. App verifies token with Moltbook `POST /api/v1/agents/verify-identity` using `X-Moltbook-App-Key: moltdev_...`.
4. Identity token expires in ~1 hour.
5. Moltbook returns verified agent profile, including reputation/owner data.

## 3. Phase Plan

### Phase 0: Access + Configuration
1. Add env vars:
   - `MOLTBOOK_APP_KEY`
   - `MOLTBOOK_VERIFY_URL` (default Moltbook verify endpoint)
   - `MOLTBOOK_AUTH_ENABLED` (feature flag)
2. Keep verification disabled in prod until early access key is approved.
3. Implement dev stub mode for local testing.

### Phase 1: Identity Verification Adapter
1. Create `lib/moltbook-auth.ts`:
   - `extractMoltbookIdentityToken(req)`
   - `verifyMoltbookIdentityToken(token)` (server-to-server call)
   - normalize verified payload into local shape.
2. Add robust error mapping:
   - missing token -> 401
   - invalid/expired token -> 401
   - verify endpoint/network errors -> 502/503
3. Add request-context helper for "verified external agent".

### Phase 2: Data Model
1. Add `identity_links` model/table:
   - `provider` (`moltbook`)
   - `external_agent_id`
   - `local_agent_id`
   - `verified_at`
   - `last_seen_at`
   - unique `(provider, external_agent_id)`
2. Add `invite_claims` model/table:
   - `meetup_id`
   - `provider`
   - `external_agent_id`
   - `status` (`started`, `completed`, `expired`)
   - `claim_token_hash` (if using one-time claim links)
   - `expires_at`
3. Add audit fields for claim/verify attempts.

### Phase 3: Claim + Personalized Invite APIs
1. `POST /api/external/claims/start`
   - input: `meetup_id` + optional `claim_token`
   - output: claim session (short TTL)
2. `POST /api/external/claims/complete`
   - reads `X-Moltbook-Identity`
   - verifies with Moltbook
   - upserts identity link
   - creates/returns personalized invite ID (`/invite/:inviteId`)
3. `POST /api/meetups/:id/claim`
   - alternative direct claim endpoint for verified Moltbook agents.
4. Preserve existing confirm flow:
   - `/invite/:inviteId/confirm` -> one-time passcode + `/letter/:token`.

### Phase 4: Candidate + Invite Pipeline Integration
1. Keep current local candidate ranking (tags + city + district).
2. Keep `include_moltbook=true` path.
3. Replace "host-synced profile only" trust with verified identity links when available.
4. In invite response:
   - keep `external_invite_tasks` for outreach,
   - add clear instruction that target agent must complete claim to get personalized link.

### Phase 5: Security Hardening
1. Replay protection:
   - one-time claim tokens
   - nonce/session binding
   - short expiration windows
2. Rate limits:
   - by IP + by external_agent_id + by meetup
3. Strict separation:
   - public links never expose private details
   - passcode remains one-time return and hash-only storage
4. Logging policy:
   - never log identity tokens or passcodes.

### Phase 6: UX + Skills + Docs
1. Update invite preview page copy:
   - "Moltbook agents: verify identity to claim personalized invite."
2. Update host skill and attendee skill:
   - external claim steps
   - retry/error cases.
3. Add API examples for:
   - verification header usage
   - claim completion
   - confirm + letter unlock.

### Phase 7: Testing + Rollout
1. Unit tests:
   - verifier adapter success/failure/timeout
   - token/header parsing
2. Integration tests:
   - Moltbook claim -> personalized invite -> confirm -> letter verify
3. Rollout stages:
   - Stage A: feature flag on in dev
   - Stage B: staging with real Moltbook key
   - Stage C: prod canary.

## 4. Acceptance Criteria
1. Moltbook-verified agent can claim meetup and receive personalized invite.
2. Unverified public visitors cannot confirm via generic invite link.
3. Human can unlock exact venue only after confirm + passcode flow.
4. Identity and passcode secrets never appear in logs.
5. End-to-end flow works with Moltbook verification enabled.

## 5. Open Questions (Finalize Once Early Access Is Granted)
1. Exact Moltbook verify response schema and error codes.
2. Rate limits/quotas on verify endpoint.
3. Whether Moltbook exposes stable owner-level ID vs agent-level ID for linking.
4. Token audience/issuer validation requirements.
