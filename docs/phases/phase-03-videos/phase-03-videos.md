---
kind: phase-plan
name: phase-03-videos
test_specs_aware: true
created_at: 2026-07-31
status: in-progress
---

# phase-03-videos — Implementation Plan

## Phase Overview

**Fase 03: Upload e Processamento de Vídeos**

This phase delivers the core video upload, storage, and asynchronous processing infrastructure for StreamTube. It covers:
- Presigned URL upload flow (10GB files without API memory overhead)
- Job queue setup (Redis + Bull) for background video processing
- Dedicated worker container (FFmpeg metadata extraction, thumbnail generation)
- HTTP Range-based streaming (seekable playback)
- Video status lifecycle (draft → processing → ready/error)
- Object storage organization (MinIO with hierarchical structure)

**Affected Subprojects:**
- `nestjs-project` — Backend API, video entity, upload endpoints, job queue, worker consumer, streaming endpoints
- `next-frontend` — Deferred; UI surfaces come in later phases

---

## Step Implementations

<!-- SIs will be written in Phase B -->

1. **SI-03.1: Infrastructure Setup** — Redis, MinIO, Docker Compose updates, environment configuration
2. **SI-03.2: Video Entity + Database Migration** — PostgreSQL video table, status enum, relationships to channels
3. **SI-03.3: Upload Endpoint (Presigned URL Flow)** — POST `/videos/upload-session`, presigned URL generation, draft video creation
4. **SI-03.4: Job Queue Setup** — Bull queue module registration, @nestjs/bull integration, job schema
5. **SI-03.5: Video Worker** — Dedicated worker container, FFmpeg process, metadata extraction, thumbnail generation, status updates
6. **SI-03.6: Streaming & Download Endpoints** — GET `/videos/:id/stream` with Range requests, GET `/videos/:id/download`, Content-Range headers
7. **SI-03.7: Test Coverage** — Unit + integration + e2e tests for all components

---

## Technical Specifications

### Data Model

**Video Entity**

```typescript
// Video (stored in PostgreSQL)
{
  id: UUID (primary key, native PostgreSQL UUID type),
  channelId: UUID (foreign key to channels table),
  title: VARCHAR(500),
  description: TEXT (nullable),
  videoUrl: VARCHAR(1024) // S3/MinIO key: channels/{channelId}/videos/{id}.mp4
  thumbnailUrl: VARCHAR(1024) // S3/MinIO key: channels/{channelId}/thumbnails/{id}.jpg
  duration: INT (milliseconds, nullable until processing completes),
  metadata: JSONB (FFmpeg output: codec, bitrate, resolution, etc.),
  status: ENUM ['draft', 'processing', 'ready', 'error'],
  processingAttempts: INT (default 0, for future retry logic),
  lastError: TEXT (nullable, error message from processing),
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
}
```

**Database Migration:**

```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  video_url VARCHAR(1024),
  thumbnail_url VARCHAR(1024),
  duration INT,
  metadata JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  processing_attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_channel FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE INDEX idx_videos_channel_id ON videos(channel_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
```

**Status Lifecycle (4-State Machine):**
- `draft` — Video created, upload session initiated, not yet processed
- `processing` — Job enqueued or in-progress
- `ready` — Processing succeeded, video ready for playback
- `error` — Processing failed; awaiting manual retry or admin action

---

### API Contracts

**1. POST /videos/upload-session**

Create an upload session and get a presigned URL for direct client → MinIO upload.

```typescript
// Request (authenticated user required)
{
  title: string;
  description?: string;
}

// Response (201 Created)
{
  videoId: UUID;
  uploadUrl: string; // Presigned PUT URL (valid 2 hours)
  videoKey: string; // Storage key: channels/{channelId}/videos/{videoId}.mp4
  expiresIn: number; // Seconds until presigned URL expires
  video: {
    id: UUID;
    title: string;
    status: 'draft';
    createdAt: ISO8601;
  }
}

// Error (400, 401, 403, 503)
{
  error: string;
  message: string;
}
```

**2. GET /videos/:id/stream**

Stream video file with Range request support (206 Partial Content).

