"""Standalone demo: Gemini reasons over a sample session, ElevenLabs speaks the answer.

uv run example.py
"""

import base64

from ai_coach.analytics import compute_session_fatigue
from ai_coach.gemini_service import ask_pt
from ai_coach.voice_service import synthesize_speech_base64

SAMPLE_SESSION = {
    "sets": [
        {
            "set_number": 1,
            "reps": [
                {"rep_number": 1, "peak_rom_degrees": 142, "tempo_seconds": 1.8},
                {"rep_number": 2, "peak_rom_degrees": 140, "tempo_seconds": 1.9},
                {"rep_number": 3, "peak_rom_degrees": 138, "tempo_seconds": 2.0},
            ],
        },
        {
            "set_number": 2,
            "reps": [
                {"rep_number": 1, "peak_rom_degrees": 136, "tempo_seconds": 2.1},
                {"rep_number": 2, "peak_rom_degrees": 130, "tempo_seconds": 2.3},
                {"rep_number": 3, "peak_rom_degrees": 124, "tempo_seconds": 2.6},
            ],
        },
        {
            "set_number": 3,
            "reps": [
                {"rep_number": 1, "peak_rom_degrees": 120, "tempo_seconds": 2.8},
                {"rep_number": 2, "peak_rom_degrees": 112, "tempo_seconds": 3.2},
                {"rep_number": 3, "peak_rom_degrees": 103, "tempo_seconds": 3.7},
            ],
        },
    ],
}


def main():
    fatigue = compute_session_fatigue(SAMPLE_SESSION)
    answer = ask_pt("Jordan Lee", "seated knee extension", fatigue, "How did I do today?")
    print("Arc says:", answer)

    audio_b64 = synthesize_speech_base64(answer)
    if audio_b64:
        with open("arc_answer.mp3", "wb") as f:
            f.write(base64.b64decode(audio_b64))
        print("Saved arc_answer.mp3")
    else:
        print("ELEVENLABS_API_KEY not set - text only.")


if __name__ == "__main__":
    main()
