import unittest

from llm_gateway.adapters.openai_like import _extract_reasoning_delta


class ReasoningExtractionTests(unittest.TestCase):
    def test_plain_content_string_does_not_become_reasoning(self):
        data = {}
        choice = {"delta": {"content": "Visible assistant text."}}
        delta = choice["delta"]

        self.assertEqual(_extract_reasoning_delta(data, choice, delta), "")

    def test_typed_reasoning_content_part_is_preserved(self):
        data = {}
        choice = {
            "delta": {
                "content": [
                    {"type": "reasoning", "text": "Hidden reasoning."},
                    {"type": "text", "text": "Visible assistant text."},
                ]
            }
        }
        delta = choice["delta"]

        self.assertEqual(_extract_reasoning_delta(data, choice, delta), "Hidden reasoning.")

    def test_explicit_reasoning_field_string_is_preserved(self):
        data = {}
        choice = {"delta": {"reasoning_content": "Hidden reasoning."}}
        delta = choice["delta"]

        self.assertEqual(_extract_reasoning_delta(data, choice, delta), "Hidden reasoning.")


if __name__ == "__main__":
    unittest.main()
