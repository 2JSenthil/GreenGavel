import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / ".env")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini").strip()
OPENROUTER_BASE_URL = os.getenv(
    "OPENROUTER_BASE_URL",
    "https://openrouter.ai/api/v1"
).strip().rstrip("/")


def ask_llm(question, context, max_retries=4):
    if not OPENROUTER_API_KEY:
        return (
            "OpenRouter is not configured. Add OPENROUTER_API_KEY to the environment "
            "and try again."
        )

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

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Green Gavel",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": "You answer only from the provided records."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 600,
    }

    for attempt in range(max_retries):
        try:
            response = requests.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
                timeout=120,
            )

            if not response.ok:
                if response.status_code in {429, 500, 503} and attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    print(f"OpenRouter is busy. Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                    continue
                raise RuntimeError(
                    f"OpenRouter request failed: {response.status_code} {response.text}"
                )

            data = response.json()
            choices = data.get("choices") or []
            if not choices:
                raise RuntimeError("OpenRouter returned no choices.")

            message = choices[0].get("message") or {}
            content = message.get("content") or ""

            if isinstance(content, list):
                content = "".join(
                    part.get("text", "") if isinstance(part, dict) else str(part)
                    for part in content
                )

            return content.strip()

        except Exception as exc:
            if any(token in str(exc) for token in ("429", "500", "503", "UNAVAILABLE")) and attempt < max_retries - 1:
                wait_time = 2 ** attempt
                print(f"OpenRouter is busy. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            raise

    return (
        "OpenRouter is temporarily unavailable. Please try again in a moment."
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