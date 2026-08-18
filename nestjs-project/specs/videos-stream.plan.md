---
subproject: backend
runner: jest+supertest
scope: phase-03-videos
si: SI-03.7
target_file: nestjs-project/test/videos-stream.e2e-spec.ts
---

# GET /videos/:id/stream Test Plan

## Application Overview

This endpoint serves a video's bytes from MinIO to any caller, authenticated or not — matching the project's "anonymous users watch freely" model. It honors HTTP `Range` requests for seeking/streaming (`206 Partial Content`) and falls back to the full byte stream (`200`) for plain downloads, reading only from `ready` videos.

## Test Scenarios

### 1. Video Streaming and Download

**Setup:** `beforeEach` truncates the test database and re-seeds two `Video` fixtures — one `ready` (with a real small MP4 object uploaded to the test MinIO bucket) and one `processing`; bootstraps the Nest test module (`Test.createTestingModule(...).compile()`).

#### 1.1. full-content-stream-success

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-08-17T16:33:40Z

**Steps:**
  1. GET `/videos/:id/stream` for the `ready` video fixture, with no `Range` header
    - expect: `200` response with the full video byte stream
    - expect: `Content-Type` header starts with `video/`

#### 1.2. partial-content-range-request

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-08-17T16:33:40Z

**Steps:**
  1. GET `/videos/:id/stream` for the `ready` video fixture, with header `Range: bytes=0-1023`
    - expect: `206` response
    - expect: `Content-Range` header reflects the requested range and the object's total size
    - expect: response body length matches the requested range size (1024 bytes)

#### 1.3. video-not-found

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-08-17T16:33:40Z

**Steps:**
  1. GET `/videos/:id/stream` for a random, non-existent video id
    - expect: `404` response with `errorCode: "VIDEO_NOT_FOUND"`

#### 1.4. video-not-ready

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-08-17T16:33:40Z

**Steps:**
  1. GET `/videos/:id/stream` for the `processing` video fixture
    - expect: `409` response with `errorCode: "VIDEO_NOT_READY"`

#### 1.5. anonymous-access-allowed

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-08-17T16:33:40Z

**Steps:**
  1. GET `/videos/:id/stream` for the `ready` video fixture, without an `Authorization` header
    - expect: `200` response (request succeeds without authentication)
