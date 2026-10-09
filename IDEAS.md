# Hackknight: Webcam PT Goniometer

Drafted 2026-10-07. Status: DRAFT, technical claims being verified.

## Pitch

Patients do their prescribed physical-therapy exercises in front of a laptop camera. Pose estimation measures joint range of motion (ROM) in degrees, counts reps and sets, and estimates fatigue from how ROM and tempo change across a set. The physical therapist sees progress trends over weeks on a dashboard. A one-button voice interface lets the patient talk to an AI PT that knows their numbers and suggests adjustments.

## Features we want

- Camera-based joint angle measurement (ROM in degrees), live on screen
- Rep counting with per-rep peak ROM
- Sets, rest countdown, pause and resume
- Fatigue estimate from ROM decline and slowing tempo across reps
- Patient dashboard and PT dashboard with progress graphs over weeks
- One-button voice AI PT: talk and listen, get adjustments and updates

## Hard parts and how we handle them

1. **Fatigue has no ground truth.** Use a proxy: peak ROM decline across reps in a set, plus tempo drift (seconds per rep increasing). Show "ROM decay" and "tempo drift" on screen instead of claiming to measure fatigue. The AI PT can still say "your last three reps lost 12 degrees, let's rest."
2. **2D angles lie when the patient turns.** A webcam angle is only accurate when the joint moves in a plane parallel to the camera. Compute angles from MediaPipe's 3D world landmarks. Add an alignment check before each set: the three landmarks must be visible and the patient must be facing the right way.
3. **No weeks of data by demo day.** Seed the dashboard with synthetic historical sessions labeled as demo data. Live sessions append to that history.

## Architecture (core loop)

- **Frontend:** Vite + React + TypeScript.
- **Vision runs entirely in the browser:** MediaPipe Pose Landmarker (`@mediapipe/tasks-vision`) with the GPU delegate. No video leaves the laptop, which is a privacy selling point for health data.
- **Angle engine:** a pure TypeScript module. Landmarks in, joint angle out per exercise config. Smooth with a One Euro filter. The rep counter is a state machine with hysteresis thresholds (flexed / extended) and a minimum rep duration to reject jitter. Record per-rep peak ROM and rep duration.
- **Session state machine:** Idle -> Align -> Set active -> Rest countdown -> next set -> Complete. Pause/resume is a flag on the active state. Auto-advance to rest when target reps are hit or when the fatigue index crosses a threshold (adaptive rest).
- **Storage:** localStorage or IndexedDB, unless the PT dashboard must run on a separate device during the demo; then Supabase (Postgres + auth) for the two roles.
- **Dashboard:** Recharts. Four charts: peak ROM per session over time with the PT's target line; per-rep ROM within one session; fatigue index per session; sessions per week (adherence).

## Voice AI PT

- A button opens a voice panel. Browser SpeechRecognition (Web Speech API) for speech-to-text, Claude Messages API with streaming for the reasoning, browser speechSynthesis for the voice. Swap in ElevenLabs TTS for a nicer voice if time allows.
- One small serverless function holds the Claude API key. Never put the key in browser code.
- **Grounding:** pass the exercise plan, the latest session stats (per-rep ROM, fatigue index) and the trend summary as structured JSON in the system prompt.
- **Closed loop:** have Claude return a structured adjustment (fewer reps, longer rest, lower target ROM) that the app applies to the next set.
- Speak sentence by sentence as the stream arrives to keep latency low.

## Exercises (three, all laptop-friendly)

| Exercise | Landmarks for the angle |
|---|---|
| Elbow flexion | shoulder - elbow - wrist |
| Shoulder abduction | hip - shoulder - wrist |
| Seated knee extension | hip - knee - ankle |

All three work seated at a desk. A laptop camera at desk height cannot see a standing squat.

## Build order

1. Camera, pose overlay, live angle readout for one joint
2. Rep counter with a per-rep peak ROM list
3. Set / rest / resume state machine and session save
4. Dashboard with seeded history plus the live session
5. Fatigue index and in-session nudge
6. Voice AI PT
7. Polish: alignment guide, exercise picker, PT target lines

## Open questions

- Hackathon length?
- Does the PT view need its own device during the demo? This decides localStorage vs Supabase.
- How do we split the build order across the team?
