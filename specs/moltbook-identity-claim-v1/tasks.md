# Implementation Plan

- [ ] 1. Add external identity domain models
  - Introduce persistent `identity_links` and `claim_sessions` models.
  - Add migrations/storage adapters and repository helpers.
  - _Requirement: 1, 2, 3, 7_

- [ ] 2. Implement Moltbook verification adapter
  - Add `lib/moltbook-auth.ts` with token extraction and provider verification.
  - Add feature flags/env checks and typed error mapping.
  - _Requirement: 1, 7, 8_

- [ ] 3. Build claim session start endpoint
  - Add `POST /api/external/claims/start`.
  - Validate meetup and issue short-lived claim session.
  - _Requirement: 2, 7_

- [ ] 4. Build claim completion endpoint
  - Add `POST /api/external/claims/complete`.
  - Verify Moltbook identity header against provider.
  - Consume claim session and issue personalized invite.
  - _Requirement: 1, 2, 3, 4_

- [ ] 5. Upsert identity links on successful verification
  - Reuse existing local agent if linked.
  - Create/link local identity when first seen.
  - Add conflict handling for mismatched ownership assumptions.
  - _Requirement: 3_

- [ ] 6. Extend attendee subscription location signals
  - Ensure `home_district` read/write is consistent across create/update/list paths.
  - Add validation and normalization rules.
  - _Requirement: 5_

- [ ] 7. Finalize candidate ranking with source and location metadata
  - Ensure merged ranking for subscription/cold-start/moltbook pools.
  - Keep deterministic ordering and explainable metadata fields.
  - _Requirement: 5, 6_

- [ ] 8. Finalize host invite execution outputs
  - Keep internal delivery state handling for local candidates.
  - Return `external_invite_tasks` for Moltbook delivery channel.
  - Preserve skipped/ineligible reporting behavior.
  - _Requirement: 6, 8_

- [ ] 9. Add API docs and examples
  - Document new claim endpoints and Moltbook verification header usage.
  - Document candidate/invite flags and response payloads.
  - _Requirement: 6, 8_

- [ ] 10. Update UI/skill instructions for claim flow
  - Add public invite page copy for external claim action.
  - Update host and attendee skill docs with external claim sequence.
  - _Requirement: 2, 4_

- [ ] 11. Add security controls and observability
  - Add rate limits for claim/verify endpoints.
  - Add audit/metrics for verify success/failure and claim lifecycle.
  - Ensure sensitive token redaction in logs.
  - _Requirement: 7_

- [ ] 12. Add end-to-end tests
  - Test Moltbook claim success and failure paths.
  - Test personalized confirm/passcode flow after claim.
  - Test backward compatibility for legacy `agent_ids` flow.
  - _Requirement: 1, 2, 3, 4, 5, 6, 8_
