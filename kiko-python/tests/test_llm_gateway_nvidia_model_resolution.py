import unittest

from llm_gateway.adapters.openai_like import (
    _resolve_nvidia_model,
    _resolve_nvidia_request_profile,
)


class NvidiaModelResolutionTests(unittest.TestCase):
    def test_glm_alias_defaults_to_low_temperature_without_thinking(self):
        model, temperature, extra_body = _resolve_nvidia_request_profile("glm-5")

        self.assertEqual(model, "z-ai/glm5")
        self.assertEqual(temperature, 0.3)
        self.assertEqual(
            extra_body,
            {
                "chat_template_kwargs": {
                    "enable_thinking": False,
                }
            },
        )

    def test_glm_reasoning_alias_preserves_thinking(self):
        model, temperature, extra_body = _resolve_nvidia_request_profile("glm-5-reasoning")

        self.assertEqual(model, "z-ai/glm5")
        self.assertEqual(temperature, 0.6)
        self.assertEqual(
            extra_body,
            {
                "chat_template_kwargs": {
                    "enable_thinking": True,
                    "clear_thinking": False,
                }
            },
        )

    def test_legacy_resolve_nvidia_model_wrapper_keeps_extra_body_shape(self):
        model, extra_body = _resolve_nvidia_model("glm-5")

        self.assertEqual(model, "z-ai/glm5")
        self.assertEqual(
            extra_body,
            {
                "chat_template_kwargs": {
                    "enable_thinking": False,
                }
            },
        )

    def test_kimi_instant_disables_thinking(self):
        model, temperature, extra_body = _resolve_nvidia_request_profile("kimi-k2-5-instant")

        self.assertEqual(model, "moonshotai/kimi-k2.5")
        self.assertEqual(temperature, 0.4)
        self.assertEqual(extra_body, {"thinking": {"type": "disabled"}})

    def test_kimi_reasoning_runs_colder_than_provider_showcase_default(self):
        model, temperature, extra_body = _resolve_nvidia_request_profile("kimi-k2-5-reasoning")

        self.assertEqual(model, "moonshotai/kimi-k2.5")
        self.assertEqual(temperature, 0.6)
        self.assertIsNone(extra_body)


if __name__ == "__main__":
    unittest.main()
