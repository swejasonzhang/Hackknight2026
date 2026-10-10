import base64
import logging
from typing import Optional

from ai_coach.config import ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID

logger = logging.getLogger(__name__)

_client = None
if ELEVENLABS_API_KEY:
    from elevenlabs.client import ElevenLabs

    _client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

# Arc's persona is always "Arc" regardless of which voice is selected - these are
# just the voice options (male/female x accent) presented to the patient. Each
# voice_id is confirmed working with a live text_to_speech call; the key used to
# build this isn't scoped with voices_read, so entries aren't pulled from
# voices.get_all() and there's no Australian female option yet (see README).
VOICE_CATALOG = [
    {"voice_id": "SykE36PkoSIHecRtH16N", "gender": "female", "accent": "american"},
    {"voice_id": "IbfDOfGUmsNNu7w5955S", "gender": "male", "accent": "american"},
    {"voice_id": "JBFqnCBsd6RMkjVDRZzb", "gender": "male", "accent": "british"},
    {"voice_id": "pFZP5JQG7iQjIQuC4Bku", "gender": "female", "accent": "british"},
    {"voice_id": "IKne3meq5aSn9XLyUdCD", "gender": "male", "accent": "australian"},
]


def list_voices() -> list[dict]:
    return VOICE_CATALOG


def resolve_voice_id(
    voice_id: Optional[str] = None,
    gender: Optional[str] = None,
    accent: Optional[str] = None,
) -> str:
    """Picks a voice_id for synthesis. Explicit voice_id wins; otherwise matches
    gender/accent against the catalog; falls back to the configured default."""
    if voice_id:
        return voice_id

    for voice in VOICE_CATALOG:
        gender_ok = gender is None or voice["gender"] == gender.lower()
        accent_ok = accent is None or voice["accent"] == accent.lower()
        if gender_ok and accent_ok:
            return voice["voice_id"]

    if gender or accent:
        logger.warning("No voice matched gender=%s accent=%s, using default.", gender, accent)
    return ELEVENLABS_VOICE_ID


def synthesize_speech_base64(text: str, voice_id: Optional[str] = None) -> str | None:
    """Returns base64-encoded MP3 audio, or None if ElevenLabs isn't configured."""
    if _client is None:
        logger.warning("ELEVENLABS_API_KEY not set — skipping voice synthesis, returning text only.")
        return None

    audio_chunks = _client.text_to_speech.convert(
        voice_id=voice_id or ELEVENLABS_VOICE_ID,
        text=text,
        model_id="eleven_turbo_v2_5",
        output_format="mp3_44100_128",
    )
    audio_bytes = b"".join(audio_chunks)
    return base64.b64encode(audio_bytes).decode("ascii")
