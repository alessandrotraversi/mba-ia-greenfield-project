---
scope_type: phase
related_phases: [3]
status: pending
date: 2026-07-31
scope_description: "Backend foundation for video upload, storage, and asynchronous processing: queue technology, upload strategy for 10GB files, video worker infrastructure, streaming protocol, URL generation, video status lifecycle, and storage organization."
---

# Technical Decisions — Fase 03: Upload e Processamento de Vídeos

_Subprojects in scope:_

- `nestjs-project/` — backend that delivers video upload endpoints, queue integration, worker consumer setup, streaming/download endpoints, and database schema for videos.
- `next-frontend/` — Frontend deferred. Video upload UI, player, and streaming features will be addressed in future phases when frontend video support is prioritized. No open technical decision in this document.

---

## TD-01: Job Queue Technology

**Scope:** Backend

**Capability:** Serviço de processamento em segundo plano (filas), Processamento automático do vídeo após upload (extração de duração e metadados), Geração automática de thumbnail a partir de um frame do vídeo

**Context:** After a video is uploaded, processing (FFmpeg extraction, thumbnail generation, metadata capture) must run asynchronously without blocking the API. The project architecture diagram marks the queue as "TBD". The choice of queue technology affects:
- How jobs are enqueued, retried, and consumed
- Whether the worker runs in-process or in a separate container
- Scalability (single worker vs. multiple workers)
- Testability in Docker Compose (real infrastructure vs. mocks)
- Integration with NestJS via @nestjs/bull or equivalent

**Options:**

### Option A: Redis + Bull (@nestjs/bull)
- Bull is a mature Node.js job queue library built on Redis. @nestjs/bull provides native NestJS integration with dependency injection and module registration.
- Worker subscribes to job events and processes them. Jobs are stored in Redis with automatic persistence (RDB snapshots). Built-in retry logic, rate limiting, and job lifecycle management.
- **Pros:** Lightweight (Redis image ~10MB), NestJS-native integration via @nestjs/bull, testes reais no Docker (Redis container), simple to prototype, no complex routing needed for MVP, scales to thousands of jobs per second. Excellent documentation for NestJS projects. No separate infrastructure beyond Redis.
- **Cons:** Single-instance Redis can become a bottleneck at extreme scale (millions of concurrent jobs); no built-in persistence guarantees between restarts (mitigated by RDB), less feature-rich than RabbitMQ (no message routing, advanced acknowledgment patterns). Redis failure = job queue down.

### Option B: RabbitMQ (@golevelup/nestjs-rabbitmq or manual amqp-connection-manager)
- Full message broker with persistent queues, routing, and acknowledgment guarantees. RabbitMQ stores messages durably; can survive restarts. @golevelup/nestjs-rabbitmq provides NestJS integration, but is less mature than @nestjs/bull. Manual setup via amqp-connection-manager also possible.
- **Pros:** Enterprise-grade reliability, persistent message storage, advanced routing (topic exchanges, dead-letter queues), multiple consumers with load balancing, redelivery guarantees, monitoring/management UI. Scales to millions of messages per second. True message persistence — no job loss on restart.
- **Cons:** Heavier footprint (RabbitMQ image ~50MB), more complex configuration (vhosts, exchanges, queues, bindings), steeper NestJS integration learning curve, overkill complexity for MVP phase, additional container resource overhead in dev/CI.

### Option C: AWS SQS (managed)
- Fully managed message queue service. No local operation or container setup. Client library (@aws-sdk/client-sqs) handles enqueue/dequeue.
- **Pros:** Zero operational overhead, autoscales elastically, AWS-native (production path on AWS), DLQ built-in.
- **Cons:** Requires AWS credentials in development environment, not testable in Docker Compose without mocking/LocalStack, network latency vs. local Redis, monthly cost even for low volume, vendor lock-in. Breaks the "everything in Docker Compose locally" pattern.

