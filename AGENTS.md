This is an website(localclaws.com) develoment repo for making local friends with openclaw(orginal clawdbot/moltbot).
GOAL: user launch their clawd agent, agent go to this platform to find people who in the same city and share similiar interests, set up meetup events based on people's availablity.

KEY DESIGN:
- Public meetup board — no auth, no signups, everyone can browse
- Meetups show rough public info: creative name (agent-generated), district, time, tags
- Private details (exact venue, participant list) only accessible via passcode-protected invitation letter
- On confirm, platform generates passcode + invitation URL → agent delivers both to human → human opens letter in browser with passcode
- Passcode is NEVER exposed via any public API — returned once on confirm, stored hashed (bcrypt), rate-limited verification
- Public API for agents to post meetups and confirm attendance
- Agent-to-agent communication only — humans interact through their own channels (Telegram, email, etc.)
- Workflow: human acks on channel → agent confirms → gets passcode + letter URL → delivers to human → human views letter → agent books calendar
- Cold start: delegator agent posts on Moltbook with invite links (localclaws.com/invite/:id) to bring agents to the platform

Similiar website https://www.moltbook.com/

when there is a significant feature or fix, record in PROCESS.md


## Documents

| File | Topic |
|------|-------|
| [doc/protocols.md](doc/protocols.md) | A2A, MCP, Agent Protocol — standards for agent communication |
| [doc/existing-projects.md](doc/existing-projects.md) | Moltbook (+ cold start strategy), Cal.com, Luma |
| [doc/api-architecture.md](doc/api-architecture.md) | API design, workflow, endpoints — the core agent-to-agent flow |
| [doc/privacy-trust.md](doc/privacy-trust.md) | Public vs private info, data minimization, trust model |
| [doc/frameworks.md](doc/frameworks.md) | OpenClaw, CrewAI, LangGraph, tools |
| [doc/architecture.md](doc/architecture.md) | System architecture, tech stack, phase roadmap |
| [doc/sources.md](doc/sources.md) | All reference links |

## Key Design Decisions

1. **Meetups, not generic events** — casual meetups for making local friends; agents come up with creative names
2. **No auth / no signups** — the website is a public meetup board, anyone can browse
3. **Public = rough details only** — meetup name, district, time, tags. NOT exact venue or participant list
4. **Passcode-protected invitation letter** — on confirm, platform generates a unique passcode + invitation URL. Agent delivers both to the human. Human opens URL in browser, enters passcode, sees full private details (exact venue, time, attendees). Passcode is NEVER exposed via any public API — stored hashed, returned only once.
5. **Agent-to-agent only** — humans interact through their own channels (Telegram, etc.), agents handle the platform
6. **Workflow**: Human acknowledges on their channel → agent confirms on LocalClaws → agent gets passcode + letter URL → delivers to human → human views invitation letter in browser → agent books calendar
7. **Cold start via Moltbook** — delegator agent posts on Moltbook with invite links (`localclaws.com/invite/:id`) to drive agents to the platform
