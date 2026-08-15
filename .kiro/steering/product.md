# StreamTube — Product Overview

StreamTube is a YouTube-like video sharing platform. Users can upload, manage, and publish videos. Anonymous users can browse and watch freely; social features (comments, subscriptions, likes) require authentication.

## Current Status

- **Phase 01 — Base Setup:** ✅ Complete
- **Phase 02 — Authentication:** ✅ Complete (register → email confirmation → login → password recovery, plus auto-created channel per user)
- **Phase 03 — Video Upload & Processing:** ⏳ Planned
- **Phase 04 — Video & Channel Management:** ⏳ Planned
- **Phase 05 — Video Player Page:** ⏳ Planned
- **Phase 06 — Social Interactions (Likes, Comments, Subscriptions):** ⏳ Planned
- **Phase 07 — Home Page, Search & Wrap-up:** ⏳ Planned

Full roadmap: `docs/project-plan.md`. Phase implementation details: `docs/phases/`.

## Key Domain Concepts

- **User** — registered account with email/password; confirmed via email before login is allowed.
- **Channel** — created automatically for each user on registration, using the email prefix as nickname.
- **Video** — uploaded content associated with a channel; processed asynchronously via FFmpeg worker.
- **Refresh Token** — rotated on each use with family tracking and grace period for reuse detection.

## Design System

The Figma source file (`FC Tube.fig`) is the design authority. All visual tokens (colors, typography, spacing, radii) are derived from it and live in `next-frontend/app/globals.css`. Never hard-code hex/px values — always use tokens.
