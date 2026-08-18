# CLAUDE.md

## Environment Startup Verification

**Default behavior:** starting the environment means starting **only infrastructure services** (database, mail, etc.) — **never** start the NestJS application server unless the user explicitly asks to run/serve the project (e.g., "rode o projeto", "suba o servidor", "run the app").

After starting infrastructure, always confirm the containers are up before proceeding:

```bash
docker compose ps   # all services must show status "running"
```

Then verify each infrastructure service is actually ready to accept connections — not just running:

- **PostgreSQL:** `docker compose exec db pg_isready -U streamtube` — expect `accepting connections`

Only start the NestJS dev server (`npm run start:dev`) when the user **explicitly** asks to run the application — never as part of "start the environment".

## Development Environment

This project runs inside Docker. Always use the container for development:

```bash
# Start containers
docker compose up -d

# Install dependencies (first time only)
docker compose exec nestjs-api npm install

# Run the dev server (watch mode)
docker compose exec nestjs-api npm run start:dev
```

Services:
- `nestjs-api` — NestJS API, port `3000`
- `db` — PostgreSQL 17, port `5432`, database `streamtube`, user/password `streamtube`
- `mailpit` — SMTP capture for local dev, port `1025` (SMTP) / `8025` (web UI)
- `redis` — Bull queue backend + upload-notification transport, port `6379`
- `minio` — S3-compatible object storage, port `9000` (API) / `9001` (console), bucket `streamtube-videos`
- `worker` — video processing worker (`Dockerfile.worker`, Node 22 + FFmpeg), no exposed port, no HTTP server — see "Video Module (Phase 03)" below

All verification and teardown commands run on the **host machine**:

```bash
# Verify NestJS is running (expect 200 + "Hello World!")
curl http://localhost:3000

# Verify PostgreSQL is ready (runs inside the db container)
docker compose exec db pg_isready -U streamtube

# Check container logs
docker compose logs nestjs-api
docker compose logs db

# Tear down the entire environment
docker compose down
```

## Commands

**Strict rule:** every `npm`, `npx`, `node`, `tsc`, and test command runs **inside the container**, never on the host. Running on the host causes env-var divergence (`DB_HOST` resolves to `localhost` instead of the Compose service), uses a different Node version, and produces results that do not reflect what runs in CI/prod.

### Container-only commands (always prefix with `docker compose exec nestjs-api`)

```bash
npm run start:dev                        # Dev server with hot-reload
npm run build                            # Compile to dist/
npm run start:prod                       # Run compiled build

npm test                                 # Unit tests
npm run test:watch                       # Unit tests in watch mode
npm run test:cov                         # Coverage report
npm run test:e2e                         # End-to-end tests (always with --runInBand)

npx tsc --noEmit                         # Type-check (required before declaring a task done)
npm run lint                             # ESLint with auto-fix
npm run format                           # Prettier formatting
```

### Host-only commands (Docker / connectivity probes)

```bash
docker compose ps
docker compose logs nestjs-api
docker compose exec db pg_isready -U streamtube
curl http://localhost:3000
```

### Test execution

Integration and e2e suites share a single test database. They **must** be run with `--runInBand`:

```bash
docker compose exec nestjs-api npm test -- --runInBand
docker compose exec nestjs-api npm run test:e2e   # already configured
```

Parallel execution causes FK violations, deadlocks, and cross-suite contamination because suites truncate or seed shared tables concurrently.

During active development, run only the tests related to the file being changed (`npm test -- path/to/file.spec.ts`). Before declaring a task done, run the full suite — see the global `CLAUDE.md` → "Definition of Done (Technical)".

## Long-running Processes

Commands that never exit (dev server, watch modes) must be run in background in the Bash tool — otherwise the agent blocks indefinitely waiting for the process to return.

This applies to: `start:dev`, `start:prod`, `test:watch`, and any other persistent process.

## Test Type Selection

Choose the suffix by what the test really does, not by where the code under test lives. The suffix is a contract that drives Jest config (`testRegex`, parallelism), CI steps, and reader expectations.

