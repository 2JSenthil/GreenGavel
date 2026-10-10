import asyncio
import unittest

from app.services.answer_service import generate_answer
from app.services.feed_service import get_meetings


class DataBackendIntegrationTest(unittest.TestCase):
    def test_generate_answer_uses_local_data_for_real_query(self):
        result = asyncio.run(generate_answer("What did the town discuss about transit?"))

        self.assertIn("text", result)
        self.assertTrue(result["text"])
        self.assertGreater(len(result["sources"]), 0)

    def test_feed_service_returns_meetings_from_dataset(self):
        meetings = asyncio.run(get_meetings())

        self.assertIsInstance(meetings, list)
        self.assertGreater(len(meetings), 0)


if __name__ == "__main__":
    unittest.main()
