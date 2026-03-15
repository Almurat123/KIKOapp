import unittest

from grok.tool_policy import resolve_requested_tool_policy


class GrokToolPolicyTests(unittest.TestCase):
    def test_non_reasoning_model_keeps_x_search_when_explicitly_enabled(self):
        policy = resolve_requested_tool_policy(
            {
                "native_tools": {
                    "enable_search": True,
                    "enabled_tools": ["web_search", "x_search"],
                    "required": True,
                    "preferred_required_tool": "x_search",
                }
            },
            enable_search_default=False,
            allow_extra_sdk_tools_default=False,
            is_non_reasoning_model=True,
        )

        self.assertEqual(policy["native_tools"]["enabled_tools"], ["web_search", "x_search"])
        self.assertEqual(policy["native_tools"]["preferred_required_tool"], "x_search")

    def test_search_defaults_keep_x_search_for_non_reasoning_models(self):
        policy = resolve_requested_tool_policy(
            {
                "native_tools": {
                    "enable_search": True,
                    "enabled_tools": [],
                    "required": True,
                    "preferred_required_tool": "x_search",
                }
            },
            enable_search_default=True,
            allow_extra_sdk_tools_default=False,
            is_non_reasoning_model=True,
        )

        self.assertEqual(policy["native_tools"]["enabled_tools"], ["web_search", "x_search"])
        self.assertEqual(policy["native_tools"]["preferred_required_tool"], "x_search")


if __name__ == "__main__":
    unittest.main()
