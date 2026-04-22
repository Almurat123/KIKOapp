import unittest
from pathlib import Path

from orchestration import skill_resolver
from orchestration.prompt_assembler import assemble_messages
from orchestration.skill_resolver import resolve_skills


class ModelLedToolVisibilityTests(unittest.TestCase):
    def test_skill_loader_accepts_prompt_exec_md(self):
        self.assertIn("image_generation", skill_resolver.SKILL_BY_ID)
        self.assertIn("image_prompting", skill_resolver.SKILL_BY_ID)

    def test_image_prompt_guidance_routes_without_auto_generation_only_prompt_help(self):
        snapshot = {
            "lastUserMessage": "告诉我怎么写一个图片提示词",
            "model": "kimi-k2-5-reasoning",
            "runtime": {},
            "toolDefinitions": [],
        }

        resolution = resolve_skills(snapshot, trading_intent=None)

        self.assertIn("image_prompting", resolution["selectedSkills"])
        self.assertNotIn("image_generation", resolution["selectedSkills"])

    def test_image_generation_query_loads_prompt_guidance_and_generation_skill(self):
        snapshot = {
            "lastUserMessage": "帮我做一张赛博朋克风的产品海报",
            "model": "kimi-k2-5-reasoning",
            "runtime": {},
            "toolDefinitions": [],
        }

        resolution = resolve_skills(snapshot, trading_intent=None)

        self.assertIn("image_generation", resolution["selectedSkills"])
        self.assertIn("image_prompting", resolution["selectedSkills"])

    def test_skill_resolver_exposes_full_registry_when_model_led_enabled(self):
        snapshot = {
            "lastUserMessage": "请分析我的钱包资产结构",
            "model": "kimi-k2-5-reasoning",
            "runtime": {},
            "toolDefinitions": [
                {"name": "tool_a"},
                {"name": "tool_b"},
                {"name": "tool_c"},
            ],
        }

        resolution = resolve_skills(snapshot, trading_intent=None)

        self.assertEqual(resolution["allowedTools"], ["tool_a", "tool_b", "tool_c"])
        self.assertTrue(resolution["allowAllTools"])
        self.assertTrue(
            any("Model-led tool orchestration is enabled" in note for note in resolution["strategyNotes"]),
        )

    def test_prompt_assembler_emits_model_led_tool_block(self):
        snapshot = {
            "lastUserMessage": "生成一张方形图片",
            "runtime": {},
        }

        messages = assemble_messages(
            snapshot,
            skill_prompts=[],
            provider_info={},
            guidance={
                "allowAllTools": True,
                "strategyNotes": [
                    "Model-led tool orchestration is enabled: all registered tools are visible to the main model, and backend policy still blocks unsafe or unconfirmed side effects.",
                ],
            },
        )

        self.assertGreaterEqual(len(messages), 2)
        self.assertEqual(messages[0]["role"], "system")
        self.assertIn("[MODEL_LED_TOOL_ORCHESTRATION]", messages[0]["content"])
        self.assertIn("[TOOL_CONTEXT]", messages[-1]["content"])
        self.assertIn("Model-led tool orchestration is enabled", messages[-1]["content"])

    def test_skill_loader_skips_missing_directory_instead_of_raising(self):
        missing_root = Path("/tmp/definitely-missing-kiko-skills-exec")

        self.assertEqual(skill_resolver._load_skills(missing_root), [])


if __name__ == "__main__":
    unittest.main()
