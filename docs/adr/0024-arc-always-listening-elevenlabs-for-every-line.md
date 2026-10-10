# ADR-0024: Arc listens and answers through the whole recording, in ElevenLabs' voice for every line

- Date: 2026-10-10
- Status: accepted; amends ADR-0018

## Context

Jason: "The current AI voice isn't using ElevenLabs... Within the browser, the AI should always be listening for feedback and always ready to give feedback." A teammate added that Arc's reads after a set were not constructive.

Three things stood in the way:
- **No key on the API.** Neither Render nor local development had `ELEVENLABS_API_KEY`, so the browser's voice spoke every line.
- **ElevenLabs only for stored messages.** Even with a key, acknowledgements went to the browser's voice. And the first line of a page could be spoken before the page knew ElevenLabs was there.
- **Arc only understood commands.** Anything else was ignored. With Gemini off, the reads after a set were three generic sentences.

## Decision

- **ElevenLabs for every line.** Stored lines are spoken by message id. Short lines (acknowledgements, cues) go through `POST /api/coach/speak`: members only, rate-limited, 240 characters at most, and cached in memory (200 lines), since they repeat. Every speaker waits on one shared status check before its first word. The record page says which voice Arc is using.
- **Always listening, always answering.** While recording, hands-free listening is on by default. A phrase that is not a command goes to Arc when it is meant for Arc (`isForArc`: a question, Arc's name, or how the member feels). Talk in the room that isn't for Arc is let go. `POST /api/coach/ask` answers with the live numbers:
  - Gemini's words when it is configured. Otherwise Arc's own:
    - pain: stop, and check with a professional if it is sharp or getting worse;
    - form: the last rep against the goal, whether the range is fading, and the exercise cue;
    - hard or easy: a concrete change;
    - how am I doing: the set, the reps and the best angle.
  - Both lines are stored as `CoachMessage` kind `ask`.
- **Cues during a set.** After each rep, `cueFor` may coach it, in this order: the range fading through the set, then a rep well short of the goal, then a rushed rep, then the first rep that reaches the goal. Arc speaks at most every seven seconds and never over itself.
- **Specific reads.** Without Gemini, the read after a set gives the best and lowest rep, how many reached the goal, how the range and the tempo held, and one concrete thing for the next set.

## Consequences

- Arc speaks with ElevenLabs only once `ELEVENLABS_API_KEY` is set on `getarc-api`; until then the record page says it is using the browser's voice.
- More Arc requests per recording (cues, answers) count against the per-account rate limit (`COACH_MAX_PER_MINUTE`, default 40), which the cue gap keeps well under.
- Spoken phrases are matched in the browser. Only phrases meant for Arc are sent to the API, and those are stored with Arc's answer.
