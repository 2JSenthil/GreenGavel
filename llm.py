import os
import re
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-3.8-flash")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
CHAT_FALLBACK = "I can hear you. Ask me about trees, water, transit, or energy."
REFUSAL = "The records I have don't say."
BUSY = (
    "Gemini is temporarily unavailable due to high demand. "
    "Please try again in a moment."
)


def _generate(prompt, max_retries=4):
    if not OPENROUTER_API_KEY:
        return BUSY
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": OPENROUTER_MODEL,
        "messages": [{"role": "user", "content": prompt}],
    }
    for attempt in range(max_retries):
        try:
            response = httpx.post(OPENROUTER_URL, headers=headers, json=body, timeout=60)
            if response.status_code in {429, 500, 502, 503, 504}:
                wait_time = 2 ** attempt
                print(f"Gemini is busy. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            return content or ""
        except (httpx.HTTPError, KeyError, IndexError, TypeError):
            if attempt == max_retries - 1:
                break
            time.sleep(2 ** attempt)
    return BUSY


def parse_route(raw):
    word = (raw or "").strip().lower().split(" ", 1)[0].strip(".,:;\"'")
    if word == "chat":
        return "chat"
    return "records"


def route_question(question):
    prompt = f"""
You sort one utterance for Green Gavel, a voice app about Chapel Hill town records.

Return only one word: chat or records.

records: any part asks what a town body decided, discussed, scheduled, or published,
including trees, water, transit, energy, meetings, votes, or agendas.
A mixed line such as "Hi, what is the town doing about trees?" is records.

chat: greetings, "can you hear me", thanks, "who are you", "what can you do",
and other talk that does not ask about the records.

Utterance:
{question}
"""
    try:
        return parse_route(_generate(prompt, max_retries=2))
    except Exception:
        return "records"


def chat_reply(question):
    prompt = f"""
You are Green Gavel, a voice assistant for Chapel Hill town records.
The person is not asking about the records.
Reply in one or two short plain sentences.
Do not invent council decisions, dates, or votes.
Do not use bracket citations.
Do not use em dashes.
If they ask whether you can hear them, say yes, then invite a question about trees, water, transit, or energy.
If they ask who you are, say you are Green Gavel and you answer questions about those town records.

They said:
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
    return _generate(prompt, max_retries)


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