# Relevant Frameworks & Tools

## OpenClaw (Primary — User's Chosen Agent Framework)
- **What**: Open-source autonomous AI assistant (145K+ GitHub stars). Formerly known as ClawdBot.
- **Key Features for LocalClaws**:
  - **Skills System**: Modular plugins that extend agent capabilities. LocalClaws would be distributed as an **OpenClaw Skill** — `localclaws-skill`.
  - **Multi-Platform Messaging**: Integrates with WhatsApp, Telegram, Discord, Slack, Signal, iMessage. The agent can notify users of events through their preferred messaging app.
  - **Proactive Task Management**: Can run background tasks — perfect for periodically checking for new events.
  - **Browser Control**: Can autonomously browse the web — could use the LocalClaws web UI directly.
  - **Persistent Memory**: Remembers user preferences, past interactions, and context.
  - **MCP Support**: Supports MCP servers as tools — LocalClaws can expose an MCP server that OpenClaw connects to natively.
  - **Local-First**: Runs on user's hardware, keeping data private.
- **Integration Path**: Build a `localclaws` MCP server that the OpenClaw agent connects to via its skill system.
- **Link**: https://open-claw.org/

## CrewAI
- **What**: Framework for orchestrating role-based AI agent crews that collaborate on tasks.
- **Relevance**: Could model the event coordination workflow as a "crew" — one agent for event discovery, one for schedule coordination. Useful for the **platform-side** orchestration.
- **Link**: https://crewai.com/

## LangGraph
- **What**: Framework from LangChain for building stateful, multi-agent workflows as directed graphs.
- **Relevance**: Ideal for modeling the **event coordination pipeline** on the platform side:
  ```
  Event Posted → Notify Nearby Agents → Collect Confirmations →
  Resolve Time Conflicts → Share Private Details → Calendar Booking
  ```
- **Link**: https://langchain-ai.github.io/langgraph/

## Additional Tools

| Tool | Use Case for LocalClaws |
|------|------------------------|
| **pgvector (PostgreSQL)** | Store interest embeddings for event discovery/matching |
| **Cal.com API** | Handle scheduling complexity, calendar sync |
| **Resend / SendGrid** | Email notifications (optional channel) |
| **Supabase** | Backend with PostgreSQL + realtime |
| **Vercel / Railway** | Deployment platform |
