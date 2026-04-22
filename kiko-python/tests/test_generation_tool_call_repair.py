from generation.tool_call_repair import infer_tool_name_from_arguments, normalize_tool_argument_delta, parse_tool_arguments
from generation.tool_result_repair import (
    build_empty_tool_result_final_answer_repair_message,
    build_visible_tool_result_fallback,
    should_retry_empty_tool_result_final_answer,
)
from generation.app import merge_tool_call_deltas
from orchestration.service import _merge_tool_call_deltas


def test_infer_tool_name_from_arguments_repairs_empty_wallet_pnl_call():
    tools = [
        {
            "type": "function",
            "function": {
                "name": "analyze_wallet_pnl",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "address": {"type": "string"},
                        "chain": {"type": "string"},
                        "chain_id": {"type": "number"},
                        "days": {"type": "number"},
                    },
                    "required": ["address"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_wallet_info",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "address": {"type": "string"},
                        "chain_id": {"type": "number"},
                    },
                    "required": ["address"],
                },
            },
        },
    ]

    inferred = infer_tool_name_from_arguments(
        tools,
        {
            "address": "0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B",
            "chain": "base",
            "chain_id": 8453,
            "days": 30,
        },
    )

    assert inferred == "analyze_wallet_pnl"


def test_parse_tool_arguments_repairs_leading_comma_fragment():
    parsed = parse_tool_arguments(
        ',"subject":"Full moon in night sky","scene":"Serene night sky","style":"Cinematic","aspect_ratio":"16:9"'
    )

    assert parsed == {
        "subject": "Full moon in night sky",
        "scene": "Serene night sky",
        "style": "Cinematic",
        "aspect_ratio": "16:9",
    }


def test_normalize_tool_argument_delta_serializes_provider_dict_arguments():
    assert normalize_tool_argument_delta({"limit": 5, "active": True}) == '{"limit": 5, "active": true}'


def test_infer_tool_name_from_repaired_image_arguments():
    tools = [
        {
            "type": "function",
            "function": {
                "name": "generate_image_from_intent",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "user_intent": {"type": "string"},
                        "subject": {"type": "string"},
                        "scene": {"type": "string"},
                        "style": {"type": "string"},
                        "aspect_ratio": {"type": "string"},
                        "edit_or_generate": {"type": "string"},
                    },
                    "required": ["user_intent"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_wallet_info",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "address": {"type": "string"},
                        "chain_id": {"type": "number"},
                    },
                    "required": ["address"],
                },
            },
        },
    ]

    parsed = parse_tool_arguments(
        ',"subject":"Full moon in night sky","scene":"Serene night sky","style":"Cinematic","aspect_ratio":"16:9","edit_or_generate":"generate"'
    )
    inferred = infer_tool_name_from_arguments(tools, parsed)

    assert inferred == "generate_image_from_intent"


def test_generation_merges_id_first_then_index_only_tool_call_chunks():
    acc = {}

    merge_tool_call_deltas(
        acc,
        [
            {
                "index": 0,
                "id": "call_123",
                "type": "function",
                "function": {"name": "list_copy_trade_configs", "arguments": ""},
            }
        ],
    )
    merge_tool_call_deltas(
        acc,
        [
            {
                "index": 0,
                "function": {"arguments": '{"status":"active"}'},
            }
        ],
    )

    assert list(acc.keys()) == ["idx:0"]
    call = acc["idx:0"]
    assert call["id"] == "call_123"
    assert call["function"]["name"] == "list_copy_trade_configs"
    assert call["function"]["arguments"] == '{"status":"active"}'


def test_orchestration_merges_id_first_then_index_only_tool_call_chunks():
    acc = {}

    _merge_tool_call_deltas(
        acc,
        [
            {
                "index": 0,
                "id": "call_456",
                "type": "function",
                "function": {"name": "get_polymarket_market_overview", "arguments": ""},
            }
        ],
    )
    _merge_tool_call_deltas(
        acc,
        [
            {
                "index": 0,
                "function": {"arguments": '{"limit":5}'},
            }
        ],
    )

    assert list(acc.keys()) == ["idx:0"]
    call = acc["idx:0"]
    assert call["id"] == "call_456"
    assert call["function"]["name"] == "get_polymarket_market_overview"
    assert call["function"]["arguments"] == '{"limit":5}'


def test_retries_empty_visible_answer_after_tool_result_reasoning_only():
    messages = [
        {"role": "assistant", "tool_calls": [{"id": "call_1", "function": {"name": "list_copy_trade_configs"}}]},
        {"role": "tool", "tool_call_id": "call_1", "content": '{"ok":true}'},
    ]

    assert should_retry_empty_tool_result_final_answer(
        messages,
        "",
        "TOOL_RESULT_OK_copy_trade_kimi_k2_5_instant",
        already_attempted=False,
    )
    repair_message = build_empty_tool_result_final_answer_repair_message()
    assert repair_message["role"] == "system"
    assert "Do not call tools" in repair_message["content"]


def test_does_not_retry_empty_visible_answer_without_tool_result_or_twice():
    assert not should_retry_empty_tool_result_final_answer(
        [{"role": "user", "content": "hello"}],
        "",
        "hidden",
        already_attempted=False,
    )
    assert not should_retry_empty_tool_result_final_answer(
        [{"role": "tool", "content": '{"ok":true}'}],
        "",
        "hidden",
        already_attempted=True,
    )
    assert not should_retry_empty_tool_result_final_answer(
        [{"role": "tool", "content": '{"ok":true}'}],
        "visible answer",
        "hidden",
        already_attempted=False,
    )


def test_visible_tool_result_fallback_uses_latest_tool_content_not_reasoning():
    fallback = build_visible_tool_result_fallback([
        {"role": "tool", "content": '{"marker":"TOOL_RESULT_OK_copy_trade","summary":"2 active configs"}'},
        {"role": "system", "content": "repair"},
    ])

    assert fallback
    assert "TOOL_RESULT_OK_copy_trade" in fallback
    assert "2 active configs" in fallback
    assert "empty visible answer" not in fallback
    assert "model produced" not in fallback


def test_visible_tool_result_fallback_does_not_promote_reasoning_text():
    fallback = build_visible_tool_result_fallback([
        {
            "role": "assistant",
            "reasoning_content": "Hidden model answer that must not be shown",
        },
        {
            "role": "tool",
            "content": '{"marker":"TOOL_RESULT_OK_copy_trade","note":"Tool completed"}',
        },
        {
            "role": "system",
            "content": "repair",
        },
    ])

    assert fallback
    assert "TOOL_RESULT_OK_copy_trade" in fallback
    assert "Tool completed" in fallback
    assert "Hidden model answer" not in fallback


def test_visible_tool_result_fallback_summarizes_business_result_fields():
    fallback = build_visible_tool_result_fallback([
        {
            "role": "tool",
            "content": (
                '{"status":"success","configs":['
                '{"name":"wallet A","chain":"base","enabled":true,"maxAmount":0.2},'
                '{"name":"wallet B","chain":"solana","enabled":false,"maxAmount":1.5}'
                ']}'
            ),
        },
    ])

    assert fallback
    assert "status: success" in fallback
    assert "configs: name=wallet A, chain=base, enabled=true, maxAmount=0.2" in fallback


def test_visible_tool_result_fallback_returns_none_without_tool_content():
    assert build_visible_tool_result_fallback([{"role": "user", "content": "hello"}]) is None
