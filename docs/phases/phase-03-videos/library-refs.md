---
kind: library-refs
phase: phase-03-videos
generated: 2026-07-31
sources:
  - docs/decisions/technical-decisions-phase-03-videos.md (pending TDs: 7)
  - docs/decisions/technical-decisions-phase-01-configuracao-base.md (inherited: 4 TDs)
  - docs/decisions/technical-decisions-phase-02-auth.md (inherited: 10 TDs)
  - docs/decisions/technical-decisions-phase-02-auth-frontend.md (inherited: 7 TDs, deferred)
---

# Library References — Fase 03: Upload e Processamento de Vídeos

**Generated:** 2026-07-31  
**Phase:** phase-03-videos  
**Status:** Comprehensive library registry (phase-03 TDs pending; inherited TDs decided)

---

## Summary

**Phase-03 introduces:**
- `@nestjs/bull@^11.x` (job queue integration; NestJS module wrapper for Bull)
- `bull@^5.x` (Node.js job queue library for Redis)
- `minio@^8.x` (MinIO/S3 SDK for file upload and presigned URL generation)

**Inherited (already in stack):**
- Config: `@nestjs/config@^4.x`, `joi@^17.x`, `dotenv`
- Auth: `@nestjs/jwt@^11.0.0`, `argon2@^0.41.x`, `@nestjs-modules/mailer@^2.x`, `handlebars@^4.x`, `@nestjs/throttler@^6.x`
- Validation: `class-validator@^0.14.x`, `class-transformer@^0.5.x`
- Frontend deferred (no new deps in phase-03 scope)

**Infrastructure (Docker services, not npm):**
- Redis (job queue backend; container image)
- MinIO (S3-compatible object storage; container image)
- FFmpeg (video processing; installed in worker container)

---

## Library Catalog

### Phase-03 Direct Dependencies

#### @nestjs/bull

- **TD Reference:** phase-03-videos/TD-01 (Job Queue Technology)
- **Recommendation:** Option A (Redis + Bull)
- **Purpose:** NestJS module wrapper for Bull queue library; provides decorators (`@Process`, `@OnEvent`), dependency injection for queues, and integration with NestJS lifecycle.
- **Version:** `^11.x` (NestJS 11 compatible)
- **Installation:** `npm install --save @nestjs/bull bull`
- **Usage Pattern:**
  ```typescript
  // Queue registration in a module
  import { BullModule } from '@nestjs/bull';
  
  @Module({
    imports: [BullModule.registerQueue({ name: 'video-processing' })],
  })
  export class VideoModule {}
  
  // Consumer in a service
  @Processor('video-processing')
  export class VideoWorker {
    @Process()
    async processVideo(job: Job<VideoProcessingPayload>) {
      // FFmpeg calls, metadata extraction, thumbnail generation
    }
  }
  ```
- **Notes:**
  - Requires Redis running (provided by Docker Compose service `redis`)
  - Worker can run in-process or in a separate container (TD-03 recommends separate container)
  - Automatic retry logic built-in via `job.attempts()`

#### bull

- **TD Reference:** phase-03-videos/TD-01
- **Purpose:** Underlying job queue library; manages Redis-based queue storage, job lifecycle, retry logic.
- **Version:** `^5.x`
- **Installation:** Installed as a dependency of `@nestjs/bull`
- **Usage:** Typically accessed via `@nestjs/bull` module; direct usage limited to advanced scenarios.

#### minio

- **TD Reference:** phase-03-videos/TD-02 (Upload Strategy), phase-03-videos/TD-07 (Storage Organization)
- **Purpose:** S3-compatible SDK for MinIO; generates presigned URLs, manages uploads/downloads, creates buckets.
- **Version:** `^8.x`
- **Installation:** `npm install --save minio`
- **Usage Pattern:**
  ```typescript
  import * as Minio from 'minio';
  
  const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
  });
  
  // Generate presigned URL for client upload
  const url = await minioClient.presignedPutObject(
    'streamtube-videos',
    `channels/${channelId}/videos/${videoId}.mp4`,
    2 * 60 * 60 // 2-hour expiration
  );
  ```
