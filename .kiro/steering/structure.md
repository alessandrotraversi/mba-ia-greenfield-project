# Project Structure

## Root

```
mba-ia-greenfield-project/
├── nestjs-project/       # Backend API
├── next-frontend/        # Frontend app
├── docs/                 # Architecture, planning, decisions
├── scripts/              # Utility scripts (e.g. sync-openapi.sh)
├── .claude/              # Claude AI rules and skills
├── .kiro/steering/       # Kiro steering files (this directory)
├── FC Tube.fig           # Figma design system source
└── CLAUDE.md             # Top-level AI instructions
```

---

## Backend — `nestjs-project/`

```
nestjs-project/
├── src/
│   ├── app.module.ts             # Root module — registers all feature modules
│   ├── main.ts                   # Bootstrap (global pipes, guards, filters)
│   ├── auth/                     # Auth feature module
│   │   ├── decorators/           # @Public(), @CurrentUser()
│   │   ├── dto/                  # Request/response DTOs
│   │   ├── entities/             # RefreshToken, VerificationToken
│   │   └── guards/               # JwtAuthGuard (global)
│   ├── users/                    # Users feature module
│   │   └── entities/             # User entity
│   ├── channels/                 # Channels feature module
│   │   └── entities/             # Channel entity
│   ├── mail/                     # Mail module (Handlebars templates)
│   │   └── templates/            # *.hbs email templates
│   ├── common/                   # Shared cross-cutting concerns
│   │   ├── exceptions/           # DomainException base class
│   │   └── filters/              # DomainExceptionFilter, ValidationExceptionFilter
│   ├── config/                   # Namespaced config + Joi env validation
│   ├── database/
│   │   ├── data-source.ts        # TypeORM DataSource (used by migrations CLI)
│   │   ├── migrations/           # Timestamped migration files
│   │   └── seeds/                # Seed scripts
│   └── test/                     # Shared test helpers (test DataSource, Mailpit client)
├── test/                         # E2E test suites (*.e2e-spec.ts)
├── compose.yaml                  # Docker Compose: nestjs-api + db + mailpit
└── Dockerfile.dev
```

### Backend Module Conventions

- Each domain feature gets its own NestJS module (`UsersModule`, `AuthModule`, etc.) registered in `AppModule`.
- Controllers handle HTTP routing only. Services own all business logic.
- `JwtAuthGuard` is applied globally; use `@Public()` decorator to opt out.
- Domain errors extend `DomainException` and are caught by `DomainExceptionFilter`.
- Config is always accessed via namespaced `ConfigService` — never `process.env` directly.
- Non-TS runtime assets (`.hbs`, JSON fixtures) must be declared in `nest-cli.json` under `compilerOptions.assets`.
- Docker Compose service names are used as hostnames (e.g., `db`, not `localhost`).

---

## Frontend — `next-frontend/`

```
next-frontend/
├── app/                          # Next.js App Router
│   ├── globals.css               # Design tokens (@theme inline) — source of truth for all tokens
│   ├── layout.tsx                # Root layout (fonts)
│   ├── (auth)/                   # Route group: login, signup, forgot-password pages
│   └── api/
│       └── auth/                 # BFF Route Handlers (proxy to NestJS API)
│           └── <endpoint>/__tests__/   # *.integration.test.ts for each route handler
├── components/
│   ├── ui/                       # shadcn primitives (add via CLI only — never hand-roll)
│   ├── icons/                    # Custom SVG icon components
│   └── <feature>/                # Feature components (e.g., auth/)
│       └── __tests__/            # *.test.tsx unit tests
├── lib/
│   ├── env.ts                    # @t3-oss/env-nextjs schema — only place to read env vars
│   ├── api/
│   │   └── types.gen.ts          # Generated from openapi.json — DO NOT edit manually
│   └── utils.ts                  # cn() helper (clsx + tailwind-merge)
├── hooks/                        # Custom React hooks (create when first hook is added)
├── mocks/                        # MSW handlers + server (shared by Vitest and instrumentation.ts)
├── tests/                        # Playwright E2E specs (*.e2e-spec.ts)
├── openapi.json                  # Local copy of NestJS OpenAPI spec (committed)
├── instrumentation.ts            # Boots MSW server-side when MSW_ENABLED=true
├── components.json               # shadcn config (do not edit by hand)
└── compose.yaml                  # Docker Compose: next-frontend container
```

### Frontend Conventions

- **Server Components by default.** Add `"use client"` only when the component uses state, effects, refs, or browser APIs.
- **BFF model:** the browser never calls the NestJS API directly. All client-side traffic goes through same-origin Route Handlers under `app/api/**`.
- **Env vars** are read exclusively from `lib/env.ts`. `API_URL` is server-only — never expose a `NEXT_PUBLIC_*` backend URL.
- **Wire types** come exclusively from `lib/api/types.gen.ts` (generated from `openapi.json`). Never hand-duplicate DTOs.
- **Design tokens** live in `app/globals.css`. Never inline hex/px values — always use a token. If a token is missing, add it to `globals.css` first.
- **shadcn components** are added via `npx shadcn@latest add <component>` and live in `components/ui/`. Do not modify them by hand.
- **Icons** are custom SVG components in `components/icons/`. Do not install external icon packages.
- **Path aliases:** `@/components`, `@/components/ui`, `@/components/icons`, `@/lib`, `@/lib/utils`, `@/hooks`.

---

## Docs

```
docs/
├── project-plan.md               # Full phase-by-phase roadmap
├── phases/                       # Per-phase planning and implementation notes
│   ├── phase-01-configuracao-base/
│   ├── phase-02-auth/
│   └── phase-02-auth-frontend/
├── decisions/                    # Technical decision records
├── inventories/                  # Codebase inventory snapshots
├── diagrams/
│   └── software-arch.mermaid     # C4 container diagram
├── design-system-ai-implementable.md
└── design-system-pillars.md
```