**Recommendation:** **Option A (Redis + Bull)** — For an MVP and greenfield project, Redis + Bull offers the optimal balance of simplicity, testability, and scalability. The project already uses PostgreSQL in Docker, so adding a Redis container is a negligible operational step. Bull's NestJS integration (@nestjs/bull) is mature and well-documented. Job processing in Fase 03 is not at scale that requires RabbitMQ's advanced features. If job volume grows to millions per day (Fase 04+), migration to RabbitMQ is straightforward — Bull's API translates cleanly to RabbitMQ via @golevelup. AWS SQS breaks the local Docker workflow and adds unnecessary complexity and cost for development.

**Decision:** _[pending]_

---

## TD-02: Upload Strategy for 10GB Files

**Scope:** Backend

**Capability:** Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance, Pré-cadastro automático do vídeo como rascunho ao iniciar o upload

**Context:** A 10GB file cannot be uploaded through the API request body without exhausting server memory and blocking the API for the duration of the upload. The upload must be non-blocking; the API should return immediately with a draft video record, and the file should be persisted separately (to MinIO/S3). Three main strategies exist:
- **Presigned URL:** client uploads directly to object storage with a time-limited, permission-limited URL issued by the backend.
- **Multipart via API:** frontend chunks the file and sends chunks to the API sequentially; API aggregates and sends to storage.
- **Streaming to storage:** frontend streams directly to API; API pipes to storage without buffering (advanced, less common).

**Options:**

### Option A: Presigned URL (S3/MinIO) — Direct Client → Storage Upload
- Backend generates a presigned URL (valid for 2 hours) that grants PUT access to MinIO for a specific object key and size limit. Frontend obtains this URL via `POST /videos/upload-session`, then uses HTTP PUT directly to MinIO with the file. Backend records a draft video in DB immediately (step 1); MinIO webhook or polling detects upload completion (step 2) and enqueues a processing job.
- **Pros:** Zero bytes of the 10GB file pass through the API — no memory impact, no bandwidth waste, massively scalable. Aligns with AWS S3 standard workflow (industry pattern). Frontend can report upload progress directly to MinIO. Easy to test with local MinIO container. Presigned URL is stateless (no token DB needed).
- **Cons:** Requires MinIO presigned URL implementation (minor SDK work); frontend must handle redirected S3 errors; webhook/polling adds complexity (either implement S3 event notifications, or poll MinIO API for upload completion status). Upload can timeout if connection is unstable (URL TTL ~2h, but network reconnect is lossy). Slightly more frontend coordination.

### Option B: Multipart Upload via API (chunked)
- Frontend chunks the 10GB file into 10-100MB pieces. For each chunk, `POST /videos/:videoId/chunks` with chunk number, size, and binary data. API buffers each chunk temporarily, aggregates to MinIO. Backend creates draft on first chunk; completes on last chunk.
- **Pros:** Full control in API (can validate chunk integrity, apply custom retry logic per chunk, track progress server-side). Easier to implement than presigned URL (no MinIO SDK integration). Resume friendly — client can retry individual chunks. Firebase/Supabase default pattern (familiar to many).
- **Cons:** API still processes 10GB (in chunks, but still 100MB+ RAM per concurrent upload). Slower due to API → MinIO hop (chunking introduces latency). More stateful (API must track partial uploads; needs cleanup job for abandoned uploads). Concurrent uploads compete for server resources. Memory footprint grows with concurrent uploads.

### Option C: Streaming to API (pipe to storage)
- Frontend opens an HTTP PUT stream to `PUT /videos/stream-upload` with the full 10GB body. NestJS pipes the incoming stream directly to MinIO without buffering (Node.js duplex streams).
- **Pros:** Zero memory overhead (true streaming). Simple API (single endpoint). Minimal code (native Node.js streams).
- **Cons:** Network fragility (single broken connection = full restart). Difficult to resume. Reaaly error handling (stream errors are hard to diagnose). Less maturity in NestJS tooling. Browser compatibility edge cases with very large PUT requests. Not industry-standard for web uploads.