```typescript
// Request headers (recommended)
Range: bytes=0-1048575  // Request first 1MB
Accept-Ranges: bytes

// Response (200 OK or 206 Partial Content)
HTTP/1.1 200 OK
Content-Type: video/mp4
Content-Length: 5368709120
Accept-Ranges: bytes
[full video file]

// OR partial response
HTTP/1.1 206 Partial Content
Content-Type: video/mp4
Content-Length: 1048576
Content-Range: bytes 0-1048575/5368709120
[requested byte range]

// Error (404, 503)
{
  error: string;
  message: string;
}
```

**3. GET /videos/:id/download**

Download video file (forces `Content-Disposition: attachment`).

```typescript
// Request
GET /videos/:id/download

// Response (200 OK)
HTTP/1.1 200 OK
Content-Type: video/mp4
Content-Disposition: attachment; filename="video-title.mp4"
Content-Length: 5368709120
[full video file]

// Error (404, 503)
{
  error: string;
  message: string;
}
```

**4. GET /videos/:id**

Fetch video metadata and status.

```typescript
// Request
GET /videos/:id

// Response (200 OK)
{
  id: UUID;
  channelId: UUID;
  title: string;
  description?: string;
  videoUrl: string; // S3 key
  thumbnailUrl?: string; // S3 key
  duration?: number; // milliseconds
  metadata?: {
    codec: string;
    bitrate: string;
    resolution: string;
    frameRate: string;
  };
  status: 'draft' | 'processing' | 'ready' | 'error';
  processingAttempts: number;
  lastError?: string;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// Error (404, 503)
{
  error: string;
  message: string;
}
```

---

### Authorization Matrix

| Endpoint | Method | Public? | Auth Required? | Ownership | Notes |
|----------|--------|---------|----------------|-----------|-------|
| `/videos/upload-session` | POST | No | Yes | Self | Only authenticated users can create upload sessions |
| `/videos/:id/stream` | GET | Yes (if status=ready) | No | — | Stream only ready videos; draft/error/processing are private |
| `/videos/:id/download` | GET | No | Yes | Self or Owner | Only authenticated users can download; future: check ownership or channel permissions |
| `/videos/:id` | GET | Yes (metadata only) | No | — | Public metadata fetch (returns only non-sensitive fields) |

**Inherited Auth Mechanisms (from Phase 02):**
- `@UseGuards(JwtAuthGuard)` — Validates JWT access token from `Authorization: Bearer` header
- `@IsPublic()` decorator — Exempts endpoints from auth checks
- Session-based refresh token rotation (PostgreSQL-backed)

---

### Error Catalog

**Domain Error Codes (via inherited Custom Exception Filter from Phase 02):**

| Status | Code | Message | Context |
|--------|------|---------|---------|
| 400 | VIDEO_INVALID_SIZE | File exceeds 10GB limit | Upload session creation |
| 400 | VIDEO_INVALID_TITLE | Title is empty or too long | Upload session validation |
| 409 | VIDEO_CONFLICT | Upload already in progress for this file | Rate limiting duplicate uploads |
| 422 | VIDEO_PROCESSING_FAILED | FFmpeg processing error: {details} | Worker job failure |
| 404 | VIDEO_NOT_FOUND | Video with ID {id} does not exist | Streaming, download, metadata fetch |
| 503 | VIDEO_STORAGE_UNAVAILABLE | MinIO/S3 service unreachable | Presigned URL generation, file streaming |
| 503 | QUEUE_SERVICE_UNAVAILABLE | Redis job queue unavailable | Job enqueue failure |

**Implementation Pattern (inherited from Phase 02):**
```typescript
throw new VideoException(
  'VIDEO_PROCESSING_FAILED',
  'FFmpeg stderr: ...',
  HttpStatus.UNPROCESSABLE_ENTITY
);
```

All exceptions are caught by `CustomExceptionFilter`, which transforms them to:
```json
{
  "statusCode": 422,
  "error": "VIDEO_PROCESSING_FAILED",
  "message": "FFmpeg stderr: ..."
}
```

---

### Events / Messages

**Job Queue Events (Bull + Redis):**

