import unittest

from llm_gateway.adapters.openai_like import (
    is_suspicious_provider_request_id,
    promote_provider_request_id,
)


class ProviderRequestIdPromotionTests(unittest.TestCase):
    def test_xai_numeric_chatcmpl_ids_are_treated_as_suspicious(self):
        self.assertTrue(is_suspicious_provider_request_id("chatcmpl-123456", "xai"))
        self.assertTrue(is_suspicious_provider_request_id("chatcmpl--123456", "xai"))
        self.assertFalse(is_suspicious_provider_request_id("resp_abc123", "xai"))

    def test_response_id_overrides_suspicious_chunk_id_for_xai(self):
        current = promote_provider_request_id(None, "chatcmpl-123456", provider="xai", prefer=False)
        self.assertIsNone(current)

        current = promote_provider_request_id(current, "resp_abc123", provider="xai", prefer=True)
        self.assertEqual(current, "resp_abc123")

    def test_non_suspicious_existing_id_is_kept_unless_preferred_candidate_arrives(self):
        current = promote_provider_request_id(None, "resp_first", provider="xai", prefer=False)
        self.assertEqual(current, "resp_first")

        same_round = promote_provider_request_id(current, "resp_later", provider="xai", prefer=False)
        self.assertEqual(same_round, "resp_first")

        preferred = promote_provider_request_id(current, "resp_final", provider="xai", prefer=True)
        self.assertEqual(preferred, "resp_final")


if __name__ == "__main__":
    unittest.main()
