from generation.tool_call_repair import infer_tool_name_from_arguments


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
