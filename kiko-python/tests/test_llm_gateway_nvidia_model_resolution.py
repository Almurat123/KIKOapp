import unittest

from llm_gateway.adapters.openai_like import (
    _build_nvidia_request_body,
    _resolve_nvidia_model,
    _resolve_nvidia_request_profile,
)
from llm_gateway.schemas import GenerateRequest, LLMMessage


class NvidiaModelResolutionTests(unittest.TestCase):
    def test_removed_glm_alias_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Removed NVIDIA model alias"):
            _resolve_nvidia_request_profile("glm-5")

    def test_removed_glm_reasoning_alias_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Removed NVIDIA model alias"):
            _resolve_nvidia_request_profile("glm-5-reasoning")

    def test_legacy_resolve_nvidia_model_wrapper_rejects_glm(self):
        with self.assertRaisesRegex(ValueError, "Removed NVIDIA model alias"):
            _resolve_nvidia_model("glm-5")

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

    def test_kimi_instant_direct_http_body_flattens_thinking_control(self):
        body = _build_nvidia_request_body(
            GenerateRequest(
                model="kimi-k2-5-instant",
                messages=[LLMMessage(role="user", content="test")],
            )
        )

        self.assertNotIn("extra_body", body)
        self.assertEqual(body.get("thinking"), {"type": "disabled"})

    def test_removed_glm_tool_request_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Removed NVIDIA model alias"):
            _build_nvidia_request_body(
                GenerateRequest(
                    model="glm-5",
                    messages=[LLMMessage(role="user", content="what time is it?")],
                    tools=[
                        {
                            "type": "function",
                            "function": {
                                "name": "get_current_time",
                                "description": "Get current time",
                                "parameters": {"type": "object", "properties": {}},
                            },
                        }
                    ],
                )
            )


if __name__ == "__main__":
    unittest.main()
