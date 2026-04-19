import unittest

from llm_gateway.adapters.openai_like import (
    _build_openai_request_body,
    _summarize_openai_request_shape,
)
from llm_gateway.schemas import GenerateRequest


class OpenAIRequestDiagnosticsTests(unittest.TestCase):
    def test_omits_reasoning_effort_for_gpt54_chat_tools(self):
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "generate_image_from_intent",
                    "description": "Generate an image.",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        ]
        req = GenerateRequest(
            model="gpt-5.4-mini-2026-03-17",
            messages=[{"role": "user", "content": "make an image"}],
            tools=tools,
            tool_context={"reasoningEffort": "medium"},
        )

        body, omitted = _build_openai_request_body(req)

        self.assertEqual(omitted, "medium")
        self.assertNotIn("reasoning_effort", body)
        self.assertEqual(body["tools"], tools)
        self.assertEqual(body["tool_choice"], "auto")

    def test_keeps_reasoning_effort_for_gpt54_without_tools(self):
        req = GenerateRequest(
            model="gpt-5.4-mini-2026-03-17",
            messages=[{"role": "user", "content": "hello"}],
            tools=[],
            tool_context={"reasoningEffort": "medium"},
        )

        body, omitted = _build_openai_request_body(req)

        self.assertIsNone(omitted)
        self.assertEqual(body["reasoning_effort"], "medium")
        self.assertNotIn("tools", body)

    def test_summarizes_tool_shape_without_prompt_content(self):
        body = {
            "model": "gpt-5.4-mini-2026-03-17",
            "messages": [{"role": "user", "content": "do not log this prompt"}],
            "stream": True,
            "stream_options": {"include_usage": True},
            "reasoning_effort": "low",
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "valid_tool",
                        "description": "short",
                        "parameters": {"type": "object", "properties": {}},
                    },
                },
                {
                    "type": "function",
                    "function": {
                        "name": "bad tool name!",
                        "description": "x" * 1025,
                        "parameters": [],
                    },
                },
            ],
        }

        summary = _summarize_openai_request_shape(body)

        self.assertEqual(summary["message_count"], 1)
        self.assertEqual(summary["tool_count"], 2)
        self.assertEqual(summary["reasoning_effort"], "low")
        self.assertEqual(summary["invalid_tool_name_count"], 1)
        self.assertEqual(summary["long_tool_description_count"], 1)
        self.assertEqual(summary["non_object_tool_parameter_count"], 1)
        self.assertNotIn("do not log this prompt", str(summary))


if __name__ == "__main__":
    unittest.main()