| Event | Source | Payload | Consumers |
|-------|--------|---------|-----------|
| `video.upload-initiated` | Upload controller | `{ videoId, uploadUrl, expiresAt }` | Logging, metrics (future) |
| `video.upload-completed` | Upload polling / S3 event | `{ videoId, fileSize, uploadedAt }` | Job enqueue (add to video-processing queue) |
| `video-processing:created` | Upload controller → Queue | `{ videoId, channelId, videoKey, thumbnailKey }` | Worker subscription |
| `video-processing:completed` | Worker job processor | `{ videoId, duration, metadata, thumbnailUrl, completedAt }` | DB update (status → ready), logging |
| `video-processing:failed` | Worker job error handler | `{ videoId, error, failedAt, attempt }` | DB update (status → error, lastError), retry schedule (future) |

**Implementation Pattern:**
```typescript
// Enqueue a job
const job = await this.videoQueue.add(
  'process-video',
  { videoId, videoKey, thumbnailKey },
  { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
);

// Process a job
@Processor('video-processing')
export class VideoWorker {
  @Process('process-video')
  async handleVideoProcessing(job: Job<ProcessVideoPayload>) {
    // FFmpeg calls, DB updates
  }

  @OnEvent('error')
  async handleJobError(error: Error) {
    // Retry scheduling, error logging
  }
}
```

---

### Dependency Map

**New Phase-03 Dependencies:**
- `@nestjs/bull@^11.x` — NestJS Bull queue module
- `bull@^5.x` — Underlying job queue library
- `minio@^8.x` — S3-compatible object storage SDK
- `redis` (Docker service) — Job queue backend
- `minio` (Docker service) — Object storage backend
- `ffmpeg` (in worker Docker image) — Video processing binary

**Inherited Dependencies (from prior phases):**
- Config: `@nestjs/config@^4.x`, `joi@^17.x`
- Auth: `@nestjs/jwt@^11.0.0`, `@nestjs/throttler@^6.x`
- Validation: `class-validator@^0.14.x`, `class-transformer@^0.5.x`
- Database: `TypeORM`, `PostgreSQL`

**Module Dependency Graph:**
```
VideoModule (new)
├─ VideosController (handles upload-session, stream, download, metadata endpoints)
├─ VideosService (business logic: presigned URL generation, status updates)
├─ BullModule.registerQueue({ name: 'video-processing' })
├─ TypeOrmModule.forFeature([Video])
├─ MinioClientModule (new, wraps minio SDK)
└─ [inherited] ConfigModule, AuthModule, ChannelsModule

WorkerModule (separate container, new)
├─ VideoWorker (@Processor('video-processing'))
├─ BullModule.registerQueue({ name: 'video-processing' })
├─ TypeOrmModule.forFeature([Video])
└─ FFmpegService (new, calls ffprobe / ffmpeg binaries)
```

---

### Deliverables

**Backend (nestjs-project):**
- [ ] Database migration: Video entity + status enum
- [ ] `src/entities/video.entity.ts` — TypeORM Video entity
- [ ] `src/modules/videos/` — Videos module with controller + service
- [ ] `src/modules/videos/controllers/videos.controller.ts`
- [ ] `src/modules/videos/services/videos.service.ts`
- [ ] `src/config/storage.config.ts` — MinIO configuration factory
- [ ] `src/config/queue.config.ts` — Redis/Bull configuration factory
- [ ] `src/modules/minio/` — MinIO client module (wraps SDK)
- [ ] Presigned URL generation via MinIO SDK
- [ ] `src/modules/worker/` — Video worker module (separate container)
- [ ] `src/modules/worker/processors/video.processor.ts` — FFmpeg integration
- [ ] `src/services/ffmpeg.service.ts` — FFmpeg wrapper (ffprobe, metadata extraction, thumbnail generation)
- [ ] GET `/videos/:id/stream` endpoint with Range request support
- [ ] GET `/videos/:id/download` endpoint
- [ ] GET `/videos/:id` metadata endpoint
- [ ] HTTP 206 Partial Content response handling
- [ ] Unit tests (videos service, controller, processor, ffmpeg service)
- [ ] Integration tests (DB + Redis + MinIO real)
- [ ] E2E test: full upload → process → stream workflow
- [ ] Environment variables documentation (REDIS_HOST, MINIO_ENDPOINT, etc.)

**Infrastructure:**
- [ ] `Dockerfile.worker` — Worker container (Node + FFmpeg)
- [ ] `docker-compose.yml` updates:
  - [ ] Redis service
  - [ ] MinIO service
  - [ ] Worker service