- **Notes:**
  - Requires MinIO running (Docker Compose service `minio`)
  - Presigned URL approach (TD-02) avoids direct client → API → MinIO hop
  - Path structure follows TD-07 recommendation: `channels/{channel_id}/videos/{video_id}.*`

### Inherited Dependencies

All libraries from phase-01, phase-02-auth, and phase-02-auth-frontend remain in the stack. Phase-03 does not override or conflict with any inherited TDs.

#### From phase-01-configuracao-base

| TD | Library | Version | Purpose |
|----|----|---------|---------|
| TD-01 | `@nestjs/config` | `^4.x` | Config module registration + factory pattern |
| TD-02 | `joi` | `^17.x` | Env variable validation at startup |
| TD-04 | `dotenv` | (transitive) | Load `.env` file (used by `data-source.ts` for TypeORM CLI) |

**Notes:**
- Phase-03 adds new config keys to `src/config/env.validation.ts`: `REDIS_HOST`, `REDIS_PORT`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_REGION`.
- Storage and queue configs follow the namespaced pattern: `src/config/storage.config.ts`, `src/config/queue.config.ts`.

#### From phase-02-auth

| TD | Library | Version | Purpose |
|----|----|---------|---------|
| TD-01 | `argon2` | `^0.41.x` | Password hashing (auth system) |
| TD-02 / TD-09 | `@nestjs/jwt` | `^11.0.0` | JWT signing + verification for access/refresh tokens |
| TD-05 | `@nestjs-modules/mailer` | `^2.x` | Email service integration (SMTP) |
| TD-05 | `handlebars` | `^4.x` | Email template rendering |
| TD-06 | `class-validator` | `^0.14.x` | DTO validation via decorators |
| TD-06 | `class-transformer` | `^0.5.x` | DTO transformation and serialization |
| TD-08 | `@nestjs/throttler` | `^6.x` | Rate limiting on auth routes |

**Notes:**
- Phase-03 inherits auth infrastructure; no new auth decisions in this phase.
- DTOs for video upload / download continue using `class-validator`.

#### From phase-02-auth-frontend (Deferred)

- `iron-session` (frontend, deferred to later phase)
- `react-hook-form` (frontend, deferred)
- `@hookform/resolvers` (frontend, deferred)

**Notes:**
- Phase-03 defers frontend UI; these libraries are not yet in scope.
- Backend API endpoints (POST `/videos/upload`, GET `/videos/:id/stream`) are agnostic to frontend form library.

### Infrastructure Dependencies (Docker Services, Not npm)

| Service | Purpose | Docker Image | Notes |
|---------|---------|--------------|-------|
| Redis | Job queue backend (Bull) | `redis:7-alpine` | Stores job queue; used by TD-01 |
| MinIO | S3-compatible object storage | `minio/minio:latest` | Stores video files and thumbnails; used by TD-02, TD-07 |
| FFmpeg | Video metadata + thumbnail extraction | Installed in worker Dockerfile | Runs in dedicated worker container (TD-03) |

---

## Configuration Requirements

### Environment Variables (add to `.env` and `src/config/env.validation.ts`)

```bash
# Job Queue (Redis)
REDIS_HOST=redis
REDIS_PORT=6379

# Object Storage (MinIO)
MINIO_ENDPOINT=minio:9000
MINIO_REGION=us-east-1
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
```

### Docker Compose Services (add to `docker-compose.yml`)

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

  worker:
    build:
      context: ./nestjs-project
      dockerfile: Dockerfile.worker
    depends_on:
      - db
      - redis
      - minio
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin

volumes:
  minio_data:
```

### FFmpeg in Worker Dockerfile

```dockerfile
FROM node:22-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "dist/worker/main.js"]
```

---

## Dependency Graph

