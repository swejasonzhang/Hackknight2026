import time

from google import genai
from google.genai.errors import ServerError

from ai_coach.config import GEMINI_API_KEY, GEMINI_MODEL
from ai_coach.models import SurveyAnswers

_client = genai.Client(api_key=GEMINI_API_KEY)

ARC_ONBOARDING_PERSONA = """You are Arc, a fun, upbeat, high-energy workout coach doing a quick, \
casual onboarding chat with a brand new user - this should feel like catching up with a friend, \
not filling out a survey. Keep every message short (1-2 sentences), conversational, and speakable \
out loud: no markdown, no lists, no clinical jargon. Briefly react to what they just said before \
asking the next thing."""

# Each topic drives exactly one required field in SurveyAnswers. Fixed order and fixed set so
# onboarding reliably collects everything needed, even though Arc phrases each one fresh.
ONBOARDING_TOPICS: list[tuple[str, str]] = [
    ("usage_frequency", "how often they think they'll be training with the app"),
    ("purpose", "what they're hoping to get out of using the app"),
    (
        "goal",
        "whether they want to get stronger (strength), build muscle size (hypertrophy), or build "
        "stamina (endurance) - ask in plain, fun language, not those exact clinical terms",
    ),
    ("height", "their height"),
    ("weight", "their weight"),
    (
        "activity_level",
        "how active they currently are right now, offering these three options casually: "
        "(1) daily exercise, or intense exercise 3-4 times a week, (2) intense exercise 6-7 times "
        "a week, (3) very intense exercise or a highly physical job",
    ),
]


def _generate_with_retry(contents: str, config: dict):
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            return _client.models.generate_content(model=GEMINI_MODEL, contents=contents, config=config)
        except ServerError:
            if attempt == max_attempts:
                raise
            time.sleep(2**attempt)


def _format_transcript(transcript: list[dict]) -> str:
    return "\n".join(f"{turn['role']}: {turn['text']}" for turn in transcript)


def next_question(topic_description: str, transcript: list[dict]) -> str:
    """transcript: [{"role": "arc" | "user", "text": str}, ...] so far, oldest first."""
    prompt = (
        f"Conversation so far:\n{_format_transcript(transcript)}\n\n"
        f"Now ask the user about {topic_description}. Reply with just the reaction + question, nothing else."
    )
    response = _generate_with_retry(prompt, {"system_instruction": ARC_ONBOARDING_PERSONA})
    return response.text.strip()


# Gemini's structured-output schema is a restricted subset that doesn't support the
# $ref/$defs pydantic emits for Enum fields - so this is a flat dict with enums inlined,
# not SurveyAnswers.model_json_schema(). The pydantic model still does the real validation
# below, via model_validate_json.
_SURVEY_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "usage_frequency": {"type": "STRING"},
        "purpose": {"type": "STRING"},
        "goal": {"type": "STRING", "enum": ["strength", "hypertrophy", "endurance"]},
        "height_cm": {"type": "NUMBER"},
        "weight_kg": {"type": "NUMBER"},
        "activity_level": {"type": "STRING", "enum": ["moderate", "intense", "very_intense"]},
    },
    "required": ["usage_frequency", "purpose", "goal", "height_cm", "weight_kg", "activity_level"],
}


def extract_survey(transcript: list[dict]) -> SurveyAnswers:
    """Parses the full onboarding conversation into structured survey answers."""
    prompt = (
        f"Conversation:\n{_format_transcript(transcript)}\n\n"
        "Extract the user's survey answers from this conversation. If height or weight were "
        "given in feet/inches or pounds, convert them to centimeters and kilograms."
    )
    response = _generate_with_retry(
        prompt,
        {"response_mime_type": "application/json", "response_schema": _SURVEY_SCHEMA},
    )
    return SurveyAnswers.model_validate_json(response.text)
