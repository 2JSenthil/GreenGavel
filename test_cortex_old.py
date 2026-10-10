import os
import requests
from dotenv import load_dotenv

load_dotenv()

ACCOUNT = os.getenv("SNOWFLAKE_ACCOUNT_IDENTIFIER")
PAT = os.getenv("SNOWFLAKE_PAT")

url = (
    f"https://{ACCOUNT.lower()}.snowflakecomputing.com/"
    "api/v2/cortex/inference:complete"
)

headers = {
    "Authorization": f"Bearer {PAT}",
    "Content-Type": "application/json"
}

body = {
    "model": "claude-3-5-sonnet",
    "messages": [
        {
            "role": "user",
            "content": "Say hello in one sentence."
        }
    ]
}

response = requests.post(
    url,
    headers=headers,
    json=body
)

print("URL:", url)
print("STATUS:", response.status_code)
print(response.text)