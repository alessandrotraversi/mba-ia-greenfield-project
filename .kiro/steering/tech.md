# Tech Stack

## Monorepo Layout

Two independent Docker stacks — start backend first, then frontend.

| Subproject | Runtime | Port |
|---|---|---|
| `nestjs-project/` | NestJS 11, Node.js, TypeScript | 3000 |
| `next-frontend/` | Next.js 16, React 19, TypeScript | 3001 |
| PostgreSQL 17 | (nestjs stack) | 5432 |
| Mailpit | (nestjs stack) | 8025 |

---

## Backend — `nestjs-project/`

**Framework:** NestJS 11 (Express platform)  
**Language:** TypeScript 5 — `nodenext` module resolution, `ES2023` target, `strictNullChecks` on, `emitDecoratorMetadata` + `experimentalDecorators` enabled  
**ORM:** TypeORM 0.3 — `synchronize` disabled; schema managed exclusively via migrations  
**Auth:** `@nestjs/jwt` + Argon2 passwords + refresh token rotation with family tracking  
**Validation:** `class-validator` + `class-transformer` via global `ValidationPipe`  
**Config:** `@nestjs/config` with namespaced configs validated by Joi (`src/config/env.validation.ts`)  
**Email:** `@nestjs-modules/mailer` with Handlebars templates (`src/mail/templates/*.hbs`) — Mailpit in dev  
**Rate limiting:** `@nestjs/throttler` on auth endpoints  
**API docs:** `@nestjs/swagger` — enabled via `SWAGGER_ENABLED=true` at `http://localhost:3000/api/docs`  
**Linting/formatting:** ESLint 9 + Prettier (single quotes, trailing commas)

### Backend Commands

All `npm`/`npx`/`node` commands run **inside the container**, never on the host.

```bash
# Infrastructure
docker compose up -d
docker compose exec nestjs-api npm install          # first time only
docker compose exec db pg_isready -U streamtube     # verify DB ready

# Dev server (long-running — run in background)
docker compose exec -d nestjs-api npm run start:dev

# Migrations
docker compose exec nestjs-api npm run migration:run
docker compose exec nestjs-api npm run migration:revert
docker compose exec nestjs-api npm run migration:generate -- --name=<MigrationName>

# Tests
docker compose exec nestjs-api npm test                        # unit + integration
docker compose exec nestjs-api npm test -- --runInBand         # required for integration/e2e
docker compose exec nestjs-api npm run test:e2e
docker compose exec nestjs-api npm run test:cov

# Quality gates (required before declaring a task done)
docker compose exec nestjs-api npx tsc --noEmit
docker compose exec nestjs-api npm run lint

# OpenAPI spec export
docker compose exec nestjs-api npm run openapi:export
```

### Backend Test Types

| Suffix | Type | DB | Location |
|---|---|---|---|
| `*.spec.ts` | Unit — all collaborators mocked | Forbidden | Next to source file |
| `*.integration-spec.ts` | Integration — real DB, real modules | Required | Next to source file |
| `*.e2e-spec.ts` | E2E — full HTTP via supertest | Required | `test/` |

Integration and e2e suites **must** run with `--runInBand` (shared test DB).

---

## Frontend — `next-frontend/`

**Framework:** Next.js 16 App Router, React Server Components by default  
**Language:** TypeScript 5 strict  
**Styling:** Tailwind CSS 4 — CSS-first config via `@theme inline` in `app/globals.css`. **No `tailwind.config.js`**  
**UI components:** shadcn/ui (`style: radix-nova`, `baseColor: neutral`, `cssVariables: true`) on top of `radix-ui` primitives. Add new primitives via `npx shadcn@latest add <component>` only  
**Icons:** Custom SVG components in `components/icons/` — no external icon library  
**Forms:** React Hook Form + Zod  
**API client:** `openapi-fetch` — types generated from `openapi.json` into `lib/api/types.gen.ts` (do not edit manually)  
**Session:** `iron-session` (HTTP-only cookies)  
**Env vars:** `@t3-oss/env-nextjs` + Zod via `lib/env.ts` — `API_URL` is server-only; no `NEXT_PUBLIC_*` backend URL  
**Linting:** ESLint 9 (`eslint-config-next`)

### Frontend Commands

All `npm`/`npx`/`node` commands run **inside the container** except Playwright (runs on host).

```bash
# Infrastructure
docker compose up -d
docker compose exec next-frontend npm install       # first time only

# Dev server (long-running — run in background)
docker compose exec -d next-frontend npm run dev

# Tests — Vitest (inside container)
docker compose exec next-frontend npm test                           # unit + integration (run mode)
docker compose exec next-frontend npm test -- path/to/file.test.ts  # single file

# Tests — Playwright E2E (on HOST; dev server must be running with MSW_ENABLED=true)
docker compose exec -d next-frontend sh -c "MSW_ENABLED=true npm run dev"
curl --retry 15 --retry-delay 2 --retry-connrefused -I http://localhost:3001
npx playwright test
npx playwright test tests/foo.e2e-spec.ts

# Quality gates (required before declaring a task done)
docker compose exec next-frontend npx tsc --noEmit
docker compose exec next-frontend npm run lint

# Regenerate API types from openapi.json
docker compose exec next-frontend npm run openapi:types

# Add a shadcn primitive
docker compose exec next-frontend npx shadcn@latest add <component>
```

### Frontend Test Types

| Suffix | Type | Runner | I/O | Location |
|---|---|---|---|---|
| `*.test.ts(x)` | Unit — isolated, mocks for collaborators | Vitest | Forbidden | `__tests__/` next to artifact |
| `*.integration.test.ts(x)` | Integration — route handlers as functions, MSW intercepts upstream | Vitest | MSW only | `__tests__/` next to artifact |
| `*.e2e-spec.ts` | E2E — real browser, upstream NestJS faked server-side via MSW | Playwright | Server-side MSW | `tests/` at root |

MSW runs with `onUnhandledRequest: "error"` in Vitest and `"bypass"` in `instrumentation.ts`.

---

## Sync OpenAPI Contract

```bash
# Copy the latest spec from the backend and regenerate types
./scripts/sync-openapi.sh
```

This copies `nestjs-project/openapi.json` to `next-frontend/openapi.json` and re-runs `openapi:types`.

---

## Definition of Done

A task is only complete when **all** of the following pass:

1. Relevant tests pass (unit + integration + e2e for the changed code)
2. Full test suite passes
3. `npx tsc --noEmit` exits 0
4. `npm run lint` exits 0
