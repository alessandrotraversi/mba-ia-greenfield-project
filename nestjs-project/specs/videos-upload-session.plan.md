---
subproject: backend
runner: jest+supertest
scope: phase-03-videos
si: SI-03.4
target_file: nestjs-project/test/videos-upload-session.e2e-spec.ts
---

# POST /videos/upload-session Test Plan

## Application Overview

This endpoint starts a video upload session: an authenticated user requests a presigned MinIO PUT URL for a video file, and the backend pre-registers a draft `Video` record scoped to the caller's channel before returning the URL. It enforces the 10GB size cap and rejects non-video content types up front, before any storage interaction.

## Test Scenarios

### 1. Upload Session Creation

**Setup:** `beforeEach` truncates the test database and re-seeds an authenticated test user with a channel; bootstraps the Nest test module (`Test.createTestingModule(...).compile()`) with a real MinIO test-bucket connection.

#### 1.1. create-upload-session-success

**Covers AC:** #1, #2
**Source:** auto
**Last sync:** 2026-08-17T16:33:40Z

**Steps:**
  1. POST `/videos/upload-session` as an authenticated user, with a valid body (`fileName`, `contentType: "video/mp4"`, `fileSizeBytes` under 10GB)
    - expect: `201` response with `videoId`, `uploadUrl`, `expiresAt`, and `storageKey` fields present
    - expect: `storageKey` matches `channels/{channelId}/videos/{videoId}.mp4`
  2. Query the `Video` table for the returned `videoId`
    - expect: a row exists with `status: "draft"`

#### 1.2. file-too-large-rejected

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-08-17T16:33:40Z

**Steps:**
  1. POST `/videos/upload-session` as an authenticated user, with `fileSizeBytes` exceeding 10GB
    - expect: `400` response with `errorCode: "FILE_TOO_LARGE"`
    - expect: no `Video` row is created for this request

#### 1.3. unsupported-content-type-rejected

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-08-17T16:33:40Z

**Steps:**
  1. POST `/videos/upload-session` as an authenticated user, with `contentType: "application/pdf"`
    - expect: `400` response with `errorCode: "UNSUPPORTED_CONTENT_TYPE"`

#### 1.4. unauthenticated-request-rejected

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-08-17T16:33:40Z

**Steps:**
  1. POST `/videos/upload-session` without an `Authorization` header, with an otherwise valid body
    - expect: `401` response
