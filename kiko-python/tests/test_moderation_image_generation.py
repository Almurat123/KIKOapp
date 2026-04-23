import unittest

from fastapi.testclient import TestClient

from moderation import router
from moderation.models import moderation_models
from service_auth import require_internal_service


class _FakeModerationResult:
    flagged = False
    categories = {"violence": False}
    category_scores = {"violence": 0.01}
    category_applied_input_types = {"violence": ["text", "image"]}

    def model_dump(self):
        return {
            "flagged": self.flagged,
            "categories": self.categories,
            "category_scores": self.category_scores,
            "category_applied_input_types": self.category_applied_input_types,
        }


class _FakeModerations:
    def __init__(self):
        self.calls = []

    def create(self, model, input):
        self.calls.append({"model": model, "input": input})
        return type("FakeResponse", (), {"results": [_FakeModerationResult()]})()


class _FakeOpenAIClient:
    def __init__(self):
        self.moderations = _FakeModerations()


class _RaisingModerations:
    def create(self, model, input):
        raise RuntimeError("moderation transport failed")


class _RaisingOpenAIClient:
    def __init__(self):
        self.moderations = _RaisingModerations()


class GeneratedImageModerationTests(unittest.TestCase):
    def setUp(self):
        self._original_initialized = moderation_models.initialized
        self._original_client = getattr(moderation_models, "client", None)
        moderation_models.initialized = True

    def tearDown(self):
        moderation_models.initialized = self._original_initialized
        if self._original_client is None and hasattr(moderation_models, "client"):
            delattr(moderation_models, "client")
        else:
            moderation_models.client = self._original_client
        router.app.dependency_overrides.clear()

    def test_generated_image_moderation_sends_text_and_image_url_to_omni_model(self):
        fake_client = _FakeOpenAIClient()
        moderation_models.client = fake_client

        result = moderation_models.classify_image_generation(
            text="  draw a clean product photo  ",
            image_urls=[" https://example.com/reference.png ", ""],
        )

        self.assertFalse(result["flagged"])
        self.assertEqual(
            fake_client.moderations.calls,
            [
                {
                    "model": "omni-moderation-latest",
                    "input": [
                        {"type": "text", "text": "draw a clean product photo"},
                        {"type": "image_url", "image_url": {"url": "https://example.com/reference.png"}},
                    ],
                }
            ],
        )
        self.assertEqual(result["category_applied_input_types"], {"violence": ["text", "image"]})

    def test_generated_image_moderation_blocks_empty_input(self):
        result = moderation_models.classify_image_generation(text=" ", image_urls=[""])

        self.assertTrue(result["flagged"])
        self.assertTrue(result["categories"]["empty_image_generation_moderation_input"])
        self.assertEqual(result["error"], "empty_image_generation_moderation_input")

    def test_generated_image_moderation_fails_closed_on_openai_error(self):
        moderation_models.client = _RaisingOpenAIClient()

        result = moderation_models.classify_image_generation(text="draw this")

        self.assertTrue(result["flagged"])
        self.assertTrue(result["categories"]["moderation_error"])
        self.assertIn("moderation transport failed", result["error"])

    def test_image_generation_endpoint_blocks_flagged_result(self):
        original_classifier = router.moderation_models.classify_image_generation

        def fake_classifier(text="", image_urls=None):
            self.assertEqual(text, "unsafe image request")
            self.assertEqual(image_urls, ["https://example.com/generated.png"])
            return {
                "flagged": True,
                "categories": {"violence": True},
                "scores": {"violence": 0.99},
                "category_applied_input_types": {"violence": ["text", "image"]},
            }

        try:
            router.moderation_models.classify_image_generation = fake_classifier
            router.app.dependency_overrides[require_internal_service] = lambda: {"service": "test"}
            client = TestClient(router.app)

            response = client.post(
                "/image-generation",
                json={
                    "text": "unsafe image request",
                    "image_urls": ["https://example.com/generated.png"],
                    "stage": "generated_output",
                },
            )

            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertFalse(payload["safe"])
            self.assertEqual(payload["action"], "block")
            self.assertEqual(payload["stage"], "generated_output")
            self.assertTrue(payload["strict"])
            self.assertTrue(payload["checks"]["openai"]["flagged"])
        finally:
            router.moderation_models.classify_image_generation = original_classifier


if __name__ == "__main__":
    unittest.main()
