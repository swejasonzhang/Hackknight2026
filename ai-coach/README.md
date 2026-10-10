# Arc voice AI PT

The AI half of the "one-button voice AI PT" feature: Gemini reasons over a session's
ROM/fatigue numbers and answers the patient's question in 2-4 short, speakable
sentences; ElevenLabs turns that answer into audio. Arc only ever reasons over the
numbers it's given - it never invents a measurement.

```bash
cd ai-coach
uv sync                      # Python 3.12, google-genai, elevenlabs, pydantic, dotenv
cp .env.example .env         # fill in GEMINI_API_KEY at minimum
uv run example.py            # prints Arc's answer, writes arc_answer.mp3 if ElevenLabs is configured
uv run example_onboarding.py # runs the onboarding chat + extracts a survey + builds a training plan
```

## What's here

- `ai_coach/gemini_service.py` - `ask_pt(patient_name, exercise, fatigue_summaries, question)`. System prompt gives Gemini the "Arc" persona and standing rules: suggest backing off when `fatigue_score` climbs above ~40 in the latest set, suggest moving up in weight when it stays below ~15 with steady or improving ROM/tempo, judge form from the ROM/tempo numbers themselves rather than any separate form label, and decline anything unrelated to the gym or the workout. Retries 3x with backoff on a transient Gemini 503.
- `ai_coach/voice_service.py` - `synthesize_speech_base64(text, voice_id)` calls ElevenLabs; returns `None` (not an error) when `ELEVENLABS_API_KEY` is unset, so the text answer still works without it. `resolve_voice_id(voice_id, gender, accent)` picks from `VOICE_CATALOG` so a patient can choose male/female x american/british/australian - each entry is a real ElevenLabs premade voice confirmed with a live call, not hardcoded from memory. No Australian female voice yet: the ElevenLabs key used to build this isn't scoped with `voices_read`, so the catalog couldn't be pulled from `voices.get_all()` / `voices.get_shared()` - an API key with that permission (or a known-good voice_id) would complete the set.
- `ai_coach/speech_service.py` - `transcribe_audio(audio_bytes, mime_type)`, speech-to-text via Gemini's native audio understanding (no separate STT API or key needed). Verified with a round-trip test: ElevenLabs-synthesized audio fed back through this function transcribed back to the exact original text.
- `ai_coach/onboarding_service.py` - the post-signup "fun conversation, not a survey" flow. `next_question(topic_description, transcript)` drives a fixed sequence of 6 topics (`ONBOARDING_TOPICS`: usage frequency, purpose, goal, height, weight, activity level) but lets Gemini phrase each one fresh and react to the previous answer, so the sequence is reliable while the wording stays natural. `extract_survey(transcript)` parses the full conversation into a `SurveyAnswers`, converting height/weight to metric if the user answered in feet/pounds. Note: this uses a hand-written flat JSON schema rather than `SurveyAnswers.model_json_schema()`, because Gemini's structured-output schema is a restricted subset that doesn't support the `$ref`/`$defs` pydantic emits for `Enum` fields (`goal`, `activity_level`) - passing the pydantic schema directly throws a validation error.
- `ai_coach/training_plan.py` - `build_training_plan(goal)`, a deterministic (no model call) lookup from `TrainingGoal` to concrete sets/reps/rest ranges and weight-direction guidance: strength (2-4 sets, 2-6 reps, 2-5 min rest), hypertrophy (3-5 sets, 8-12 reps, 1-3 min rest), endurance (2-4 sets, 13-25 reps, 30-60s rest).
- `ai_coach/analytics.py` - turns raw `{set_number, reps: [{peak_rom_degrees, tempo_seconds}]}` data into the `FatigueSetSummary` Gemini reasons over (ROM decline %, tempo slowdown %, a 0-100 fatigue score).
- `example.py` / `example_onboarding.py` - runnable end-to-end demos (the Q&A loop, and the onboarding chat + plan-building respectively) against sample data, no backend or database needed.

## Wired into the app (2026-10-10)

The prompt, model and voice settings are ported to TypeScript in `backend/src/services/` (`arc.ts`, `gemini.ts`, `voice.ts`) and exposed as `/api/coach/*`: Arc runs the onboarding chat after sign-up, reads each set and each session back, and speaks with ElevenLabs (root README, section 4b; ADR-0018). The onboarding survey (goal, frequency, height, weight) joined the app's chat, which now asks nine skippable topics, and `training_plan.py`'s ranges bound every week Arc builds (`TRAINING_RANGES` in `dependencies/src/program.ts`; ADR-0020, ADR-0022). The notes below describe the module as it was before that port.

## Not wired up yet (historical)

This module is self-contained and doesn't talk to the backend or MongoDB. Two things
would need to happen to put it behind an endpoint teammates can call from the dashboard:

1. **Real session data.** `analytics.py`'s input shape is a stand-in for the backend's
   actual `SessionDto`/`FatigueEstimate` (`dependencies/src/engine/types.ts`), which
   already computes `romDecay`/`tempoDrift`/`index` (0-1, not 0-100) per set. Whoever
   wires this in should decide whether `ask_pt` takes that shape directly (dropping
   `analytics.py`) or a route adapts it to `FatigueSetSummary` before calling in.
2. **An endpoint.** Nothing here is exposed over HTTP. Since the rest of the API is
   Express/TypeScript, the likely shape is a small Node route that either calls out to
   this Python module as a subprocess/service, or the prompt + retry logic gets ported
   to TypeScript directly (mirroring `gemini_service.py`) so it lives alongside
   `backend/src/services/`. Not done here since it's a real design decision, not a
   drop-in.
3. **Saving the onboarding survey.** `onboarding_service.extract_survey` returns a
   `SurveyAnswers`, and `training_plan.build_training_plan` turns it into a
   `TrainingPlan`, but nothing here persists either one - that's a profile/plan write
   on the backend side (`Profile`/`Plan` in `backend/src/models/`), once onboarding has
   somewhere to call into.
4. **Capturing real audio.** `speech_service.transcribe_audio` takes raw audio bytes,
   but recording a clip from the browser mic and getting it to this function is a
   frontend concern, not addressed here.
