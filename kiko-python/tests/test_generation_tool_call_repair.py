from generation.tool_call_repair import infer_tool_name_from_arguments, parse_tool_arguments


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