**Recommendation:** **Option A (Presigned URL)** — Presigned URL is the industry standard for large-file uploads (AWS, Google Cloud, Figma, Dropbox). It eliminates API resource consumption entirely, making it infinitely scalable. MinIO SDK supports presigned URL generation natively. The callback/polling complexity is minimal — a simple polling loop or S3-event-based trigger suffices for MVP. The ~2-hour TTL is generous for typical user uploads. If network interruption is a concern (flaky mobile networks), Add resumable-upload support (TUS protocol) in a future phase; presigned URL can integrate with TUS clients.

**Decision:** _[pending]_

---

## TD-03: Video Worker Infrastructure

**Scope:** Backend

**Capability:** Processamento automático do vídeo após upload (extração de duração e metadados), Geração automática de thumbnail a partir de um frame do vídeo

**Context:** FFmpeg (or ffprobe for metadata extraction) must run somewhere to process the uploaded video. Two architectural choices:
- **Separate container (recommended production pattern):** Worker is a standalone NestJS+FFmpeg container that subscribes to the queue and processes jobs independently.
- **In-process worker:** Worker logic runs in the same NestJS container as the API, via @nestjs/bull's onProcess handlers.

**Options:**

### Option A: Dedicated Worker Container
- A separate Docker service (`worker`) built with Node + FFmpeg binaries + @nestjs/bull consumer. The worker subscribes to the Redis queue, pulls jobs, processes them (FFmpeg calls), updates job status and DB. Multiple worker replicas can be spun up independently for horizontal scaling.
- **Pros:** API remains responsive during video processing (no CPU contention). Worker can be scaled independently (`docker-compose up -d --scale worker=3`). Failure isolation — worker crash does not take down API. Easier debugging (separate logs). Matches production microservice architecture. Workers can be upgraded/restarted without API downtime.
- **Cons:** Added Docker Compose complexity (new service). Requires shared DB connection pooling across API+workers (manageable with NestJS providers). Logging aggregation needed for tracing (basic string logging suffices for MVP). Cross-service communication only via DB and Redis (no in-process shared memory).

### Option B: In-Process Worker (same NestJS container)
- Worker job handler is a registered @nestjs/bull onProcess handler inside the same NestJS application. When a job arrives, the handler executes FFmpeg in-process. Database updates happen in the same transaction context.
- **Pros:** Simplest to implement and debug (single process, shared memory, unified logs). No inter-service communication needed. Fast MVP iteration. Easier to test locally during development.
- **Cons:** API performance degrades during heavy video processing (FFmpeg is CPU-bound). No independent scaling of worker logic. Worker failure can crash API (shared process). Not suitable for production with high concurrent upload volume. CPU spike from FFmpeg will impact API latency for all users.

**Recommendation:** **Option A (Dedicated Worker Container)** — Separate worker container is the standard production pattern and costs minimal extra setup in Docker Compose. It isolates concerns (API handles HTTP, worker handles batch processing), enables independent scaling, and prevents the classic "heavy job blocks user requests" antipattern. For MVP, a single worker replica is fine; scaling up is trivial later. The Dockerfile for the worker is simple (Node + FFmpeg from a public image like `node:22-alpine` with `apk add ffmpeg`). Using @nestjs/bull in the worker is the same as in the API — no learning curve added.

**Decision:** _[pending]_

---

## TD-04: Video Streaming Protocol

**Scope:** Backend

**Capability:** Reprodução via streaming (sem necessidade de download completo)

**Context:** The video file (stored in MinIO) must be served to the browser for playback without requiring a full download first. HTML5 video players expect certain HTTP features:
- Seeking to arbitrary positions (jump to 30min without downloading the first 30min)
- Pause/resume without restarting
- Adaptive playback based on connection speed

Three common approaches exist for video streaming on the web:

**Options:**

### Option A: HTTP Range Requests (206 Partial Content)
- The API exposes `GET /videos/:id/stream` which respects HTTP `Range` headers (e.g., `Range: bytes=1000-9999`). The server responds with HTTP 206 Partial Content + the requested byte range. The browser automatically issues multiple Range requests as the user seeks or pauses/resumes.
- **Pros:** Simple to implement (Express/NestJS streaming support is native). Supported by all HTML5 video players. No transcoding needed. Works with any video codec. Minimal CPU overhead. Perfect for MVP.
- **Cons:** Each seek = new HTTP request (many small requests for heavy seeking). No adaptive bitrate (client always downloads original quality, regardless of bandwidth). Not optimized for mobile or poor networks. Inefficient for very large files (many requests = high latency).

