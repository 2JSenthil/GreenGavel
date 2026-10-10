import httpx

from app.config import (
    SNOWFLAKE_ACCOUNT,
    SNOWFLAKE_DATABASE,
    SNOWFLAKE_PAT,
    SNOWFLAKE_ROLE,
    SNOWFLAKE_SCHEMA,
    SNOWFLAKE_WAREHOUSE,
)


def snowflake_enabled() -> bool:
    return bool(
        SNOWFLAKE_ACCOUNT
        and SNOWFLAKE_PAT
        and SNOWFLAKE_DATABASE
        and SNOWFLAKE_SCHEMA
    )


def _sql_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {SNOWFLAKE_PAT}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
    }


def _base_url() -> str:
    return f"https://{SNOWFLAKE_ACCOUNT.lower()}.snowflakecomputing.com"


async def execute_sql(sql: str):
    if not snowflake_enabled():
        return []

    url = f"{_base_url()}/api/v2/statements"
    body = {
        "statement": sql,
        "timeout": 60,
        "database": SNOWFLAKE_DATABASE,
        "schema": SNOWFLAKE_SCHEMA,
        "warehouse": SNOWFLAKE_WAREHOUSE,
        "role": SNOWFLAKE_ROLE,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, headers=_sql_headers(), json=body)

        if not response.is_success:
            raise RuntimeError(f"Snowflake SQL failed: {response.text}")

        payload = response.json()
        return payload.get("data", [])


async def search_chunks(question: str, limit: int = 6):
    if not question or not snowflake_enabled():
        return []

    terms = []
    seen = set()
    for chunk in question.lower().replace("?", " ").split():
        cleaned = chunk.strip(".,!;:'\"")
        if (
            len(cleaned) >= 3
            and cleaned not in {"what", "when", "where", "why", "how", "town", "council", "chapel", "hill"}
            and cleaned not in seen
        ):
            terms.append(cleaned)
            seen.add(cleaned)

    if not terms:
        return []

    clauses = " OR ".join(
        f'LOWER(TEXT) LIKE \'%{term.replace("'", "''")}%\'' for term in terms
    )
    sql = f"""
        SELECT
            chunk_id,
            item_id,
            event_id,
            meeting_date,
            source_name,
            source_url,
            page,
            text,
            topics,
            body,
            status
        FROM {SNOWFLAKE_DATABASE}.{SNOWFLAKE_SCHEMA}.CHUNKS
        WHERE {clauses}
        ORDER BY meeting_date DESC
        LIMIT {int(limit)}
    """

    rows = await execute_sql(sql)
    normalized = []
    for row in rows:
        if isinstance(row, dict):
            normalized.append(row)
    return normalized


async def generate_cortex_answer(question: str, context: str, model: str | None = None):
    if not snowflake_enabled():
        return None

    if not model:
        model = "claude-sonnet-4-5"

    url = f"{_base_url()}/api/v2/cortex/v1/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Answer only from the provided records. If the records do not support the answer, say so clearly. "
                    "Keep the answer concise and mention the relevant meeting date when useful."
                ),
            },
            {
                "role": "user",
                "content": f"CONTEXT:\n{context}\n\nQUESTION:\n{question}",
            },
        ],
        "temperature": 0,
        "max_tokens": 600,
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(url, headers=_sql_headers(), json=payload)

        if not response.is_success:
            raise RuntimeError(f"Snowflake Cortex call failed: {response.text}")

        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            return None

        first_choice = choices[0]
        message = first_choice.get("message") or {}
        content = message.get("content")
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if text:
                        parts.append(str(text))
            return " ".join(parts)
        return content
