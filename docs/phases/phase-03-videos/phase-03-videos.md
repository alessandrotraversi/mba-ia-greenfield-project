---
kind: phase
name: phase-03-videos
test_specs_aware: true
sources_mtime:
  docs/phases/phase-03-videos/context.md: "2026-08-17T15:59:23Z"
  docs/phases/phase-03-videos/library-refs.md: "2026-08-17T14:27:02Z"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-08-17T15:52:07Z"
  docs/decisions/technical-decisions-openapi-docs-nestjs.md: "2026-08-17T14:27:02Z"
---

# Phase 03 — Upload e Processamento de Vídeos

## Objective

Deliver the backend infrastructure for video upload, background processing, and streaming: a file storage service for videos and thumbnails, a background job queue, uploads up to 10GB without performance impact, automatic draft pre-registration on upload start, automatic post-upload processing (duration/metadata extraction and thumbnail generation), a unique URL per video, HTTP range-based streaming, and user-initiated download — all backend-only, with `next-frontend` deferred to a future phase.

---

## Step Implementations

### SI-03.1 — Infra: Dependencies, Configuration Namespaces, and Docker Compose

**Description:** Install the npm dependencies decided for this phase, add namespaced config factories for queue and storage, and wire Redis/MinIO/worker services into Docker Compose.

**Technical actions:**

