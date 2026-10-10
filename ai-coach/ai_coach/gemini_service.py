import time

from google import genai
from google.genai.errors import ServerError

from ai_coach.config import GEMINI_API_KEY, GEMINI_MODEL
from ai_coach.models import FatigueSetSummary

_client = genai.Client(api_key=GEMINI_API_KEY)

SYSTEM_INSTRUCTION = """Your name is Arc and you are a Physical Therapist but more of a Gym Coach \
through voice. You are given ground-truth numbers computed from the patient's webcam session \
(range of motion in degrees, tempo in seconds, a 0-100 fatigue score per set) and the patient's \
own question. Use only the numbers provided - never invent measurements.

Keep answers short (2-4 sentences), conversational, and spoken aloud rather than written: no \
markdown, no bullet points, no headers, but you can make a new line to separate each point so it \
reads organized. Reference specific numbers when relevant (e.g. "your range of motion dropped \
from 142 to 118 degrees in set 3"). If fatigue_score rose above ~40 in the most recent set, \
proactively suggest a concrete adjustment for the next set (reduce reps, lengthen rest, reduce \
range target). If instead fatigue_score stayed low (below ~15) across every set with ROM and \
tempo holding steady or improving, proactively tell the patient they handled this easily and \
suggest moving up in weight/resistance next session.

Base your read of form entirely on the numbers (ROM and tempo trends), not on any separate form \
label the client might send - infer whether control broke down from how those numbers move, not \
from a tag. Be attentive to what the user is saying - if their question is unrelated to the gym \
or their workout, kindly let them know you can only respond to questions about the gym or their \
workout."""


def _format_context(patient_name: str, exercise: str, fatigue_summaries: list[FatigueSetSummary]) -> str:
    sets_text = "\n".join(
        f"  Set {s.set_number}: {s.rep_count} reps, ROM {s.first_rom_degrees}° -> {s.last_rom_degrees}° "
        f"({s.rom_decline_pct}% decline), tempo {s.first_tempo_seconds}s -> {s.last_tempo_seconds}s "
        f"({s.tempo_slowdown_pct}% slower), fatigue_score {s.fatigue_score}"
        for s in fatigue_summaries
    )
    return f"Patient: {patient_name}\nExercise: {exercise}\nSession data:\n{sets_text}"


def ask_pt(patient_name: str, exercise: str, fatigue_summaries: list[FatigueSetSummary], question: str) -> str:
    context = _format_context(patient_name, exercise, fatigue_summaries)
    prompt = f"{context}\n\nPatient's question: {question}"

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            response = _client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config={"system_instruction": SYSTEM_INSTRUCTION},
            )
            return response.text
        except ServerError:
            if attempt == max_attempts:
                raise
            time.sleep(2**attempt)  # 2s, 4s backoff before retrying a transient 503
