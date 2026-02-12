# AGENTS.md

This file defines repository-wide working rules for AI agents in the Amux monorepo.

## Scope

This `AGENTS.md` applies to the entire repository tree unless overridden by a deeper `AGENTS.md`.

## Repository Identity

- Monorepo name: `amux`
- Workspace: `packages/*`, `apps/*`, `examples/*`
- Key stacks: TypeScript, pnpm, Nx, Electron, Fastify, Express, Cloudflare Workers, Next.js/Fumadocs

## Ground Truth Policy

All architecture and behavior descriptions must be derived from current code.

- Use implementation paths as source-of-truth.
- Do not infer unimplemented behavior.
- Do not present roadmap items as shipped behavior.
- If a feature exists in code but route/entry is disabled, label it explicitly as "implemented but currently not enabled".

## Package/App Responsibility Map

- `packages/llm-bridge`: bridge orchestration, IR, adapter contract, HTTP and compatibility flow.
- `packages/adapter-*`: provider adapters implementing `LLMAdapter`.
- `packages/utils`: small generic helpers (`stream`, `error`).
- `apps/desktop`: Electron desktop product with local proxy, persistence, tunnel, OAuth, metrics/logging, code-switch.
- `apps/proxy`: standalone Express conversion proxy example.
- `apps/tunnel-api`: Cloudflare Workers backend for tunnel lifecycle + rate-limit.
- `apps/website`: bilingual docs site.
- `examples/*`: SDK usage examples.

## Editing Boundaries

- Prefer minimal, focused changes.
- Do not modify unrelated files during a targeted task.
- If user requests doc-only changes, do not alter runtime/business code.
- Keep names, import style, and conventions aligned with local code.

## Bridge/Adapter Invariants (Do Not Break in Docs or Code)

Reference files:

- `packages/llm-bridge/src/bridge/bridge.ts`
- `packages/llm-bridge/src/adapter/base.ts`

Critical invariants:

- Bridge flow is parse -> IR -> build -> HTTP -> parse -> rebuild.
- Model mapping priority: `targetModel > modelMapper > modelMapping > original`.
- Stream pipeline filters duplicate `end` and filters protocol marker `[DONE]` from bridge-level payload flow.
- Chat/models endpoint resolution prefers explicit config over adapter defaults.
- Adapter code should remain provider-focused; cross-provider orchestration belongs in bridge layer.

## Desktop-Specific Reality Checks

Key references:

- `apps/desktop/electron/main.ts`
- `apps/desktop/electron/services/proxy-server/*`
- `apps/desktop/electron/services/database/*`
- `apps/desktop/electron/services/tunnel/*`
- `apps/desktop/electron/services/oauth/*`

When documenting Desktop behavior:

- Mention dynamic routes under `/providers/*` and `/proxies/*`.
- Mention enabled code-switch route: `/code/claudecode/v1/messages`.
- Mention Codex code-switch HTTP routes as currently commented out in route registration.
- Mention OAuth translation routes under `/oauth/codex/*` and `/oauth/antigravity/*`.

## Validation Strategy

- For documentation changes: run at least a lightweight formatting/readability check when feasible.
- For code changes: run narrow tests first, then broader checks as needed.
- Do not "fix" unrelated failing tests or unrelated defects.

## Documentation Sync Rules

When APIs/architecture change, update all affected docs together:

- Root docs: `README.md`, `README_ZH.md`
- Agent docs: `CLAUDE.md`, `AGENTS.md`
- Website docs: `apps/website/app/content/docs/en/*` and `apps/website/app/content/docs/zh/*`

For bilingual docs, keep English and Chinese versions structurally aligned.