1. Install `@nestjs/bull@^11.x`, `bull@^5.x`, `minio@^8.x`, and `execa@^10.x` in `nestjs-project` (per `phase-03-videos/TD-01`, `phase-03-videos/TD-07`, `phase-03-videos/TD-08`).
2. Create `src/config/queue.config.ts` — `registerAs('queue', () => ({...}))` factory reading `REDIS_HOST`/`REDIS_PORT`, following the namespaced pattern (per `phase-01-configuracao-base/TD-03`; per `phase-03-videos/TD-01`).
3. Create `src/config/storage.config.ts` — `registerAs('storage', () => ({...}))` factory reading `MINIO_ENDPOINT`/`MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`/`MINIO_BUCKET` (per `phase-01-configuracao-base/TD-03`; per `phase-03-videos/TD-07`).
4. Add `REDIS_HOST`, `REDIS_PORT`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` to the Joi schema in `src/config/env.validation.ts` (per `phase-01-configuracao-base/TD-02`).
5. Add `redis`, `minio`, and `worker` services to `docker-compose.yml` (per `phase-03-videos/TD-01`, `phase-03-videos/TD-03`).

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `docker compose ps` shows `redis`, `minio`, and `worker` services with status `running` after `docker compose up -d`.
- The API fails fast at boot with a Joi validation error when a required env var (e.g. `REDIS_HOST`) is missing.
- `npx tsc --noEmit` passes with the new config factories and dependencies installed.

---

### SI-03.2 — Video Entity and Migration

**Description:** Create the `Video` entity, its TypeORM migration, and repository registration in a new `VideosModule`.

**Technical actions:**

1. Create `src/videos/entities/video.entity.ts` — `Video` entity with `id` (uuid, PK, default `gen_random_uuid()`), `channelId` (uuid), `status` (enum `draft`/`processing`/`ready`/`error`, default `draft`), `storageKey`, `thumbnailKey` (nullable), `durationSeconds` (nullable), `fileSizeBytes` (nullable), `processingAttempts` (default `0`), `lastError` (nullable), `createdAt`, `updatedAt` (per `phase-03-videos/TD-05`, `phase-03-videos/TD-06`, `phase-03-videos/TD-07`).
2. Add `@ManyToOne(() => Channel)` relation + `channelId` FK column; add indexes on `channelId` and `status`.
3. Generate the migration via `npm run migration:generate` — creates the `videos` table.
4. Create `src/videos/videos.module.ts` registering `TypeOrmModule.forFeature([Video])`; import `VideosModule` into `AppModule`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `Video` | Integration: constraints, defaults, FK to `Channel` | `src/videos/entities/video.entity.integration-spec.ts` |

**Dependencies:** SI-03.1

**Acceptance criteria:**

- Persisting a `Video` row with only the required fields (`channelId`, `storageKey`) defaults `status` to `draft` and `processingAttempts` to `0`.
- Persisting a `Video` row with a non-existent `channelId` violates the FK constraint and is rejected.
- The migration applies cleanly against an empty database (`npm run migration:run`) and reverts cleanly (`npm run migration:revert`).

---

### SI-03.3 — Bull Queue Module and Worker Bootstrap

**Description:** Register the `video-processing` Bull queue in the API module and create the standalone worker container entrypoint that consumes it.

**Technical actions:**

1. Register `BullModule.forRootAsync` (Redis connection from `queueConfig`) + `BullModule.registerQueue({ name: 'video-processing' })` in `AppModule` (per `phase-03-videos/TD-01`).
2. Create `nestjs-project/Dockerfile.worker` — `node:22-alpine` base, `apk add ffmpeg`, builds the same `dist/` output as the API image (per `phase-03-videos/TD-03`).
3. Create `src/worker.main.ts` — a separate NestJS application bootstrap (no HTTP listener) loading `VideosModule` + `BullModule`, used as the worker container's entrypoint (per `phase-03-videos/TD-03`).
4. Add a `start:worker` npm script that runs `src/worker.main.ts`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `AppModule` (Bull wiring) | Unit: compilation test — `BullModule` registers without error given valid queue config | `src/app.module.compilation-spec.ts` |

**Dependencies:** SI-03.1

**Acceptance criteria:**

- The API container boots successfully with the `video-processing` queue registered and connected to Redis.
- The worker container boots independently of the API container and connects to the same Redis queue.
- `ffmpeg -version` and `ffprobe -version` succeed when run inside the worker container.

---

### SI-03.4 — Endpoint POST /videos/upload-session

**Route:** POST /videos/upload-session
**Test Specs:** see `nestjs-project/specs/videos-upload-session.plan.md`
**Authorization:** Authenticated (owner)

**Description:** Implement the upload-session endpoint — validates the requested file size/type, creates a draft `Video` record scoped to the caller's channel, and returns a MinIO presigned PUT URL.

**Technical actions:**

1. Create `src/videos/dto/create-upload-session.dto.ts` — `CreateUploadSessionDto` with `fileName` (string, required), `contentType` (string, required, must start with `video/`), `fileSizeBytes` (number, required, max `10 * 1024^3`) (per `phase-03-videos/TD-02`, `### API Contracts`).
2. Create `src/videos/videos.service.ts` — `VideosService.createUploadSession(channelId, dto)`: builds `storageKey = channels/{channelId}/videos/{videoId}.mp4`, persists a draft `Video` row, calls MinIO `presignedPutObject(bucket, storageKey, expirySeconds)` (per `phase-03-videos/TD-02`, `phase-03-videos/TD-05`, `phase-03-videos/TD-07`; `minio` in `library-refs.md`).
3. Create `src/videos/videos.controller.ts` — `VideosController` with `@UseGuards(AuthGuard)` `@Post('upload-session')`, deriving `channelId` from the authenticated user's channel, returning 201 with `{ videoId, uploadUrl, expiresAt, storageKey }` (per `phase-02-auth`'s JWT access guard).
4. Add `@ApiOperation`, `@ApiResponse`, `@ApiBody` decorators to the endpoint (per `openapi-docs-nestjs/TD-01` Revisions — explicit decorators required beyond the CLI plugin's automatic schema inference).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosService.createUploadSession` | Unit: rejects oversized/non-video input before calling MinIO (mock repo + mock MinIO client) | `src/videos/videos.service.spec.ts` |
| `VideosService.createUploadSession` | Integration: persists draft `Video` row with the correct `storageKey` | `src/videos/videos.service.integration-spec.ts` |

**Dependencies:** SI-03.2

**Acceptance criteria:**

- `POST /videos/upload-session` with a valid body returns `201` with `videoId`, `uploadUrl`, `expiresAt`, and `storageKey` matching `channels/{channelId}/videos/{videoId}.mp4`.
- `POST /videos/upload-session` persists a `Video` row with `status: draft` before returning the response.
- `POST /videos/upload-session` with `fileSizeBytes` exceeding 10GB returns `400` with `FILE_TOO_LARGE` and creates no `Video` row.
- `POST /videos/upload-session` with a non-video `contentType` returns `400` with `UNSUPPORTED_CONTENT_TYPE`.
- `POST /videos/upload-session` without a valid access token returns `401`.

---

### SI-03.5 — Upload Completion Notification Consumer

**Description:** Subscribe to MinIO's Redis upload-completion notification, transition the matching draft `Video` to `processing`, and enqueue the `process-video` job.

**Technical actions:**

1. Configure the MinIO bucket notification via `MINIO_NOTIFY_REDIS_*` env vars, publishing `s3:ObjectCreated:Put` events to Redis (per `phase-03-videos/TD-02`).
2. Create `src/videos/upload-notification.listener.ts` — subscribes to the configured Redis channel/list on module init, parses the notification's object key back to `videoId`.
3. On receipt, `VideosService.markProcessing(videoId)`: transitions `Video.status` from `draft` to `processing`, then `queue.add('process-video', { videoId })` (per `phase-03-videos/TD-01`, `phase-03-videos/TD-02`, `phase-03-videos/TD-06`).
4. Register the listener as a provider in `VideosModule`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosService.markProcessing` | Integration: transitions status `draft`→`processing` and enqueues the job (real Redis + Bull in Docker) | `src/videos/videos.service.integration-spec.ts` |

**Dependencies:** SI-03.2, SI-03.3

**Acceptance criteria:**

- A MinIO upload-completion notification for a known `draft` video's object key transitions that video's status to `processing` and enqueues a `process-video` job carrying the matching `videoId`.
- A notification for an object key with no matching draft video is ignored without throwing.

---

### SI-03.6 — Video Processor Worker (Metadata Extraction and Thumbnail Generation)

**Description:** Worker job processor that extracts video duration via `ffprobe`, generates a thumbnail via `ffmpeg`, uploads the thumbnail to MinIO, and finalizes the video's status.

**Technical actions:**

1. Create `src/videos/video-processor.service.ts` — `@Processor('video-processing')` with a `@Process('process-video')` handler receiving `Job<{ videoId: string }>`.
2. Run `execa('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', tmpFilePath])` and parse `format.duration` (per `phase-03-videos/TD-08`; `execa` in `library-refs.md`).
3. Run `execa('ffmpeg', ['-ss', '1', '-i', tmpFilePath, '-vframes', '1', thumbnailTmpPath])`, then upload the result to MinIO at `thumbnailKey` (per `phase-03-videos/TD-03`, `phase-03-videos/TD-07`, `phase-03-videos/TD-08`).
4. On success, update `Video`: `durationSeconds`, `thumbnailKey`, `fileSizeBytes`, `status: ready`. On `execa` failure (`ExecaError`), increment `processingAttempts`, set `lastError: error.stderr`, `status: error` (per `phase-03-videos/TD-06`, `phase-03-videos/TD-08`).
5. Register `VideoProcessorService` as a provider consumed by the worker bootstrap (`src/worker.main.ts`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideoProcessorService` | Integration: real `ffprobe`/`ffmpeg` invocation via `execa` against a fixture video — extracts duration, generates thumbnail, transitions to `ready` | `src/videos/video-processor.service.integration-spec.ts` |
| `VideoProcessorService` | Integration: `ffmpeg`/`ffprobe` failure (corrupt fixture) sets `status: error`, increments `processingAttempts`, records `lastError` from `ExecaError.stderr` | `src/videos/video-processor.service.integration-spec.ts` |

