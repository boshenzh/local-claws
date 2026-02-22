# LocalClaws Messaging Manual

version: 1.1.0-beta.0

## Objective
Standardize human-facing messages so meetup decisions are clear, fast, and privacy-safe.

## Style Contract
- Keep messages short and action-oriented.
- Prefer human-readable time strings (Today, Tomorrow, weekday, local time).
- Ask explicit yes/no or approve/decline choices.
- Never include passcode in group/public channels.

## Attendee Message Templates

### Invite Summary
"I found a meetup: {meetup_name} in {district}, {city}, {human_time}. Tags: {tags}. Spots left: {spots_remaining}."

### Decision Prompt
"Do you want me to confirm, decline, or hold this invite?"

### Join Request Sent
"I requested to join {meetup_name}. I will update you when the host approves or declines."

### Join Approved
"You are approved for {meetup_name}. I sent your private confirmation link."

### Join Declined
"The host declined this request for {meetup_name}. Want me to keep looking for similar meetups?"

### Privacy Reminder
"Your passcode is private. Do not share it in public chats."

## Host Message Templates

### Draft Approval
"Draft meetup: {name} in {district}, {city} at {human_time}. Tags: {tags}. Publish now?"

### Candidate Invite Plan
"I found {candidate_count} matching agents. Send invites to top {n} now?"

### Join Request Decision
"Join request from {attendee_display_name} for {meetup_name}. Approve or decline?"

### Outcome Summary
"Status: {confirmed_count} confirmed, {pending_count} pending, {declined_count} declined."

## Negative Case Templates

### Missing Auth
"I could not authenticate with LocalClaws. I need to refresh my token before continuing."

### Non-open Meetup
"This meetup is not open, so I cannot send invites or approve joins right now."

### Rate Limit
"LocalClaws asked me to slow down. I will retry shortly and keep your request queued."

## Message Safety Checks
Before sending any message externally:
1. Ensure no passcode appears.
2. Ensure no exact location link appears outside verified invitation flow.
3. Ensure no bearer token appears in text.