| Suffix                  | Purpose                                                              | DB / external I/O | Location                     |
|-------------------------|----------------------------------------------------------------------|-------------------|------------------------------|
| `*.spec.ts`             | **Unit** — pure logic, all collaborators mocked                      | Forbidden         | Next to the source file      |
| `*.integration-spec.ts` | **Integration** — exercises real DB, real repositories, real modules | Required          | Next to the source file      |
| `*.e2e-spec.ts`         | **End-to-end** — full HTTP cycle via `supertest`                     | Required          | `nestjs-project/test/`       |

A test that constructs a `TypeOrmModule.forRoot`, opens a connection, or hits the `db` service **must** be `*.integration-spec.ts`, never `*.spec.ts`. A test that boots the full Nest application and makes HTTP calls **must** be `*.e2e-spec.ts`.

Conventions for **how to write** each kind of test (mocking patterns, AAA structure, override strategies for global guards, etc.) live in `.claude/rules/nestjs-testing.md` and load when you edit a test file.

## Jest Configuration

These settings are required in `package.json` (jest config) and `test/jest-e2e.json` for the project's tests to work correctly:

- `setupFiles: ["dotenv/config"]` — without this, `.env` is not loaded inside the Jest process. `DB_HOST`, `JWT_SECRET`, etc. fall back to undefined or to the host's `localhost`, breaking container-to-container DNS.
- `testRegex: '.*\\.(spec|integration-spec)\\.ts$'` — covers both unit (`*.spec.ts`) and integration (`*.integration-spec.ts`) suffixes.

Do not add new test-file suffixes; if a new test type is needed, update the regex deliberately.

## Environment File Conventions

`.env` is parsed by both Docker Compose and `dotenv` — values containing shell-special characters (`<`, `>`, `|`, `&`, spaces) **must be quoted** or rewritten:

```dotenv
# Wrong — the unquoted angle brackets are shell redirection syntax and break parsing
MAIL_FROM=StreamTube <noreply@streamtube.local>

# Right — quote the value
MAIL_FROM="StreamTube <noreply@streamtube.local>"
```

Whenever possible, prefer storing only the bare address in `.env` and composing display names in code (e.g., in `mail.config.ts`) so the file stays shell-safe.

## Build Assets

`tsc` (and therefore `nest build`) only emits compiled `.ts` files to `dist/`. Any non-TypeScript runtime asset — Handlebars templates (`.hbs`), JSON fixtures, static config files, etc. — must be declared in `nest-cli.json` under `compilerOptions.assets` (with `watchAssets: true` for dev). Without that, the file exists in `src/` but is missing in `dist/` and runtime fails only after build.

## Architecture

NestJS with standard module structure. Source lives in `src/`, compiled output in `dist/`.

- Each domain feature gets its own module (e.g., `UsersModule`, `VideosModule`) registered in `AppModule`
- Controllers handle HTTP routing; Services hold business logic; both are scoped to their module

## Code Conventions

- **TypeScript:** `nodenext` module resolution, `ES2023` target, `strictNullChecks` on, `noImplicitAny` off
- **Decorators:** `emitDecoratorMetadata` + `experimentalDecorators` enabled — required for NestJS DI
- **Prettier:** single quotes, trailing commas everywhere
- **ESLint:** `no-explicit-any` allowed; `no-floating-promises` and `no-unsafe-argument` are warnings; `@typescript-eslint/unbound-method` is off in `*.spec.ts` / `*.integration-spec.ts` / `*.e2e-spec.ts` (see `eslint.config.mjs` for why — `jest.Mocked<T>` assertions like `expect(mockedService.method).toHaveBeenCalledWith(...)` are a known false positive for that rule)

## Video Module (Phase 03)

Adds video upload, background processing, and streaming on top of the Phase 01/02 foundation. Planning artifacts: `docs/decisions/technical-decisions-phase-03-videos.md` and `docs/phases/phase-03-videos/`.

**New modules/files:**

