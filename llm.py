import os
import re
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / ".env")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini").strip()
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/"
    f"models/{GEMINI_MODEL}:generateContent"
)

CHAT_FALLBACK = (
    "I can hear you. Ask me about trees, water, transit, or energy."
)

REFUSAL = "The records I have don't say."
BUSY = (
    "The AI service is temporarily unavailable. "
    "Please try again in a moment."
)


def _generate_openrouter(prompt, max_retries=3):
    if not OPENROUTER_API_KEY:
        print("OpenRouter key not found.")
        return None

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Green Gavel",
    }

    body = {
        "model": OPENROUTER_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 600,
    }

    for attempt in range(max_retries):
        try:
            response = httpx.post(
                OPENROUTER_URL,
                headers=headers,
                json=body,
                timeout=60,
            )

            if response.status_code in {401, 402, 403}:
                print(f"OpenRouter rejected the request ({response.status_code}).")
                return None

            if response.status_code in {429, 500, 502, 503, 504}:
                wait_time = 2 ** attempt
                print(f"OpenRouter unavailable. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue

            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            if content:
                print("LLM provider: OpenRouter")
                return content

        except (httpx.HTTPError, KeyError, IndexError, TypeError) as error:
            print(f"OpenRouter error: {error}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)

    return None


def _generate_gemini(prompt, max_retries=3):
    if not GEMINI_API_KEY:
        print("Gemini key not found.")
        return None

    url = f"{GEMINI_URL}?key={GEMINI_API_KEY}"
    body = {"contents": [{"parts": [{"text": prompt}]}]}

    for attempt in range(max_retries):
        try:
            response = httpx.post(url, json=body, timeout=60)

            if response.status_code in {401, 402, 403}:
                print(f"Gemini rejected the request ({response.status_code}).")
                return None

            if response.status_code in {429, 500, 502, 503, 504}:
                wait_time = 2 ** attempt
                print(f"Gemini unavailable. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue

            response.raise_for_status()
            result = response.json()
            content = result["candidates"][0]["content"]["parts"][0]["text"]
            if content:
                print("LLM provider: Gemini fallback")
                return content

        except (httpx.HTTPError, KeyError, IndexError, TypeError) as error:
            print(f"Gemini error: {str(error).replace(GEMINI_API_KEY, '<key>')}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)

    return None


def _generate(prompt, max_retries=3):
    result = _generate_openrouter(prompt, max_retries=max_retries)
    if result:
        return result

    print("Falling back to Gemini...")
    result = _generate_gemini(prompt, max_retries=max_retries)
    if result:
        return result

    return BUSY


def parse_route(raw):
    word = (
        (raw or "")
        .strip()
        .lower()
        .split(" ", 1)[0]
        .strip(".,:;\"'")
    )

    if word == "chat":
        return "chat"
    return "records"


def route_question(question):
    prompt = f"""
You sort one utterance for Green Gavel,
a voice app about Chapel Hill town records.

Return only one word:

chat

or

records

Use "records" when any part of the user's message asks
what a town body decided, discussed, scheduled, published,
voted on, or planned.

Examples include:

- trees
- water
- stormwater
- flooding
- transit
- energy
- meetings
- votes
- agendas
- council activity
- development
- zoning
- transportation

A mixed message such as:

"Hi, what is the town doing about trees?"

should be classified as:

records

Use "chat" for:

- greetings
- "can you hear me"
- thanks
- "who are you"
- "what can you do"
- general conversation unrelated to records

Utterance:

{question}
"""

    try:
        result = _generate(prompt, max_retries=2)
        return parse_route(result)
    except Exception:
        return "records"


def chat_reply(question):
    prompt = f"""
You are Green Gavel,
a voice assistant for Chapel Hill town records.

The user is not asking about government records.

Reply in one or two short plain sentences.

Rules:

- Do not invent council decisions.
- Do not invent dates.
- Do not invent votes.
- Do not use bracket citations.
- Do not use em dashes.
- Keep the response conversational.
- Keep the response concise.

If the user asks whether you can hear them,
say yes and invite them to ask about topics like
trees, water, transit, or energy.

If they ask who you are,
say that you are Green Gavel and that you help
people understand Chapel Hill town records.

User:

{question}
"""

    try:
        text = _generate(prompt).strip()
    except Exception:
        text = ""

    text = re.sub(r"\s*\[\d+\]", "", text)
    text = text.replace("\u2014", ", ").replace("\u2013", ", ").strip()

    if not text or text == REFUSAL:
        return CHAT_FALLBACK

    return text


def ask_llm(question, context, max_retries=3):
    prompt = f"""
You are Green Gavel,
an assistant that helps people understand
Chapel Hill local government activity.

Use ONLY the provided government records
to answer the question.

Rules:

- Do not invent facts.
- Do not use outside knowledge.
- Base every claim on the provided records.
- If the records do not contain enough information,
  say: "{REFUSAL}"
- Mention relevant meeting dates when useful.
- Keep the answer concise.
- Keep the answer clear.
- Do not pretend to know anything that is not
  explicitly supported by the records.
- Do not include fake citations.

GOVERNMENT RECORDS:

{context}

USER QUESTION:

{question}
"""

    return _generate(prompt, max_retries=max_retries)


if __name__ == "__main__":
    print("Testing LLM providers...\n")
    result = _generate("Reply with exactly: Green Gavel AI is working.")
    print("\nRESULT:")
    print(result)