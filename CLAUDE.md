# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

npm workspaces monorepo (`apps/server`, `apps/web`), Node 24.

- `npm run dev` — API (NestJS, :3000, `nest start --watch`) and web (Vite, :5173, proxies `/api`) together
- `npm test` — Vitest in both workspaces; single file: `npx vitest run src/importers/parsers/workday.parser.spec.ts` from `apps/server`, or filter by name with `-t "pattern"`
- `npm run lint` / `npm run format:check` / `npm run typecheck` / `npm run build` — all run in CI
- `npm run db:generate -w apps/server` — generate a Drizzle migration after editing `apps/server/src/database/schema.ts` (migrations apply automatically on startup)
- `docker build -t jobify .` — production image (single container: API serves `apps/web/dist`)

## Architecture

- **Server is ESM NestJS 12.** Relative imports need `.js` extensions. Constructor-injected services must be value imports (not `import type`) because Nest resolves them via `emitDecoratorMetadata`; ESLint's `consistent-type-imports` is disabled for the server for this reason. Specs construct services directly rather than through Nest's testing module (Vitest doesn't emit decorator metadata).
- **Database:** SQLite through `@libsql/client` + Drizzle (`database/database.ts`). `better-sqlite3` is deliberately avoided because npm 11 blocks its native build script. Tests use `openDatabase(':memory:')`, which runs the real migrations.
- **Config** is a plain typed object from `config/configuration.ts`, injected with the `APP_CONFIG` token. No `@nestjs/config`.
- **Validation:** global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`, so every accepted body field needs a class-validator decorator on its DTO.
- **Auth:** optional. `AuthGuard` is a global `APP_GUARD` that is a no-op unless `JOBIFY_PASSWORD` is set; routes opt out with `@Public()`. Sessions are stateless HMAC-signed cookies keyed on a secret stored in the `settings` table plus the password.
- **Importers** (`importers/`): an ordered `JOB_PARSERS` list. `ImportService` runs every parser whose `matches(url)` is true, merging results with `fillMissing` (earlier parsers win), and stops once title, company and description are present. Site parsers (with `site` set) come first, then the generic `JsonLdParser` and `MetaTagsParser`. `PageContext` fetches the page lazily, so API-based parsers never download HTML. Import returns a draft only; the client saves it.
- **AI** (`ai/`): `createAiProvider(settings)` picks a provider. Anthropic uses the official `@anthropic-ai/sdk`; the others use plain `fetch` via `postJson`. Providers throw `AiProviderError`, which `AiService` maps to a 400 (misconfigured) or 502 (upstream failure). Each `AiTask` writes its output to a job column (`AI_TASK_FIELDS`). AI settings saved in the DB override the `AI_*` env vars; the API key is never returned to the browser.
- **Status history:** `JobsService.update` writes a `status_change` event when the status changes and sets `appliedOn` on the first move out of `saved`. The dashboard's response rate depends on these events.
- **Web:** all server state goes through TanStack Query hooks in `web/src/api/hooks.ts`. `web/src/api/types.ts` mirrors the server's constants and response shapes by hand, so update it whenever DTOs or the schema change. Job list filters live in the URL (`lib/useJobFilters.ts`). Use `cn()` (clsx + tailwind-merge) for class names.
