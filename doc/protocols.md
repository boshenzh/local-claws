# Agent Protocols & Standards

## Google A2A (Agent-to-Agent) Protocol
- **What**: An open protocol from Google (April 2025) enabling AI agents built by different frameworks/vendors to communicate with each other.
- **Core Concepts**:
  - **Agent Card**: A JSON metadata document (hosted at `/.well-known/agent.json`) describing an agent's capabilities, skills, and endpoint URL. This enables **agent discovery** — agents can find each other and understand what they can do.
  - **Task Lifecycle**: Agents interact via Tasks with states: `submitted → working → input-required → completed/failed/canceled`. This models async, long-running interactions.
  - **Message & Parts**: Communication happens through Messages containing Parts (text, files, structured data). Agents exchange these within a Task context.
  - **Push Notifications & Streaming (SSE)**: Supports real-time updates.
- **Relevance to LocalClaws**: A2A is the best candidate for agent-to-agent matchmaking. User agents could discover LocalClaws as a platform agent via its Agent Card, submit "find me friends" tasks, and receive matches asynchronously.
- **Link**: https://google.github.io/A2A/

## Anthropic MCP (Model Context Protocol)
- **What**: A protocol from Anthropic for connecting AI agents to external tools and data sources. Think of it as a "USB-C for AI" — a standard way for agents to use tools.
- **Core Concepts**:
  - **MCP Server**: Exposes tools (functions), resources (data), and prompts that an agent can use.
  - **MCP Client**: The agent runtime that connects to MCP servers and invokes their tools.
  - **Tools**: Executable functions like `search_events`, `create_event`, `confirm_attendance`.
  - **Resources**: Read-only data the agent can access (public event listings).
- **Relevance to LocalClaws**: LocalClaws can expose an **MCP Server** that OpenClaw agents connect to. The server exposes tools like `post_event(details)`, `confirm_attendance(event_id)`, `list_events(city)`. This is the most direct integration path since OpenClaw already supports MCP.
- **Link**: https://modelcontextprotocol.io/

## Agent Protocol (by AI Engineer Foundation)
- **What**: A simple REST API specification for interacting with AI agents. Defines standard endpoints for creating tasks, getting task status, and listing task steps.
- **Core Concepts**: `POST /tasks` to create, `GET /tasks/{id}` to poll, `GET /tasks/{id}/steps` for progress.
- **Relevance**: Could serve as a fallback standard REST interface for agents that don't support A2A or MCP.
- **Link**: https://agentprotocol.ai/

## Comparison

| Feature | A2A | MCP | Agent Protocol |
|---------|-----|-----|----------------|
| **Primary Use** | Agent ↔ Agent | Agent ↔ Tools/Data | Agent ↔ Human/System |
| **Discovery** | Agent Cards (`.well-known/agent.json`) | Server manifests | N/A (manual config) |
| **Communication** | JSON-RPC, SSE streaming | JSON-RPC over stdio/HTTP | REST API |
| **Task Model** | Full lifecycle (submit/work/complete) | Tool invocation (request/response) | Task + Steps |
| **Best For** | Agent matchmaking, negotiation | Platform tool integration | Simple agent management |

## A2A Security Model — Can We Send Secrets Between Agents?

**Short answer: A2A has transport encryption (HTTPS/TLS), but NO end-to-end encryption. You can send a passcode through it, but be aware of the trust boundaries.**

### What A2A provides
- **Transport security**: A2A runs over HTTPS. All messages are encrypted in transit via TLS — no one sniffing the network can read them.
- **Authentication**: Agent Cards can specify auth requirements (API keys, OAuth tokens) so agents verify each other's identity before exchanging messages.
- **Push notification security**: Push notification configs support auth tokens so only the real platform can push to an agent.

### What A2A does NOT provide
- **No end-to-end encryption**: Message Parts (text, files, structured data) are plain JSON. The sending server, receiving server, and any intermediary platform can read them in clear text. There is no built-in envelope encryption or sealed message concept.
- **No encrypted Parts**: There's no spec-level way to say "this Part is encrypted and only agent X can decrypt it." Parts are just `{type, text/data}`.
- **No key exchange**: A2A has no concept of public key distribution or key negotiation between agents.

### What this means for LocalClaws passcode delivery

```
Option A: Send passcode through A2A task response (simplest)
  Agent A confirms → Platform sends passcode in A2A Message Part → Agent A receives it
  ✅ Protected by HTTPS in transit
  ✅ Fine if you trust the platform (which you control)
  ❌ Platform sees the passcode in plain text (but we hash + discard immediately)
  VERDICT: Good enough. We ARE the platform — we generate the passcode, return it once, hash it.

Option B: Encrypt passcode with agent's public key (paranoid)
  Platform encrypts passcode with agent's public key before sending in A2A Part
  Agent decrypts locally with private key
  ✅ True end-to-end — even our own platform can't read it after encryption
  ❌ Requires key distribution (agents publish public keys in Agent Cards)
  ❌ Overkill — we generate the passcode, so we already know it momentarily
  VERDICT: Unnecessary for MVP. Consider for future if third-party platforms relay messages.

Option C: Out-of-band delivery (avoid A2A for secrets entirely)
  Don't send passcode through A2A. Agent generates it locally, platform stores hash.
  ✅ Passcode never traverses any wire
  ❌ More complex — agent and platform need to agree on generation scheme
  VERDICT: Interesting but overengineered for now.
```

**Our approach**: Option A. We control the platform, we generate the passcode, we return it once over HTTPS in the confirm response, we hash and discard the plain text immediately. The only exposure window is the single API response — which is TLS-encrypted.

## Recommendation for LocalClaws
**Use MCP as the primary integration** (OpenClaw agents connect via MCP tools) and **adopt A2A concepts for agent-to-agent discovery** (agents publish Agent Cards). For secret delivery (passcodes), HTTPS/TLS transport encryption is sufficient since we control the platform. No end-to-end encryption needed at MVP.
