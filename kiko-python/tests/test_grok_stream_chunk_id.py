import unittest

from grok.tool_events import build_stream_chunk_id, build_tool_status_chunk


class GrokStreamChunkIdTests(unittest.TestCase):
    def test_build_stream_chunk_id_uses_response_id_when_available(self):
        self.assertEqual(
            build_stream_chunk_id(request_hash=-12345, response_id="resp_abc123"),
            "resp_abc123",
        )

    def test_build_stream_chunk_id_uses_stable_non_chatcmpl_fallback(self):
        chunk_id = build_stream_chunk_id(request_hash=-12345)
        self.assertEqual(chunk_id, "kiko-grok-12345")
        self.assertFalse(chunk_id.startswith("chatcmpl-"))

    def test_tool_status_chunk_uses_safe_chunk_id_by_default(self):
        chunk = build_tool_status_chunk(
            request_hash=-98765,
            model="grok-4",
            status="started",
        )
        self.assertEqual(chunk["id"], "kiko-grok-98765")
        self.assertFalse(chunk["id"].startswith("chatcmpl-"))

    def test_tool_status_chunk_respects_explicit_chunk_id(self):
        chunk = build_tool_status_chunk(
            request_hash=42,
            chunk_id="resp_final_42",
            model="grok-4",
            status="finished",
        )
        self.assertEqual(chunk["id"], "resp_final_42")


if __name__ == "__main__":
    unittest.main()