### Option B: HLS (HTTP Live Streaming)
- Video is transcoded into multiple quality levels (480p, 720p, 1080p) and split into small segments (e.g., 10-second chunks). A `.m3u8` manifest lists the segments. The player downloads the manifest, then fetches segments intelligently based on available bandwidth. Supports seeking by jumping to the nearest segment.
- **Pros:** Adaptive bitrate — automatically selects quality based on connection speed. Widely used (Netflix, YouTube, Twitch). Efficient for mobile networks. Mature, standardized protocol.
- **Cons:** Requires transcoding farm (high CPU cost, ~3-4x encode time per video). Segment management (storage overhead). More complex backend (manifest generation, segment routing). Overkill for MVP (premature optimization). Deployment of FFmpeg transcoding is non-trivial. Setup time for HLS much higher than Range requests.

### Option C: DASH (Dynamic Adaptive Streaming over HTTP)
- Similar to HLS (transcoding into multiple bitrates, segments). Uses DASH manifest format (MPD) instead of m3u8. More standardized than HLS but less widely adopted in simple web stacks.
- **Pros:** Open standard, more flexible than HLS. Same adaptive bitrate benefits.
- **Cons:** Same transcoding overhead as HLS. Additional complexity vs. HLS. Less browser support than HLS without a player library.

**Recommendation:** **Option A (HTTP Range Requests)** — For MVP and phase 03, Range requests are the pragmatic choice. The implementation is trivial (NestJS `StreamableFile` + Content-Range header handling). Seeking works instantly (no manifest parsing). No transcoding = no infrastructure overhead. As video volume grows and mobile traffic increases (Fase 04+), HLS can be added as an upgrade; Range requests remain as a fallback for simple browsers. The project's stack (NestJS + MinIO) supports both patterns; they are not mutually exclusive.

**Decision:** _[pending]_

---

## TD-05: Video Identifier (URL Generation)

**Scope:** Backend

**Capability:** URL única por vídeo, sem conflito com outros vídeos

**Context:** Every video needs a unique, URL-safe identifier used in URLs like `/videos/{id}/stream`. The choice affects:
- URL length and readability
- Collision detection complexity
- Searchability (SEO, later phases)
- Database indexing

**Options:**

### Option A: UUID v4 (RFC 4122)
- Generate a random UUID v4 at video creation time. Stored in the `id` column of the `videos` table as a CHAR(36) or UUID type.
- URL: `/videos/550e8400-e29b-41d4-a716-446655440000/stream`
- **Pros:** Guaranteed globally unique (collision probability negligible). No database uniqueness check needed (by definition unique). Standard SQL UUID type available in PostgreSQL. Zero coordination needed. Simple generation (crypto.randomUUID() in Node.js). Indexed efficiently in PostgreSQL (UUID type is compact).
- **Cons:** Long URL (36 chars, including hyphens). Not human-readable or memorable. No semantic meaning (cannot extract creation date or owner from the ID).

### Option B: Slug (URL-friendly human-readable name)
- User or system generates a slug from the video title or auto-generated (e.g., "how-to-make-pizza", "awesome-cat-video-2"). Stored in `slug` column. Must validate uniqueness **per channel** (two channels can have the same video title).
- URL: `/videos/how-to-make-pizza/stream` (or with channel: `/channels/alice/videos/how-to-make-pizza/stream`)
- **Pros:** Human-readable, memorable, SEO-friendly (keywords in URL). Encourages good video titles. Better UX for sharing and bookmarking.
- **Cons:** Collision detection and handling (what if two videos in the same channel have identical slugs? Add a suffix like YouTube: `video-title-2`). More database logic (uniqueness constraint per channel). Slug generation / normalization logic (handle special chars, spaces, unicode). If title changes, slug may need updating (URL stability vs. title updates — tricky UX choice).

