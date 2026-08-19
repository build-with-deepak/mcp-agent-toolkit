# mcp-agent-toolkit

**Live demo:** not deployed yet — planned at `agent.build-with-deepak.com`.
This repo is complete and locally verified (build, lint, 25 unit tests —
including a real MCP protocol round-trip — and 5 e2e tests); it has not
yet been deployed or exercised against a live Ollama/Postgres. See
[Status](#status).

## The problem

Most "AI agent" demos are a single hidden tool call dressed up as
autonomy. This one shows its work: a Model Context Protocol agent with
three real tools — a read-only PostgreSQL commerce database, a live
weather API, and a calculator — answering questions that genuinely need
more than one of them ("total revenue from Dubai customers, and what's
the weather there?"). Every tool invocation, its arguments, its result,
its latency, and — importantly — its *failures and the model's recovery
from them* stream to the screen as they happen.

## Try it

**Continue with demo account** issues a real 2-hour session against the
real API — same agent, same tools, same data. The sample database is
shared and read-only, so demo sessions need no per-user cleanup: nothing
a visitor does can write anything. Registration (persistent per-user
data) is in progress; the Register button and `POST /api/auth/register`
(501) both say so honestly.

## Architecture

```mermaid
flowchart TB
    subgraph Browser
        UI[Angular SPA<br/>login → live tool-call timeline]
    end

    subgraph VPS -- host nginx, TLS
        Nginx[nginx :443]
    end

    subgraph "Docker Compose stack"
        Web[web container]
        subgraph API [api container — NestJS]
            Loop[Agent loop]
            Client[MCP Client]
            Server[MCP Server]
        end
        PG[(PostgreSQL<br/>sample dataset<br/>mcp_readonly role)]
    end

    Ollama[Ollama llama3.1 — on the VPS]
    Meteo[Open-Meteo API]

    UI -->|HTTPS| Nginx --> Web -->|/api/*| Loop
    Loop -->|chat + tools| Ollama
    Loop -->|listTools / callTool| Client
    Client <-->|MCP protocol, in-memory transport| Server
    Server -->|query_database| PG
    Server -->|get_weather| Meteo
    Server -->|calculate| Server
```

The loop: the model receives the question plus the MCP-discovered tool
schemas → emits tool calls → each call runs through the MCP client →
results (including errors) go back to the model → repeat until it answers
in prose or hits the step ceiling (default 6). Every hop is an SSE event.

## Key decisions and trade-offs

**A real MCP server and client, in one process.** The tools could have
been plain functions — the protocol boundary is the point. The agent loop
talks *only* to the MCP client: it discovers tools via `listTools()` and
invokes them via `callTool()`, exactly as it would against an external
server over stdio or HTTP. Moving a tool out of this process changes one
transport line, not the agent. The in-memory transport keeps a single-VPS
demo free of extra ports and subprocess supervision while the SDK still
validates schemas both ways — and the unit suite exercises that actual
handshake, not a mock of it.

**SQL injection is treated as the DEFAULT state, not an edge case.** The
agent writes SQL from a stranger's natural-language question — that is
untrusted input by construction. Two layers: an app-side guard
(`sql-guard.ts`: comment stripping, single-statement, SELECT/WITH-only, a
keyword denylist that knows `set_config` is not `set`, and a subquery
wrap capping results at 100 rows) fails fast with messages the model can
act on; beneath it, the query executes as a dedicated `mcp_readonly`
Postgres role — SELECT-only grants, `default_transaction_read_only=on`,
5s statement timeout — which holds even if the guard has a bug. The
guard's own tests document its accepted lexical limitation.

**Tool errors are fed back to the model, not surfaced as failures.** A
failed tool call returns as an `isError` result and goes into the
conversation as tool output. The model reads the error, fixes its SQL or
picks another city, and retries — and the UI annotates exactly that
("the error goes back to the model — watch the next step"). Watching
recovery is worth more, as evidence of engineering, than never failing.

**The calculator is a 60-line parser, not `eval`.** An LLM-written
expression handed to any JavaScript evaluator turns a calculator into a
code-execution tool. Recursive descent with an explicit grammar is the
boring, correct alternative; its tests include `1 + 1; process.exit()`.

**Loop steps are non-streaming; the timeline is the stream.** Whether a
model response is a tool call or the final answer is only knowable when
it's complete, and tool-call responses are short. What streams live is
what's actually interesting — the tool calls and results as they happen.
The final prose answer arrives as one event. (Same SSE-over-POST
transport decision as the sibling router demo, same reasons.)

**Open-Meteo for weather.** Free and keyless: an unattended public demo
with a third-party API key in it is a leak waiting to happen and a bill
waiting to be run up. The trade-off — no SLA — is acceptable because a
weather-tool outage is itself a live demonstration of the error-handling
path.

**Fixed sample dataset with fixed IDs.** Seeding uses `ON CONFLICT DO
NOTHING`, so every boot converges to the same 15 customers / 12 products
/ 32 orders instead of accumulating duplicates. Cities were chosen so
DB + weather questions compose naturally (Dubai, New Delhi, London…).

## Database setup and reset

Schema, sample data and the `mcp_readonly` role's grants live in
`apps/api/db/schema.sql`, applied idempotently on every API boot; the
role itself (password from `MCP_READONLY_PASSWORD`) is created in
`db.service.ts` because `CREATE ROLE` can't take a parameterized
password. `pnpm db:reset` drops the sample tables; the next boot
recreates everything. There is no routine demo-data cleanup here by
design — visitors cannot write.

## What I'd change at 100x scale

The in-memory MCP transport is the first thing that moves: real
multi-tenant tool servers run as separate services (stdio subprocesses or
HTTP), with per-tool authz and audit logging at the protocol boundary —
this codebase is already shaped for that swap. The agent loop would gain
persistent conversations (a `conversations` table keyed by session — the
natural first feature of registered accounts), parallel tool execution
where calls are independent, and a token-budget ceiling alongside the
step ceiling. And the SQL tool would stop exposing raw SELECT entirely:
at scale you publish named, parameterized query templates and let the
model fill parameters — the guard-plus-readonly-role pattern here is the
demo-sized version of that idea, not a substitute for it.

## Local setup

Node 22+, pnpm; for the full experience, Postgres and an Ollama with a
tool-capable model (`ollama pull llama3.1:8b` — plain llama3 does not
reliably emit tool calls).

```bash
corepack enable && pnpm install
pnpm dev:api   # :3000
pnpm dev:web   # :4200, proxies /api → :3000
```

Gate checks:

```bash
pnpm --filter api build && pnpm --filter api lint && pnpm --filter api test && pnpm --filter api test:e2e
pnpm --filter web build && pnpm --filter web test
```

## Deploying to the VPS

1. `cp .env.example .env` — set `POSTGRES_PASSWORD`,
   `MCP_READONLY_PASSWORD` and `JWT_SECRET` (compose refuses to start
   without them). Confirm `ollama list` on the VPS shows `llama3.1:8b`.
2. `docker compose up -d --build` — web binds `127.0.0.1:8092` only.
3. Install `nginx/agent.build-with-deepak.com.conf` into the host nginx,
   then `certbot --nginx -d agent.build-with-deepak.com`.
4. `GET /api/health` is the unauthenticated liveness probe.

## Status

- [x] Real MCP server + client over the SDK's in-memory transport, three
      tools, protocol round-trip covered by tests
- [x] Agent loop with live SSE tool-call timeline, error-recovery
      feedback, step ceiling
- [x] Two-layer SQL protection (guard + dedicated read-only Postgres role)
- [x] Demo-account auth end to end; register = honest 501 coming-soon
- [x] Builds, lints, passes all tests (API: 25 unit + 5 e2e; web: 6)
- [ ] **Not yet run against live Ollama/Postgres** — this environment had
      neither; the agent loop's Ollama tool-calling path in particular
      needs a real llama3.1 run before this goes in front of anyone
- [ ] Not yet deployed
- [ ] Registration/persistent accounts — in progress (demo-first by design)