**Dependencies:** SI-03.3, SI-03.5

**Acceptance criteria:**

- Processing a valid uploaded video sets `durationSeconds` to the video's actual duration, `thumbnailKey` to a valid object key, `fileSizeBytes` to the object's actual size, and `status: ready`.
- Processing a corrupt or non-video file sets `status: error`, increments `processingAttempts` by `1`, and records `lastError` with the captured `ffmpeg`/`ffprobe` stderr output.
- No automatic retry occurs after a processing failure — the job does not requeue itself.

---

### SI-03.7 — Endpoint GET /videos/:id/stream

**Route:** GET /videos/:id/stream
**Test Specs:** see `nestjs-project/specs/videos-stream.plan.md`
**Authorization:** Anonymous

**Description:** Implement the streaming/download endpoint — serves the video from MinIO via HTTP Range Requests, supporting both partial (playback/seek) and full (download) responses.

**Technical actions:**

1. Add `VideosService.getStreamableVideo(id)`: look up the video, throw `VideoNotFoundException` if missing, throw `VideoNotReadyException` if `status !== 'ready'` (per `phase-03-videos/TD-06`).
2. On `Range` header present, parse `bytes=start-end`, call MinIO `getPartialObject(bucket, storageKey, start, length)`, return `206` with `Content-Range`/`Content-Length`/`Accept-Ranges` (per `phase-03-videos/TD-04`, `phase-03-videos/TD-07`; `minio` in `library-refs.md`).
3. On `Range` header absent, call MinIO `getObject(bucket, storageKey)`, return `200` with the full stream (per `phase-03-videos/TD-04`).
4. Add `@Get(':id/stream')` to `VideosController` — no auth guard (public, per Authorization Matrix) — piping the MinIO stream to the HTTP response.
5. Add `@ApiOperation`, `@ApiResponse`, `@ApiParam` decorators (per `openapi-docs-nestjs/TD-01` Revisions).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosService.getStreamableVideo` | Unit: throws `VideoNotFoundException`/`VideoNotReadyException` per status (mock repo) | `src/videos/videos.service.spec.ts` |

**Dependencies:** SI-03.2, SI-03.6

**Acceptance criteria:**

- `GET /videos/:id/stream` for a `ready` video without a `Range` header returns `200` with the full video byte stream.
- `GET /videos/:id/stream` for a `ready` video with a valid `Range` header returns `206` with the requested byte range and a correct `Content-Range` header.
- `GET /videos/:id/stream` for a non-existent video id returns `404` with `VIDEO_NOT_FOUND`.
- `GET /videos/:id/stream` for a video whose status is not `ready` returns `409` with `VIDEO_NOT_READY`.
- `GET /videos/:id/stream` is reachable without an `Authorization` header (anonymous access succeeds).

---

## Technical Specifications

### Data Model

#### Video

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, default `gen_random_uuid()` *(per phase-03-videos/TD-05)* |
| channelId | uuid | FK → `Channel.id`, not null *(per phase-03-videos/TD-07 — object keys are namespaced by channel)* |
| status | enum(`draft`, `processing`, `ready`, `error`) | not null, default `draft` *(per phase-03-videos/TD-06)* |
| storageKey | varchar | not null — object key `channels/{channelId}/videos/{id}.mp4` *(per phase-03-videos/TD-07)* |
| thumbnailKey | varchar | nullable — object key `channels/{channelId}/thumbnails/{id}.jpg`, populated once processing succeeds *(per phase-03-videos/TD-07, phase-03-videos/TD-03)* |
| durationSeconds | integer | nullable — populated by `ffprobe` metadata extraction *(per phase-03-videos/TD-08)* |
| fileSizeBytes | bigint | nullable — filled with the actual uploaded size once the MinIO→Redis upload-completion notification is received *(per phase-03-videos/TD-02)* |
| processingAttempts | integer | not null, default `0` *(per phase-03-videos/TD-06)* |
| lastError | text | nullable — populated from the worker's captured error output on failure *(per phase-03-videos/TD-06, phase-03-videos/TD-08)* |
| createdAt | timestamptz | default `now()` |
| updatedAt | timestamptz | default `now()`, auto-updated on write |

**Relations:** `Video` belongs to `Channel` (many-to-one); `Channel` (inherited from phase-02-auth) is not modified by this phase.
**Indexes:** index on `channelId`; index on `status`.

### API Contracts

#### POST /videos/upload-session (SI-03.4)

**Request headers:**
- Authorization: Bearer {accessToken} — required (per phase-02-auth/TD-02 JWT access guard)
- Content-Type: application/json

**Request body:**
- fileName: string, required
- contentType: string, required — must be a video MIME type (e.g. `video/mp4`)
- fileSizeBytes: number, required — must not exceed 10GB (`10 * 1024^3` bytes) *(per phase-03-videos/TD-02)*

**Response 201:**
- videoId: string (uuid) *(per phase-03-videos/TD-05)*
- uploadUrl: string — MinIO presigned PUT URL, TTL ~2 hours *(per phase-03-videos/TD-02)*
- expiresAt: string (ISO-8601)
- storageKey: string — `channels/{channelId}/videos/{videoId}.mp4` *(per phase-03-videos/TD-07)*

**Error responses:**
- 400 FILE_TOO_LARGE: fileSizeBytes exceeds the 10GB cap
- 400 UNSUPPORTED_CONTENT_TYPE: contentType is not a supported video MIME type
- 401 UNAUTHENTICATED: missing or invalid access token *(per phase-02-auth/TD-02, phase-02-auth/TD-07 error envelope)*

---

#### GET /videos/:id/stream (SI-03.7)

**Request headers:**
- Range: bytes={start}-{end} — optional; absent → full content with `200`, present → partial content with `206` *(per phase-03-videos/TD-04)*

**Response 200:** Full byte stream. `Content-Type: video/*`, `Content-Length`, `Accept-Ranges: bytes`. Returned when no `Range` header is sent (used for direct download as well as playback — same mechanism per phase-03-videos/TD-04).

**Response 206:** Partial content. `Content-Range: bytes {start}-{end}/{total}`, `Content-Length`, `Accept-Ranges: bytes`.

**Error responses:**
- 404 VIDEO_NOT_FOUND: no video exists with the given id
- 409 VIDEO_NOT_READY: video status is not `ready` (still `draft`, `processing`, or terminal `error`) *(per phase-03-videos/TD-06)*
- 416 RANGE_NOT_SATISFIABLE: the requested byte range is outside the video's actual size

---

### Authorization Matrix

| Endpoint | Anonymous | Authenticated | Owner |
|----------|-----------|----------------|-------|
| POST /videos/upload-session | ✗ | ✓ | ✓ *(video is created under the caller's own channel — per phase-02-auth's one-channel-per-user model)* |
| GET /videos/:id/stream | ✓ | ✓ | ✓ *(public playback/download — matches project overview: anonymous users watch freely)* |

### Error Catalog

_Uses the custom domain exception filter envelope established by phase-02-auth/TD-07 (`{ statusCode, error, message }`)._

| errorCode | HTTP | Trigger |
|-----------|------|---------|
| FILE_TOO_LARGE | 400 | Upload session requested with `fileSizeBytes` exceeding the 10GB cap |
| UNSUPPORTED_CONTENT_TYPE | 400 | Upload session requested with a non-video `contentType` |
| VIDEO_NOT_FOUND | 404 | Requested video id does not exist |
| VIDEO_NOT_READY | 409 | Stream/download requested before processing completes (status `draft`, `processing`, or `error`) |
| RANGE_NOT_SATISFIABLE | 416 | `Range` header requests bytes outside the video's actual size |

### Events/Messages

#### minio-upload-notification

**Payload:**

```json
{ "EventName": "s3:ObjectCreated:Put", "Key": "streamtube-videos/channels/{channelId}/videos/{videoId}.mp4", "Records": [ "..." ] }
```

**Producer:** MinIO (native bucket notification via `MINIO_NOTIFY_REDIS_*` config — not application code) (per `phase-03-videos/TD-02`)
**Consumer:** Backend Redis subscriber, SI-03.5 (per `phase-03-videos/TD-02`)
**Trigger:** The client's PUT to the presigned upload URL completes successfully.
**Delivery semantics:** best-effort (native MinIO Redis notification target; no NestJS-level retry) (per `phase-03-videos/TD-02`)

---

#### process-video (Bull job, `video-processing` queue)

**Payload:**

```json
{ "videoId": "uuid" }
```

**Producer:** Backend Redis subscriber, SI-03.5 — enqueues on receipt of the `minio-upload-notification` event, transitioning the video from `draft` to `processing` (per `phase-03-videos/TD-01`, `phase-03-videos/TD-02`)
**Consumer:** Worker container's video processor, SI-03.6 — runs `ffprobe`/`ffmpeg` via `execa` (per `phase-03-videos/TD-03`, `phase-03-videos/TD-08`)
**Trigger:** `minio-upload-notification` received for a `draft` video.
**Delivery semantics:** at-least-once (Bull default). No automatic retry on job failure — the video transitions to the terminal `error` state instead; `processingAttempts` and `lastError` are recorded (per `phase-03-videos/TD-06`)

---

<!-- phase-a-complete -->

## Dependency Map

```
SI-03.1 (root)
├── SI-03.2 — depends on SI-03.1 (config + Docker services must exist before entity/migration)
│   ├── SI-03.4 — depends on SI-03.2 (entity must exist before upload-session endpoint)
│   ├── SI-03.5 — depends on SI-03.2, SI-03.3 (entity + queue must exist before the notification consumer)
│   └── SI-03.7 — depends on SI-03.2, SI-03.6 (entity + processor must exist before the streaming endpoint)
└── SI-03.3 — depends on SI-03.1 (config + Docker services must exist before Bull/worker wiring)
    ├── SI-03.5 — depends on SI-03.2, SI-03.3 (see above)
    └── SI-03.6 — depends on SI-03.3, SI-03.5 (worker + notification consumer must exist before the processor)
```

---

## Deliverables

- [x] SI-03.1 — Infra: Dependencies, Configuration Namespaces, and Docker Compose
- [x] SI-03.2 — Video Entity and Migration
- [x] SI-03.3 — Bull Queue Module and Worker Bootstrap
- [x] SI-03.4 — Endpoint POST /videos/upload-session
- [x] SI-03.5 — Upload Completion Notification Consumer
- [x] SI-03.6 — Video Processor Worker (Metadata Extraction and Thumbnail Generation)
- [x] SI-03.7 — Endpoint GET /videos/:id/stream

**Full test suites:**

- [x] Backend tests pass (`docker compose exec nestjs-api npm test -- --runInBand`)
- [x] E2E tests pass (`docker compose exec nestjs-api npm run test:e2e`)
- [x] Type/compilation checks pass (`docker compose exec nestjs-api npx tsc --noEmit`)