- `src/videos/` — API-side `VideosModule`: `VideosController`, `VideosService`, `Video` entity, `UploadNotificationListener`, DTOs (`create-upload-session.dto.ts`), domain exceptions (`video.exception.ts`).
- `src/videos/video-processing.module.ts` — `VideoProcessingModule`, **worker-only**: registers `VideoProcessorService` as a Bull consumer. Not imported by `AppModule` — only `WorkerModule` imports it, because it depends on the `ffmpeg`/`ffprobe` binaries, which exist only in the `worker` image.
- `src/storage/storage.module.ts` — `StorageModule`, exports a MinIO `Client` under the `MINIO_CLIENT` token. On startup (`OnModuleInit`) it ensures the video bucket exists and configures a MinIO bucket notification (`s3:ObjectCreated:Put`) that publishes to a Redis list.
- `src/worker.module.ts` / `src/worker.main.ts` — a separate NestJS application context (`NestFactory.createApplicationContext`, no HTTP server), bootstrapped by the `worker` Compose service (`npm run start:worker`). Wires `UsersModule` + `VideosModule` + `VideoProcessingModule` against the same Postgres/Redis/MinIO instances as the API.
- `src/config/storage.config.ts`, `src/config/queue.config.ts` — namespaced `registerAs` factories for MinIO and Redis, following the Phase 01 config convention.

**Endpoints** (`VideosController`, `@Controller('videos')`):

- `POST /videos/upload-session` — authenticated. Validates size (≤10GB → `FILE_TOO_LARGE`) and content type (`video/*` → `UNSUPPORTED_CONTENT_TYPE`), creates a `draft` `Video` row scoped to the caller's channel, and returns a MinIO presigned PUT URL (`videoId`, `uploadUrl`, `expiresAt`, `storageKey`).
- `GET /videos/:id/stream` — public (`@Public()`). Streams a `ready` video from MinIO; honors the `Range` header (`206`, seek/playback) or serves the full byte stream (`200`) when absent — the same route serves both playback and full download, there is no separate download endpoint. Errors: `404` `VIDEO_NOT_FOUND`, `409` `VIDEO_NOT_READY`, `416` `RANGE_NOT_SATISFIABLE`.

**Upload → processing pipeline:**

1. `POST /videos/upload-session` creates the `Video` row with `status: draft`.
2. The client `PUT`s the file directly to MinIO with the presigned URL — the file never passes through the API.
3. MinIO's bucket notification publishes the `s3:ObjectCreated:Put` event to the Redis list `video-upload-events` (`MINIO_NOTIFY_REDIS_*` env vars on the `minio` Compose service).
4. `UploadNotificationListener` (`BLPOP` loop against that list; runs in both `nestjs-api` and `worker` — harmless, `BLPOP` pops atomically so only one process handles each entry) parses the event, extracts the video id from the object key, and calls `VideosService.markProcessing`, which flips the row to `processing` and enqueues a `process-video` job on the `video-processing` Bull queue.
5. `VideoProcessorService` (worker only, `@Processor(VIDEO_PROCESSING_QUEUE)`) consumes the job: downloads the object from MinIO to a temp file, runs `ffprobe` (duration) and `ffmpeg` (thumbnail frame) via `execa`, uploads the thumbnail back to MinIO, and marks the video `ready`. On failure, `status` becomes `error` with `last_error` and `processing_attempts` populated — **no automatic or manual retry ships in this phase**; a new upload session (new `Video` row) is the only way to retry.

**Data model** (`videos` table, `src/videos/entities/video.entity.ts`): `id` (UUID PK), `channel_id` (FK → `channels`), `status` (enum `draft`/`processing`/`ready`/`error`), `storage_key`, `thumbnail_key` (nullable), `duration_seconds` (nullable), `file_size_bytes` (nullable), `processing_attempts` (default 0), `last_error` (nullable), timestamps. Migration: `src/database/migrations/1786998153182-CreateVideos.ts`.

**New env vars:** `REDIS_HOST`, `REDIS_PORT`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`.

## REST Conventions

This is a RESTful API. All endpoints must follow standard REST conventions — correct HTTP methods, proper status codes, plural resource nouns, and consistent URL structure. Details are enforced via rules on controller files.
