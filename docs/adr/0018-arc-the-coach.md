# ADR-0018: Arc, the coach: Gemini, ElevenLabs and hands-free voice in one flow

- Date: 2026-10-10
- Status: accepted

## Context

Jason asked to combine the full stack, the AI and the computer vision into one experience. A new member signs up and talks with a coach, always named Arc, about what they want from their body. Arc's side of that chat is Gemini, and the conversation is stored. The member then records from the dashboard's camera button. Afterwards Gemini turns the numbers into plain English, and ElevenLabs speaks it at the end of the session and of each section of exercises. Recording must work hands-off, with Arc listening for gym words such as start, stop and skip. Everything is saved to MongoDB so progress and what needs work can be compared later. The teammates' `ai-coach/` module already had Arc's persona, the Gemini model, the ElevenLabs model and voices, but was not wired to the backend.

## Decision

- **Arc runs on the API.** The `ai-coach/` prompt and settings are ported into `backend/src/services` in TypeScript: the persona, the default `gemini-3.8-flash`, retries on 429 and 5xx, `eleven_turbo_v2_5` and the default voice. Both APIs are called over REST, with keys in request headers, never in URLs, and never sent to the browser. The persona is a gym coach with a physical therapist's eye who talks to members, in line with the project's rule against clinical wording.
- **Onboarding is a stored chat at `/welcome` after sign-up.** Gemini asks one question at a time and returns JSON against a schema; the result is checked against the intake schema. When Arc is done, it saves an intake (goals, focus movement, side, limits, experience, days a week) on a profile, creates a first plan, and stores every line as a `CoachMessage`.
- **Arc reads each set and each session.** The set read comes during the rest; the session read comes on the report, stored on the session as `coachSummary`. The session read compares against earlier sessions of the same movement and the member's goals. A session gets one read, and a second request returns the stored one.
- **Arc's voice.** `GET /api/coach/messages/:id/audio` returns ElevenLabs MP3 for one of Arc's stored lines, to its owner only. The browser plays it, and falls back to its own speech synthesis.
- **Hands-free control in the browser.** The Web Speech API feeds `parseCommand`, which recognises start, pause, resume, skip, rest, stop, how many and repeat. To avoid false triggers, short phrases count, longer phrases count only when addressed to Arc, and negations are ignored. The recorder gained matching actions (pause also freezes the rest timer), and every command is saved with the session as `events`. Arc is muted while it speaks.
- **Works without keys.** Without Gemini, Arc follows a scripted onboarding and keyword extraction, and reads from templates built on the same numbers. These replies are marked offline, and a Gemini error falls back the same way. Without ElevenLabs, the browser speaks Arc's lines.
- **Cost guard.** The coach routes are for signed-in members only and rate-limited per account: 40 requests a minute by default, set with `COACH_MAX_PER_MINUTE`.

## Consequences

- The Render API service needs `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` for the full experience. The blueprint lists them with `sync: false`; until they are set, Arc runs offline.
- Speech recognition in Chrome sends audio to Google's speech service to transcribe it. The phrases are only matched against commands, never stored, and the camera video still never leaves the device. Firefox has no speech recognition, so the buttons cover the same actions there.
- The `ai-coach/` Python module stays as the teammates' reference, and its README notes the port.