### Option C: Nanoid / Short ID
- Use a library like nanoid to generate a compact, URL-safe random ID (e.g., "V1StGXR_Z5j"). 12-character default, collision-resistant.
- URL: `/videos/V1StGXR_Z5j/stream`
- **Pros:** Shorter than UUID (12 chars vs. 36). Still globally unique. Compact, clean URLs. No collision logic.
- **Cons:** Adds a dependency (nanoid npm package, ~3KB). Less standard than UUID (PostgreSQL UUID type is native, nanoid is a library). Slightly less standard industry pattern (most platforms use UUID or slug).

**Recommendation:** **Option A (UUID v4)** — For MVP, UUID v4 is the pragmatic choice. PostgreSQL has native UUID type (efficient storage and indexing). No collision logic needed. Zero dependencies. Simplest implementation. URL length is a non-issue for technical APIs. Fase 04 (video editing) can add an optional **slug field** alongside UUID for SEO and UI purposes — both can coexist (UUID for technical routing, slug for human-readable URLs). This two-tier approach gives flexibility without MVP complexity.

**Decision:** _[pending]_

---

## TD-06: Video Status Lifecycle

**Scope:** Backend

**Capability:** Pré-cadastro automático do vídeo como rascunho ao iniciar o upload, Processamento automático do vídeo após upload (extração de duração e metadados)

