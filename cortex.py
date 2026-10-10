import os
import requests
from dotenv import load_dotenv

load_dotenv()

ACCOUNT = os.getenv("SNOWFLAKE_ACCOUNT_IDENTIFIER")
PAT = os.getenv("SNOWFLAKE_PAT")

url = (
    f"https://{ACCOUNT.lower()}.snowflakecomputing.com/"
    "api/v2/cortex/v1/chat/completions"
)

headers = {
    "Authorization": f"Bearer {PAT}",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN"
}


def ask_cortex(question, context):
    body = {
        "model": "openai-gpt-5",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are Green Gavel, an assistant that explains "
                    "Chapel Hill local government information. "
                    "Answer only using the provided context. "
                    "If the context does not support an answer, say so."
                )
            },
            {
                "role": "user",
                "content": f"""
CONTEXT:
{context}

QUESTION:
{question}

Give a concise answer and mention relevant meeting dates when useful.
"""
            }
        ]
    }

    response = requests.post(
        url,
        headers=headers,
        json=body
    )

    print("CORTEX STATUS:", response.status_code)

    if not response.ok:
        print(response.text)
        response.raise_for_status()

    result = response.json()

    return result["choices"][0]["message"]["content"]