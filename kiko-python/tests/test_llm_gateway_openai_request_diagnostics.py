import unittest

from llm_gateway.adapters.openai_like import (
    _build_openai_request_body,
    _build_openai_responses_request_body,
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

    def test_keeps_forced_tool_choice_for_image_execution_mode(self):
        tool_choice = {
            "type": "function",
            "function": {"name": "generate_image_from_intent"},
        }
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
            tool_choice=tool_choice,
        )

        body, omitted = _build_openai_request_body(req)

        self.assertIsNone(omitted)
        self.assertEqual(body["tool_choice"], tool_choice)

    def test_builds_responses_request_for_forced_image_function_call(self):
        tool_choice = {
            "type": "function",
            "function": {"name": "generate_image_from_intent"},
        }
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
            api_mode="responses",
            messages=[
                {"role": "system", "content": "You are the image controller."},
                {"role": "user", "content": "Generate a rock style poster."},
            ],
            tools=tools,
            tool_choice=tool_choice,
            tool_context={"reasoningEffort": "medium"},
            metadata={"session_id": "session-1"},
        )

        body = _build_openai_responses_request_body(req)

        self.assertEqual(body["model"], "gpt-5.4-mini-2026-03-17")
        self.assertEqual(body["tool_choice"], {"type": "function", "name": "generate_image_from_intent"})
        self.assertEqual(body["reasoning"], {"effort": "medium"})
        self.assertEqual(body["metadata"], {"session_id": "session-1"})
        self.assertEqual(body["input"][0]["role"], "developer")
        self.assertEqual(body["input"][0]["content"][0]["type"], "input_text")
        self.assertEqual(body["input"][1]["role"], "user")
        self.assertEqual(body["tools"][0]["type"], "function")
        self.assertEqual(body["tools"][0]["name"], "generate_image_from_intent")
        self.assertEqual(body["tools"][0]["strict"], True)
        self.assertEqual(body["store"], True)
        self.assertEqual(body["tools"][0]["parameters"]["additionalProperties"], False)
        self.assertEqual(
            sorted(body["tools"][0]["parameters"]["required"]),
            sorted(body["tools"][0]["parameters"]["properties"].keys()),
        )

    def test_builds_responses_request_with_assistant_history_as_output_text(self):
        req = GenerateRequest(
            model="gpt-5.4-mini-2026-03-17",
            api_mode="responses",
            messages=[
                {"role": "system", "content": "You are the wallet controller."},
                {"role": "user", "content": "Check my wallet holdings."},
                {"role": "assistant", "content": "I can inspect your wallet context first."},
                {"role": "user", "content": "你看不到上下文吗"},
            ],
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "read_wallet_state",
                        "description": "Read wallet state.",
                        "parameters": {"type": "object", "properties": {}},
                    },
                }
            ],
        )

        body = _build_openai_responses_request_body(req)

        self.assertEqual(body["input"][2]["role"], "assistant")
        self.assertEqual(body["input"][2]["content"][0]["type"], "output_text")
        self.assertEqual(body["input"][2]["content"][0]["text"], "I can inspect your wallet context first.")

    def test_normalizes_responses_strict_schema_for_optional_and_nested_fields(self):
        req = GenerateRequest(
            model="gpt-5.4-mini-2026-03-17",
            api_mode="responses",
            messages=[{"role": "user", "content": "edit this image"}],
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "generate_image_from_intent",
                        "description": "Generate or edit an image.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "user_intent": {"type": "string"},
                                "style_hint": {"type": "string"},
                                "reference_images": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "url": {"type": "string"},
                                            "description": {"type": "string"},
                                        },
                                        "required": ["url"],
                                    },
                                },
                            },
                            "required": ["user_intent"],
                        },
                    },
                }
            ],
        )

        body = _build_openai_responses_request_body(req)
        schema = body["tools"][0]["parameters"]

        self.assertEqual(schema["additionalProperties"], False)
        self.assertEqual(schema["required"], ["user_intent", "style_hint", "reference_images"])
        self.assertEqual(schema["properties"]["style_hint"]["type"], ["string", "null"])

        nested = schema["properties"]["reference_images"]["items"]
        self.assertEqual(nested["additionalProperties"], False)
        self.assertEqual(nested["required"], ["url", "description"])
        self.assertEqual(nested["properties"]["description"]["type"], ["string", "null"])

    def test_normalizes_empty_object_parameters_for_responses_strict_schema(self):
        req = GenerateRequest(
            model="gpt-5.4-mini-2026-03-17",
            api_mode="responses",
            messages=[{"role": "user", "content": "read context"}],
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "read_social_images",
                        "description": "Read social image context.",
                        "parameters": {"type": "object", "properties": {}},
                    },
                }
            ],
        )

        body = _build_openai_responses_request_body(req)
        schema = body["tools"][0]["parameters"]

        self.assertEqual(schema["type"], "object")
        self.assertEqual(schema["properties"], {})
        self.assertEqual(schema["required"], [])
        self.assertEqual(schema["additionalProperties"], False)

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

    def test_summarizes_flattened_responses_tool_shape(self):
        body = {
            "model": "gpt-5.4-mini-2026-03-17",
            "input": [{"role": "user", "content": [{"type": "input_text", "text": "generate"}]}],
            "stream": True,
            "tools": [
                {
                    "type": "function",
                    "name": "generate_image_from_intent",
                    "description": "Generate an image.",
                    "parameters": {"type": "object", "properties": {}, "required": [], "additionalProperties": False},
                    "strict": True,
                }
            ],
        }

        summary = _summarize_openai_request_shape(body)

        self.assertEqual(summary["tool_count"], 1)
        self.assertEqual(summary["first_tool_names"], ["generate_image_from_intent"])


if __name__ == "__main__":
    unittest.main()
