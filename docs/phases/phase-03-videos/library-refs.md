---
libs:
  "@nestjs/bull":
    version: "^11.0.4"
    context7_id: "unavailable — Context7 MCP tool not present in this session; sourced via WebSearch"
    fetched_at: "2026-08-17T16:21:27Z"
  "bull":
    version: "^4.16.5"
    context7_id: "unavailable — Context7 MCP tool not present in this session; sourced via WebSearch"
    fetched_at: "2026-08-17T16:21:27Z"
  "minio":
    version: "^8.0.7"
    context7_id: "unavailable — Context7 MCP tool not present in this session; sourced via WebSearch"
    fetched_at: "2026-08-17T16:21:27Z"
  "execa":
    version: "^10.x"
    context7_id: "unavailable — Context7 MCP tool not present in this session; sourced via WebSearch"
    fetched_at: "2026-08-17T16:21:27Z"
sources_mtime:
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-08-17T15:52:07Z"
---

# Library References — phase-03-videos

> **Sourcing note:** the Context7 MCP tool (`mcp__context7__resolve-library-id` / `query-docs`) was not available in this session, so this cache was distilled from WebSearch results against each library's official npm/GitHub/docs pages instead. Re-run `/plan-resolve phase-03-videos` in a session with Context7 available to refresh with authoritative Context7-sourced excerpts if higher fidelity is needed.

## @nestjs/bull

NestJS's official wrapper around the `bull` queue library — DI-friendly module registration and `@Process()` / `@OnQueueEvent()` decorators.

- **Register the queue** (per phase-03-videos/TD-01):
  ```ts
  BullModule.forRootAsync({
    imports: [ConfigModule],
    inject: [queueConfig.KEY],
    useFactory: (config: ConfigType<typeof queueConfig>) => ({
      redis: { host: config.host, port: config.port },
    }),
  })
  BullModule.registerQueue({ name: 'video-processing' })
  ```
- **Producer side** — inject `@InjectQueue('video-processing') private queue: Queue` and call `queue.add('process-video', { videoId })`.
- **Consumer side (worker)** — `@Processor('video-processing')` class with a `@Process('process-video')` method receiving the `Job<{ videoId: string }>`.
- **Current status:** `@nestjs/bull` (v11.0.4) wraps the legacy `bull` library, which itself is in maintenance mode (bug fixes only) — the ecosystem's actively-developed successor is `bullmq` / `@nestjs/bullmq`. This does not change TD-01's decision (already locked in as Redis + Bull); noted here only as context for anyone revisiting the choice in a future phase.

## bull

The underlying Redis-backed queue library that `@nestjs/bull` wraps.

- **Version:** 4.16.5 — maintenance mode (bug fixes only per upstream).
- **Job lifecycle relevant to phase-03-videos:** `queue.add(name, payload)` enqueues; a failed processor (thrown error inside `@Process()`) marks the job failed. Per phase-03-videos/TD-06, this phase does **not** configure Bull's built-in retry (`attempts` option is left at its default of 1) — a failed job transitions the video to the terminal `error` status instead of being requeued.
- **Redis connection:** shares the same Redis instance/config as the rest of the queue module (`REDIS_HOST` / `REDIS_PORT`, per phase-03-videos/TD-01).

## minio

Official MinIO JavaScript SDK — S3-compatible object storage client.

- **Version:** 8.0.7.
- **Presigned upload URL** (per phase-03-videos/TD-02):
  ```ts
  const uploadUrl = await minioClient.presignedPutObject(bucket, objectKey, expirySeconds)
  ```
- **Ranged download / streaming** (per phase-03-videos/TD-04) — `getPartialObject(bucket, objectKey, offset, length)` returns a readable stream for the requested byte range:
  ```ts
  const stream = await minioClient.getPartialObject(bucket, objectKey, rangeStart, rangeLength)
  stream.pipe(res)
  ```
  For the no-`Range`-header (full content, `200`) case, use `getObject(bucket, objectKey)` instead (no offset/length args).
- **Bucket notification → Redis** (per phase-03-videos/TD-02): configured at the MinIO server level via `MINIO_NOTIFY_REDIS_*` environment variables, not via SDK calls — the SDK is not involved in the notification path itself, only in generating the presigned URL and later reading the uploaded object.
- **Object key structure** (per phase-03-videos/TD-07): `channels/{channelId}/videos/{videoId}.mp4` and `channels/{channelId}/thumbnails/{videoId}.jpg` in a single bucket (`streamtube-videos`).

## execa

Promise-based wrapper over Node's `child_process`.

- **Version:** ^5.x (per phase-03-videos/TD-08 Revisions — downgraded from the originally decided `^10.x`; v10+ is pure-ESM with a transitive dependency chain Jest 30 cannot resolve, while v5 is the last CJS-native major and remains fully compatible with this project's Jest/ts-jest setup).
- **Invocation shape (v5 API — default export, not named):**
  ```ts
  import execa from 'execa';
  const { stdout } = await execa('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', filePath]);
  await execa('ffmpeg', ['-y', '-ss', String(seekSeconds), '-i', filePath, '-vframes', '1', thumbnailPath]);
  ```
- **Error handling:** on non-zero exit, `execa` rejects with an object carrying `.stdout` / `.stderr` / `.exitCode`. In v5, `ExecaError` is a type-only interface (no runtime class) — detect it with `error instanceof Error && 'stderr' in error && 'exitCode' in error`, not `instanceof ExecaError`. Per phase-03-videos/TD-08, `error.stderr` is persisted directly into the `Video.lastError` column (phase-03-videos/TD-06) — no manual stream-capture code needed.
- **CJS-native:** unlike v10+, execa v5 ships no `"type": "module"` and resolves normally under both `ts-node` and Jest — no dynamic import or transform workarounds needed.
