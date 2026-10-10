import os
import requests
from dotenv import load_dotenv

load_dotenv()

ACCOUNT = os.getenv("SNOWFLAKE_ACCOUNT_IDENTIFIER")
PAT = os.getenv("SNOWFLAKE_PAT")

ROLE = os.getenv("SNOWFLAKE_ROLE")
WAREHOUSE = os.getenv("SNOWFLAKE_WAREHOUSE")
DATABASE = os.getenv("SNOWFLAKE_DATABASE")
SCHEMA = os.getenv("SNOWFLAKE_SCHEMA")

url = f"https://{ACCOUNT.lower()}.snowflakecomputing.com/api/v2/statements"

headers = {
    "Authorization": f"Bearer {PAT}",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN"
}

sql = """
SELECT
    meeting_date,
    document_type,
    status,
    chunk_text,
    source_url
FROM GREEN_GAVEL.PUBLIC.CHUNKS
WHERE
    LOWER(chunk_text) LIKE '%stormwater%'
    OR LOWER(chunk_text) LIKE '%flood%'
    OR LOWER(chunk_text) LIKE '%drainage%'
    OR LOWER(chunk_text) LIKE '%watershed%'
ORDER BY meeting_date DESC
LIMIT 8;
"""

body = {
    "statement": sql,
    "role": ROLE,
    "warehouse": WAREHOUSE,
    "database": DATABASE,
    "schema": SCHEMA,
    "timeout": 60
}

print("URL:", url)
print("PAT loaded:", bool(PAT))
print("ROLE:", ROLE)
print("WAREHOUSE:", WAREHOUSE)
print("DATABASE:", DATABASE)
print("SCHEMA:", SCHEMA)

response = requests.post(
    url,
    headers=headers,
    json=body
)

print("STATUS:", response.status_code)

if response.ok:
    result = response.json()

    rows = result.get("data", [])

    print(f"\nFound {len(rows)} rows\n")

    for row in rows:
        print("DATE:", row[0])
        print("TYPE:", row[1])
        print("STATUS:", row[2])
        print("TEXT:", row[3][:300])
        print("SOURCE:", row[4])
        print("-" * 60)

else:
    print(response.text)