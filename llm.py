import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai.errors import ServerError

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=GEMINI_API_KEY)


def ask_llm(question, context, max_retries=4):
    prompt = f"""
You are Green Gavel, an assistant that helps people understand
Chapel Hill local government activity.

Use ONLY the provided context to answer the question.

Rules:
- Do not invent facts.
- Do not use outside knowledge.
- If the context does not contain enough information, say so.
- Mention relevant meeting dates when useful.
- Keep the answer concise and clear.
- Base every claim on the retrieved government records.

CONTEXT:

{context}

QUESTION:

{question}
"""

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt
            )

            return response.text

        except ServerError as e:
            if "503" in str(e) or "UNAVAILABLE" in str(e):
                wait_time = 2 ** attempt

                print(
                    f"Gemini is busy. Retrying in "
                    f"{wait_time} seconds..."
                )

                time.sleep(wait_time)

            else:
                raise

    return (
        "Gemini is temporarily unavailable due to high demand. "
        "Please try again in a moment."
    )


if __name__ == "__main__":
    test_context = """
Meeting date: 2026-06-17
Document type: minutes
Status: Final

The Town discussed stormwater regulation improvements
as part of Complete Community implementation.

Source:
https://example.com
"""

    answer = ask_llm(
        "What did the town discuss about stormwater?",
        test_context
    )

    print(answer)