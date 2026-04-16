import unittest

from llm_gateway.adapters.openai_like import _resolve_nvidia_model


class NvidiaModelResolutionTests(unittest.TestCase):
    def test_glm_alias_enables_preserved_thinking(self):
        model, extra_body = _resolve_nvidia_model("glm-5")

        self.assertEqual(model, "z-ai/glm5")
        self.assertEqual(
            extra_body,
            {
                "chat_template_kwargs": {
                    "enable_thinking": True,
                    "clear_thinking": False,
                }
            },
        )

    def test_kimi_instant_disables_thinking(self):
        model, extra_body = _resolve_nvidia_model("kimi-k2-5-instant")

        self.assertEqual(model, "moonshotai/kimi-k2.5")
        self.assertEqual(extra_body, {"thinking": {"type": "disabled"}})


if __name__ == "__main__":
    unittest.main()
