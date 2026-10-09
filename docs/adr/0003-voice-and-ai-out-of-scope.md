# ADR-0003: Voice interface and AI assistant removed from scope

- Date: 2026-10-09
- Status: accepted

## Context

The original idea included a one-button voice conversation with an "AI PT" (speech-to-text, a language model grounded in the user's numbers, text-to-speech). ElevenLabs was considered for the voice. The team decided to focus on the full-stack, end-to-end flow plus the computer-vision measurement.

## Decision

No voice provider and no language-model endpoint in this codebase for now. The `applyAdjustment` action in the session reducer stays, because the user (or a future assistant) adjusting the next set is cheap to keep and already tested.

## Consequences

- Fewer API keys, no per-request cost, nothing that needs HTTPS beyond the camera.
- If revived, the design is recorded in `docs/BACKLOG.md` (E1, E2): an endpoint grounded in `ProgressDto` returning a structured adjustment.
