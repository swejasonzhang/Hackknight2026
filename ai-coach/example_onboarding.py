"""Standalone demo: Arc runs the post-signup onboarding chat with canned answers
standing in for speech-to-text output, then extracts a structured survey and builds
a concrete training plan from it.

uv run example_onboarding.py
"""

from ai_coach.onboarding_service import ONBOARDING_TOPICS, extract_survey, next_question
from ai_coach.training_plan import build_training_plan

CANNED_ANSWERS = [
    "Probably like 4 times a week if I stick with it",
    "Trying to get stronger for basketball season honestly",
    "I really just want to lift heavier, not caring much about size",
    "About 6 foot 1",
    "Around 185 pounds",
    "I train pretty hard, like 6 or 7 days a week",
]


def main():
    transcript = []
    for (_key, topic_description), answer in zip(ONBOARDING_TOPICS, CANNED_ANSWERS):
        question = next_question(topic_description, transcript)
        print(f"Arc: {question}")
        transcript.append({"role": "arc", "text": question})

        print(f"User: {answer}")
        transcript.append({"role": "user", "text": answer})

    survey = extract_survey(transcript)
    plan = build_training_plan(survey.goal)

    print("\n--- extracted survey ---")
    print(survey.model_dump_json(indent=2))
    print("\n--- training plan ---")
    print(plan.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
