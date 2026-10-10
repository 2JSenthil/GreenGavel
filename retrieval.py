import os
import re
from pathlib import Path

import requests
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / ".env")

ACCOUNT = os.getenv("SNOWFLAKE_ACCOUNT_IDENTIFIER")
PAT = os.getenv("SNOWFLAKE_PAT")

ROLE = os.getenv("SNOWFLAKE_ROLE")
WAREHOUSE = os.getenv("SNOWFLAKE_WAREHOUSE")
DATABASE = os.getenv("SNOWFLAKE_DATABASE")
SCHEMA = os.getenv("SNOWFLAKE_SCHEMA")

SQL_URL = (
    f"https://{ACCOUNT.lower()}.snowflakecomputing.com/"
    "api/v2/statements"
)

HEADERS = {
    "Authorization": f"Bearer {PAT}",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN"
}

STOP_WORDS = {
    "what", "when", "where", "why", "how",
    "is", "are", "was", "were",
    "the", "a", "an",
    "of", "to", "in", "on", "for", "with",
    "about", "from", "and", "or",
    "has", "have", "had",
    "did", "does", "do",
    "can", "could", "would", "should",
    "chapel", "hill",
    "town", "city",
    "recently", "discussed", "discussion",
    "tell", "show", "give", "me"
}


def build_search_terms(question):
    """
    Pull useful search terms out of the user's question.
    """

    words = re.findall(r"[A-Za-z0-9'-]+", question.lower())

    terms = []

    for word in words:
        if len(word) < 3:
            continue

        if word in STOP_WORDS:
            continue

        if word not in terms:
            terms.append(word)

    return terms


def run_query(sql):
    """
    Send a SQL query to Snowflake using the SQL REST API.
    """

    body = {
        "statement": sql,
        "role": ROLE,
        "warehouse": WAREHOUSE,
        "database": DATABASE,
        "schema": SCHEMA,
        "timeout": 60
    }

    response = requests.post(
        SQL_URL,
        headers=HEADERS,
        json=body
    )

    if not response.ok:
        print("SNOWFLAKE STATUS:", response.status_code)
        print(response.text)
        response.raise_for_status()

    result = response.json()

    return result.get("data", [])


def retrieve_chunks(question, limit=8):
    """
    Search GREEN_GAVEL.PUBLIC.CHUNKS for records related
    to the user's question.
    """

    terms = build_search_terms(question)

    if not terms:
        return []

    conditions = []

    for term in terms:
        # Escape single quotes so the SQL remains valid.
        safe_term = term.replace("'", "''")

        conditions.append(
            f"LOWER(chunk_text) LIKE '%{safe_term.lower()}%'"
        )

    where_clause = " OR ".join(conditions)

    sql = f"""
    SELECT
        meeting_date,
        document_type,
        status,
        chunk_text,
        source_url
    FROM {DATABASE}.{SCHEMA}.CHUNKS
    WHERE {where_clause}
    ORDER BY meeting_date DESC
    LIMIT {int(limit)};
    """

    return run_query(sql)


if __name__ == "__main__":

    question = input("Test question: ")

    print("\nSEARCH TERMS:")
    print(build_search_terms(question))

    rows = retrieve_chunks(question)

    print(f"\nFOUND {len(rows)} CHUNKS\n")

    for row in rows:
        print("DATE:", row[0])
        print("TYPE:", row[1])
        print("STATUS:", row[2])
        print("TEXT:", row[3][:300])
        print("SOURCE:", row[4])
        print("-" * 60)