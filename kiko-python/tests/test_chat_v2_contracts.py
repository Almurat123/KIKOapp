from __future__ import annotations

import unittest

from chat_v2.intent import parse_intent
from chat_v2.prompt_orchestrator import prompt_modules, prompt_orchestrator
from tool_runtime.app import _native_get_wallet_info, _native_prepare_swap_transaction


class ChatV2ContractTests(unittest.IsolatedAsyncioTestCase):
    def test_intent_labels(self):
        t1 = parse_intent("swap 10 usdc to eth")
        self.assertEqual(t1.high_level["type"], "TRADING")

        t2 = parse_intent("is this token safe?")
        self.assertIn(t2.high_level["type"], {"RISK_SCAN", "MARKET_ANALYSIS"})

        t3 = parse_intent("what are people betting on polymarket?")
        self.assertEqual(t3.high_level["type"], "PREDICTION_MARKETS")

    def test_prompt_modules_loaded(self):
        self.assertGreater(len(prompt_modules.core_execution), 100)
        self.assertGreater(len(prompt_modules.core_thinking), 50)
        self.assertGreater(len(prompt_modules.intent_policy), 50)

    def test_prompt_orchestrator_output(self):
        p = prompt_orchestrator.get_system_prompt("deepseek-chat", "TRADING", "execution")
        self.assertIn("KiKo", p)
        built = prompt_orchestrator.build_prompt(
            "swap 1 eth to usdc",
            {"userAddress": "0xabc", "isWalletConnected": True},
            "TRADING",
        )
        self.assertIn("[CONTEXT]", built)
        self.assertIn("[USER_QUERY]", built)

    async def test_native_wallet_info_contract(self):
        result = await _native_get_wallet_info(
            {},
            {
                "walletAddress": "0xabc",
                "chainId": 8453,
                "nativeBalance": "0.5",
                "balance": {"USDC": "120.1"},
            },
        )
        self.assertEqual(result["address"], "0xabc")
        self.assertEqual(result["chain"], "base")
        self.assertEqual(result["ethBalance"], "0.5")
        self.assertIsInstance(result["tokens"], list)

    async def test_native_prepare_swap_contract(self):
        result = await _native_prepare_swap_transaction(
            {"token_in": "ETH", "token_out": "USDC", "amount_in": "1"},
            {"walletAddress": "0xabc", "chainId": 8453},
        )
        self.assertTrue(result.get("_must_stop"))
        self.assertIn("_user_message", result)


if __name__ == "__main__":
    unittest.main()
