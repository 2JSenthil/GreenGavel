import os
import requests
from dotenv import load_dotenv

load_dotenv()

ACCOUNT = os.getenv("SNOWFLAKE_ACCOUNT_IDENTIFIER")
PAT = os.getenv("SNOWFLAKE_PAT")

url = f"https://{ACCOUNT.lower()}.snowflakecomputing.com/api/v2/statements"

headers = {
    "Authorization": f"Bearer {PAT}",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN"
}

body = {
    "statement": "SELECT CURRENT_USER(), CURRENT_ROLE();",
    "timeout": 30
}

print("URL:", url)
print("PAT loaded:", bool(PAT))

response = requests.post(
    url,
    headers=headers,
    json=body
)

print("STATUS:", response.status_code)
print(response.text)