```
phase-03-videos
├─ @nestjs/bull ^11.x (job queue module)
│  └─ bull ^5.x (job queue library)
│     └─ redis (infrastructure service)
│
├─ minio ^8.x (S3-compatible object storage client)
│  └─ minio:9000 (infrastructure service)
│
├─ (inherited) @nestjs/config ^4.x
│  └─ joi ^17.x
│     └─ dotenv
│
├─ (inherited) @nestjs/jwt ^11.0.0 (auth)
├─ (inherited) argon2 ^0.41.x
├─ (inherited) @nestjs-modules/mailer @2.x
│  └─ handlebars ^4.x
├─ (inherited) @nestjs/throttler ^6.x
├─ (inherited) class-validator ^0.14.x
└─ (inherited) class-transformer ^0.5.x
```

---

## Versions Summary

| Lib | Current in Stack | Phase-03 Req | Status |
|-----|------------------|------------|--------|
| @nestjs/bull | — | ^11.x | NEW |
| bull | — | ^5.x | NEW |
| minio | — | ^8.x | NEW |
| @nestjs/config | ^4.x | ^4.x | ✓ Inherited |
| joi | ^17.x | ^17.x | ✓ Inherited |
| @nestjs/jwt | ^11.0.0 | ^11.0.0 | ✓ Inherited |
| argon2 | ^0.41.x | ^0.41.x | ✓ Inherited |
| @nestjs-modules/mailer | ^2.x | ^2.x | ✓ Inherited |
| handlebars | ^4.x | ^4.x | ✓ Inherited |
| @nestjs/throttler | ^6.x | ^6.x | ✓ Inherited |
| class-validator | ^0.14.x | ^0.14.x | ✓ Inherited |
| class-transformer | ^0.5.x | ^0.5.x | ✓ Inherited |

---

## Installation Instructions

### Step 1: Add npm packages

```bash
cd nestjs-project
npm install --save @nestjs/bull bull minio
npm install --save-dev @types/minio
```

### Step 2: Update `.env` with Redis and MinIO config

```bash
# Copy the environment variables section above to `.env`
REDIS_HOST=redis
REDIS_PORT=6379
MINIO_ENDPOINT=minio:9000
# ... etc
```

### Step 3: Update `docker-compose.yml` with Redis, MinIO, and Worker services

(See Docker Compose Services section above)

### Step 4: Create config factories

- `src/config/queue.config.ts` — Redis + Bull config (following namespaced pattern from phase-01)
- `src/config/storage.config.ts` — MinIO config

### Step 5: Create worker container

- `Dockerfile.worker` — Worker image with Node + FFmpeg

---

## Library Documentation Links

- **@nestjs/bull:** https://docs.nestjs.com/techniques/queues
- **bull:** https://github.com/OptimalBits/bull
- **minio:** https://min.io/docs/javascript/API.html
- **Redis:** https://redis.io/docs/
- **FFmpeg:** https://ffmpeg.org/documentation.html

---

## Notes for Implementation

1. **Presigned URL flow (TD-02):** MinIO SDK `presignedPutObject()` generates time-limited URLs; client uploads directly to MinIO without routing through the API.
2. **Job queue flow (TD-01 + TD-03):** Jobs are enqueued in the API (video upload handler), consumed by the worker (separate container). Bull manages retries and job lifecycle automatically.
3. **Config pattern (phase-01 inherited):** Follow `registerAs()` factory pattern; inject via `@Inject(queueConfig.KEY)`.
4. **Streaming (TD-04):** NestJS `StreamableFile` with HTTP Range header support (no new libs needed).
5. **Video ID (TD-05):** Use PostgreSQL native UUID type; no new libs needed.
6. **Status lifecycle (TD-06):** Simple 4-state enum (draft, processing, ready, error); no new libs needed.

---

**Next Steps:**

1. Install phase-03 libraries: `npm install --save @nestjs/bull bull minio`
2. Run `/plan-decide phase-03-videos` to finalize the 7 pending TDs into formal decisions.
3. Update `docs/phases/phase-03-videos/context.md` with Decisions Detail section (via `/plan-context`).
4. Run `/plan-build phase-03-videos` to generate Technical Actions and implementation tasks.

---

**Generated by:** plan-resolve (library-cache-only mode)  
**Date:** 2026-07-31