- [ ] `.env` updates with queue and storage config
- [ ] `src/config/env.validation.ts` updates (new env vars for Redis, MinIO)

**Frontend (next-frontend):**
- Deferred to later phase; no UI delivery in phase-03

---

## Dependency Map (Detailed)

### NPM Packages to Install

```bash
npm install --save @nestjs/bull bull minio
npm install --save-dev @types/minio
```

### Docker Services to Configure

**Redis (Job Queue Backend)**
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

**MinIO (Object Storage)**
```yaml
minio:
  image: minio/minio:latest
  ports:
    - "9000:9000"
    - "9001:9001"  # Console UI
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  command: server /data --console-address ":9001"
  volumes:
    - minio_data:/data
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 20s
    retries: 3
```

**Video Worker Container**
```yaml
worker:
  build:
    context: ./nestjs-project
    dockerfile: Dockerfile.worker
  depends_on:
    - db
    - redis
    - minio
  environment:
    - NODE_ENV=development
    - DATABASE_URL=postgresql://user:pass@db:5432/streamtube
    - REDIS_HOST=redis
    - REDIS_PORT=6379
    - MINIO_ENDPOINT=minio:9000
    - MINIO_REGION=us-east-1
    - MINIO_ACCESS_KEY=minioadmin
    - MINIO_SECRET_KEY=minioadmin
    - MINIO_USE_SSL=false
```

### Environment Variables

**Add to `.env`:**
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

**Add to `src/config/env.validation.ts`:**
```typescript
REDIS_HOST: Joi.string().default('redis'),
REDIS_PORT: Joi.number().default(6379),
MINIO_ENDPOINT: Joi.string().required(),
MINIO_REGION: Joi.string().default('us-east-1'),
MINIO_ACCESS_KEY: Joi.string().required(),
MINIO_SECRET_KEY: Joi.string().required(),
MINIO_USE_SSL: Joi.boolean().default(false),
```

---

## Inherited Conventions to Match

**Configuration Pattern (from Phase 01):**
- Use `@nestjs/config` with `registerAs()` factory pattern
- Create `src/config/queue.config.ts` and `src/config/storage.config.ts` as namespaced factories
- Inject via `@Inject(queueConfig.KEY)` with `ConfigType<typeof queueConfig>`
- Both factories are dual-purpose: importable as plain functions for non-DI contexts + DI injection tokens

**Error Handling Pattern (from Phase 02):**
- Use custom `VideoException` extending `DomainException`
- Throw with domain error codes: `'VIDEO_PROCESSING_FAILED'`, `'VIDEO_NOT_FOUND'`, etc.
- Caught by global `CustomExceptionFilter` and transformed to standard JSON response

**Auth Pattern (from Phase 02):**
- Use `@UseGuards(JwtAuthGuard)` for protected endpoints
- Use `@IsPublic()` for public endpoints (overrides guard)
- Auth user is available via `@User() user: { userId: UUID }` parameter

**DTO Validation (from Phase 02):**
- Use `class-validator` decorators on DTOs
- Validation pipes handle request transformation automatically

**Database Pattern (from Phase 01):**
- Use TypeORM with `@Column`, `@PrimaryGeneratedColumn`, `@ManyToOne`, etc.
- Follow entity naming: singular (`Video`, not `Videos`)
- TypeORM `autoLoadEntities: true` in AppModule

---

## Testing Requirements (from context.md)

### nestjs-project

| Artifact | Unit | Integration | E2E |
|----------|------|-------------|-----|
| Video entity + migration | ✓ | ✓ (DB real) | — |
| Upload controller + service | ✓ | ✓ (MinIO presigned URL mocked via MSW) | — |
| Queue service (Bull) | ✓ | ✓ (Redis real) | — |
| Video worker (FFmpeg) | ✓ | ✓ (container real) | — |
| Streaming endpoint (Range) | ✓ | ✓ | — |
| E2E workflow | — | — | ✓ (full cycle: upload → queue → process → stream) |

**Test Patterns Inherited:**
- MSW for HTTP mocking (MinIO presigned URL generation)
- TypeORM repositories for DB integration tests
- @nestjs/testing for module setup
- jest for test runner and assertions

---

<!-- phase-a-complete -->