**Context:** A video transitions through multiple states from upload initiation to playback-ready. The status affects:
- What endpoints can act on the video (e.g., can't edit while processing)
- API responses (e.g., /videos/:id returns different fields based on status)
- UI presentation (e.g., show "Processing..." banner vs. play button)
- Error handling (e.g., what to do if processing fails)

**Options:**

### Option A: Simple 4-State Machine (MVP)
- **States:** 
  - `draft` — video created, upload initiated, not yet processed
  - `processing` — job enqueued or in-progress
  - `ready` — processing succeeded, video ready to play
  - `error` — processing failed, awaiting user action or retry
- **Transitions:** draft → processing → ready or error. Error state is terminal; retry is a manual user action or admin action.
- **Pros:** Covers all MVP cases. Simple to test and debug. Minimal database columns needed (just `status` VARCHAR). Easy to implement state guards in the API (e.g., "can only delete if status = draft").
- **Cons:** No automatic retry (if processing fails, video is stuck in error state until manually retried). No tracking of retry attempts (if we add manual retry, we don't know if it's the 2nd or 10th attempt). No granular progress (all processing time is opaque).

### Option B: State Machine with Automatic Retry
- **States:** draft → processing → ready/error → retry_pending → processing → ready/error (loop)
- **Added columns:** `processing_attempts` (int), `last_error` (text), `next_retry_at` (timestamp)
- **Logic:** If processing fails, auto-schedule a retry (via a cron job or queue-level retry config) up to N times (e.g., 3 retries). After 3 failures, move to `permanently_failed` state.
- **Pros:** Resilient to transient failures (network glitch, FFmpeg timeout). Reduced manual intervention. Tracking of retry history.
- **Cons:** More complex state machine logic. Requires a scheduled job / cron to trigger retries. Database mutations more frequent. More complex testing.

### Option C: Granular State Pipeline (over-engineered for MVP)
- **States:** draft → upload_pending → uploaded → processing → extracting_metadata → generating_thumbnail → validating → ready / error
- Each state is a discrete step. Useful for tracking exactly where a video is in the pipeline.
- **Pros:** Detailed progress tracking. Can show "55% complete" in UI.
- **Cons:** Overkill for MVP. Too many states to test. Minimal added value over simple 4-state model until videos are mission-critical (e.g., live events).

**Recommendation:** **Option A (Simple 4-State Machine)** — For MVP, the 4-state model is sufficient. It covers the happy path (draft → processing → ready) and the error case clearly. Automatic retry can be added in Fase 04 when video processing volume justifies it or if transient failures become a problem. The 4-state model is proven by YouTube, Vimeo, and other platforms and remains their go-to for years. Add `processing_attempts` and `last_error` columns now (they cost nothing but enable future retry logic); leave retry scheduling for later.

**Decision:** _[pending]_

---

## TD-07: Object Storage Organization (MinIO Bucket Structure)

**Scope:** Backend

**Capability:** Serviço de armazenamento de arquivos (vídeos e thumbnails)

**Context:** MinIO will host video files and thumbnails. How to organize them in buckets and paths affects:
- How easy it is to list a user's videos
- How to back up or migrate per-channel
- Quota enforcement per channel
- Cleanup/garbage collection

**Options:**

### Option A: Hierarchical by Channel (Recommended)
- **Bucket structure:**
  ```
  bucket: streamtube-videos
    ├─ channels/{channel_id}/
    │   ├─ videos/{video_id}.mp4
    │   ├─ videos/{video_id}-preview.mp4  (optional, for thumbnail extraction preview)
    │   └─ thumbnails/{video_id}.jpg
  ```
- **Pros:** Organized, easy to list all videos of a channel. Supports per-channel quotas (limit storage per channel). Easy backup/migration per channel (copy entire `channels/{channel_id}/` tree). Clean separation of concerns.
- **Cons:** Slightly longer key paths. Requires channel_id to be known at upload time (always true in this architecture).

### Option B: Flat Structure (Simple)
- **Bucket structure:**
  ```
  bucket: streamtube-videos
    ├─ v/{video_id}.mp4
    ├─ t/{video_id}.jpg
  ```
- Objects are named by type prefix (v/ for video, t/ for thumbnail) + video_id.
- **Pros:** Simpler keys, faster generation. Single bucket, single listing operation.
- **Cons:** Less organized. Hard to enforce per-channel quotas. Hard to bulk-delete a channel's videos. Backup/migration is all-or-nothing.

### Option C: Separate Buckets
- **Bucket structure:**
  ```
  bucket: streamtube-videos
    ├─ {channel_id}/{video_id}.mp4
  
  bucket: streamtube-thumbnails
    ├─ {channel_id}/{video_id}.jpg
  ```
- Videos and thumbnails in separate buckets.
- **Pros:** Can back up / replicate / delete videos and thumbnails independently. Different retention policies per bucket (e.g., keep videos for 5 years, thumbnails for 1 year).
- **Cons:** Added bucket management overhead. Trickier client code (upload to two buckets). More complex cleanup (delete video + delete thumbnail separately).

**Recommendation:** **Option A (Hierarchical by Channel)** — Hierarchical organization scales well and supports future quota enforcement per channel (important for a multi-user platform). It's only marginally more complex than flat. The key paths (`channels/{channel_id}/videos/{video_id}.mp4`) remain clean and readable. This structure is used by major platforms (YouTube's GCS structure follows similar principles). If per-bucket separation of concerns becomes necessary (Fase 04+), buckets can be added without changing this path structure.

**Decision:** _[pending]_

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---|---|
| TD-01 | Backend | Job Queue Technology | Redis + Bull | _[pending]_ |
| TD-02 | Backend | Upload Strategy for 10GB Files | Presigned URL (MinIO) | _[pending]_ |
| TD-03 | Backend | Video Worker Infrastructure | Dedicated Container | _[pending]_ |
| TD-04 | Backend | Streaming Protocol | Range Requests (206) | _[pending]_ |
| TD-05 | Backend | Video Identifier | UUID v4 | _[pending]_ |
| TD-06 | Backend | Video Status Lifecycle | 4-State Simple Machine | _[pending]_ |
| TD-07 | Backend | Object Storage Organization | Hierarchical by Channel | _[pending]_ |

---

**Next Steps:**

1. Review the recommendations above.
2. Run `/plan-context phase-03-videos` to consolidate the context from these decisions, project requirements, and prior phases.
3. Follow up with `/plan-validate phase-03-videos` to check for gaps or inconsistencies before proceeding to implementation planning.

**Created by:** Claude Code + research skill  
**Date:** 2026-07-31  
**Status:** Pending user review and decision
