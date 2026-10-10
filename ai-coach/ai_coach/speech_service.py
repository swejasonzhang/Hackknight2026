from google import genai
from google.genai import types

from ai_coach.config import GEMINI_API_KEY, GEMINI_MODEL

_client = genai.Client(api_key=GEMINI_API_KEY)

_TRANSCRIBE_INSTRUCTION = (
    "Transcribe exactly what is spoken in this audio. Output only the transcription, "
    "with no commentary, quotes, or formatting."
)


def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/wav") -> str:
    """Speech-to-text via Gemini's native audio understanding. Needs raw audio bytes
    and their mime type (e.g. "audio/wav", "audio/mp3", "audio/webm") - no separate
    STT service or API key required beyond the Gemini client already configured."""
    response = _client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            _TRANSCRIBE_INSTRUCTION,
        ],
    )
    return response.text.strip()
