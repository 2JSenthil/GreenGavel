import importlib
import json
import os
import unittest
from unittest.mock import patch


class EnvConfigTest(unittest.TestCase):
    def test_env_values_are_trimmed(self):
        from app import config

        with patch.dict(
            os.environ,
            {
                "OPENROUTER_API_KEY": "  sk_test_123  ",
                "OPENROUTER_MODEL": "  openai/gpt-4o-mini  ",
                "ELEVENLABS_API_KEY": "  sk_test_456  ",
                "ELEVENLABS_VOICE_ID": "  voice_456  ",
                "SNOWFLAKE_ACCOUNT_IDENTIFIER": "  acct  ",
                "SNOWFLAKE_PAT": "  pat  ",
                "SNOWFLAKE_ROLE": "  role  ",
                "SNOWFLAKE_WAREHOUSE": "  wh  ",
                "SNOWFLAKE_DATABASE": "  db  ",
                "SNOWFLAKE_SCHEMA": "  schema  ",
            },
            clear=False,
        ):
            config = importlib.reload(config)
            self.assertEqual(config.OPENROUTER_API_KEY, "sk_test_123")
            self.assertEqual(config.OPENROUTER_MODEL, "openai/gpt-4o-mini")
            self.assertEqual(config.ELEVENLABS_API_KEY, "sk_test_456")
            self.assertEqual(config.ELEVENLABS_VOICE_ID, "voice_456")
            self.assertEqual(config.SNOWFLAKE_ACCOUNT, "acct")
            self.assertEqual(config.SNOWFLAKE_PAT, "pat")
            self.assertEqual(config.SNOWFLAKE_ROLE, "role")
            self.assertEqual(config.SNOWFLAKE_WAREHOUSE, "wh")
            self.assertEqual(config.SNOWFLAKE_DATABASE, "db")
            self.assertEqual(config.SNOWFLAKE_SCHEMA, "schema")


class OpenRouterRetryTest(unittest.TestCase):
    def test_ask_llm_retries_after_rate_limit(self):
        import llm

        class FakeResponse:
            def __init__(self, ok, payload, status_code):
                self.ok = ok
                self.status_code = status_code
                self._payload = payload
                self.text = json.dumps(payload)

            def json(self):
                return self._payload

        calls = []

        def fake_post(*args, **kwargs):
            calls.append(True)
            if len(calls) < 3:
                return FakeResponse(False, {"error": "429"}, 429)
            return FakeResponse(
                True,
                {"choices": [{"message": {"content": "Recovered answer"}}]},
                200,
            )

        original_post = llm.requests.post
        original_sleep = llm.time.sleep
        original_key = llm.OPENROUTER_API_KEY
        original_model = llm.OPENROUTER_MODEL
        try:
            llm.OPENROUTER_API_KEY = "test-key"
            llm.OPENROUTER_MODEL = "openai/gpt-4o-mini"
            llm.requests.post = fake_post
            llm.time.sleep = lambda _: None
            answer = llm.ask_llm("What happened?", "Context goes here.", max_retries=3)
            self.assertEqual(answer, "Recovered answer")
            self.assertEqual(len(calls), 3)
        finally:
            llm.requests.post = original_post
            llm.time.sleep = original_sleep
            llm.OPENROUTER_API_KEY = original_key
            llm.OPENROUTER_MODEL = original_model


if __name__ == "__main__":
    unittest.main()
