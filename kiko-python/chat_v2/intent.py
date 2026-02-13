from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


IntentType = str


@dataclass
class IntentResult:
    high_level: dict[str, Any]
    detailed: dict[str, Any]
    decision: dict[str, Any]
    contract_address: str | None = None
    chain_id: int | None = None
    swap_intent: dict[str, Any] | None = None


EVM_ADDR_RE = re.compile(r"\b0x[a-fA-F0-9]{40}\b")
SOL_ADDR_RE = re.compile(r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b")


def _extract_contract_address(text: str) -> tuple[str | None, int | None]:
    evm = EVM_ADDR_RE.search(text)
    if evm:
        return evm.group(0), 8453
    sol = SOL_ADDR_RE.search(text)
    if sol:
        return sol.group(0), 900
    return None, None


def _detect_swap_slots(text: str) -> dict[str, Any]:
    # Examples: "swap 100 usdc to eth", "buy pepe with 0.1 eth", "sell all usdc to eth"
    amount = None
    token_in = None
    token_out = None
    amount_semantic = "input"

    m = re.search(
        r"\b(?:swap|trade|convert|exchange)\s+([\d.]+)\s+([a-zA-Z0-9._-]+)\s+(?:to|for)\s+([a-zA-Z0-9._-]+)\b",
        text,
        flags=re.IGNORECASE,
    )
    if m:
        amount = m.group(1)
        token_in = m.group(2)
        token_out = m.group(3)
        amount_semantic = "input"

    if amount is None:
        buy = re.search(
            r"\b(?:buy|ape)\s+([a-zA-Z0-9._-]+)\s+(?:with)\s+([\d.]+)\s+([a-zA-Z0-9._-]+)\b",
            text,
            flags=re.IGNORECASE,
        )
        if buy:
            token_out = buy.group(1)
            amount = buy.group(2)
            token_in = buy.group(3)
            amount_semantic = "output"

    # "buy 1 USDC use ETH" / "buy 1 usdc using eth"
    if amount is None:
        buy_use = re.search(
            r"\b(?:buy)\s+([\d.]+)\s+([a-zA-Z0-9._-]+)\s+(?:use|using)\s+([a-zA-Z0-9._-]+)\b",
            text,
            flags=re.IGNORECASE,
        )
        if buy_use:
            amount = buy_use.group(1)
            token_out = buy_use.group(2)
            token_in = buy_use.group(3)
            amount_semantic = "output"

    # "use ETH buy 1 USDC"
    if amount is None:
        use_buy = re.search(
            r"\b(?:use|using)\s+([a-zA-Z0-9._-]+)\s+(?:to\s+)?buy\s+([\d.]+)\s+([a-zA-Z0-9._-]+)\b",
            text,
            flags=re.IGNORECASE,
        )
        if use_buy:
            token_in = use_buy.group(1)
            amount = use_buy.group(2)
            token_out = use_buy.group(3)
            amount_semantic = "output"

    # "sell all USDC to ETH"
    if amount is None:
        sell_all = re.search(
            r"\b(?:sell)\s+(all)\s+([a-zA-Z0-9._-]+)\s+(?:to|for)\s+([a-zA-Z0-9._-]+)\b",
            text,
            flags=re.IGNORECASE,
        )
        if sell_all:
            amount = sell_all.group(1).lower()
            token_in = sell_all.group(2)
            token_out = sell_all.group(3)
            amount_semantic = "input"

    # "sell 10 USDC to ETH"
    if amount is None:
        sell_num = re.search(
            r"\b(?:sell)\s+([\d.]+)\s+([a-zA-Z0-9._-]+)\s+(?:to|for)\s+([a-zA-Z0-9._-]+)\b",
            text,
            flags=re.IGNORECASE,
        )
        if sell_num:
            amount = sell_num.group(1)
            token_in = sell_num.group(2)
            token_out = sell_num.group(3)
            amount_semantic = "input"

    return {
        "token_in": token_in,
        "token_out": token_out,
        "amount": amount,
        "amount_semantic": amount_semantic,
    }


def parse_intent(message: str, context: dict[str, Any] | None = None) -> IntentResult:
    text = (message or "").strip()
    lower = text.lower()

    contract_address, detected_chain = _extract_contract_address(text)
    swap_slots = _detect_swap_slots(text)

    has_trade = bool(re.search(r"\b(swap|trade|buy|sell|convert|exchange|下单|买|卖|兑换)\b", lower))
    has_copy = bool(re.search(r"\b(copy ?trade|copytrading|跟单)\b", lower))
    has_prediction = bool(re.search(r"\b(polymarket|prediction|odds|bet|market implied)\b", lower))
    has_risk = bool(re.search(r"\b(risk|safe|scam|rug|honeypot|security|安全吗|风险)\b", lower))
    has_social = bool(re.search(r"\b(farcaster|cast|twitter|x.com|social|sentiment)\b", lower))
    has_market = bool(
        re.search(r"\b(token|price|chart|market|volume|liquidity|pnl|portfolio|wallet|行情|价格)\b", lower)
        or contract_address
    )

    labels: list[tuple[IntentType, float]] = []
    if has_prediction:
        labels.append(("PREDICTION_MARKETS", 0.9))
    if has_copy:
        labels.append(("COPY_TRADING", 0.9))
    if has_trade:
        labels.append(("TRADING", 0.88))
    if has_risk:
        labels.append(("RISK_SCAN", 0.8))
    if has_social:
        labels.append(("SOCIAL_SENSING", 0.78))
    if has_market:
        labels.append(("MARKET_ANALYSIS", 0.75))
    if not labels:
        labels.append(("GENERAL_CHAT", 0.65))

    # Keep priority aligned with Node intent policy.
    priority = [
        "PREDICTION_MARKETS",
        "COPY_TRADING",
        "TRADING",
        "RISK_SCAN",
        "MARKET_ANALYSIS",
        "SOCIAL_SENSING",
        "GENERAL_CHAT",
    ]
    labels.sort(key=lambda x: (priority.index(x[0]), -x[1]))
    primary = labels[0][0]
    confidence = labels[0][1]

    conflict = None
    if has_trade and has_risk:
        conflict = {
            "type": "risk_trade",
            "labels": ["TRADING", "RISK_SCAN"],
            "question": "Trade now or safety check first?",
        }

    detailed_action = "general_query"
    if primary in ("TRADING", "COPY_TRADING"):
        detailed_action = "swap" if has_trade else "general_query"
    elif primary == "MARKET_ANALYSIS":
        detailed_action = "token_info"
    elif primary == "RISK_SCAN":
        detailed_action = "token_security"
    elif primary == "SOCIAL_SENSING":
        detailed_action = "social_trending"
    elif primary == "PREDICTION_MARKETS":
        detailed_action = "market_data"

    chain_id = detected_chain or (context or {}).get("chainId")
    if not chain_id:
        chain_id = 8453

    detailed = {
        "version": "1.0",
        "origin": "chat",
        "action": detailed_action,
        "token_in": swap_slots.get("token_in"),
        "token_out": swap_slots.get("token_out"),
        "amount": swap_slots.get("amount"),
        "amount_semantic": swap_slots.get("amount_semantic") or "input",
        "chain_id": chain_id,
        "token_address": contract_address,
        "query": text,
    }
    high_level = {"type": primary, "confidence": confidence}
    decision = {
        "primary": primary,
        "confidence": confidence,
        "labels": [{"label": k, "confidence": v} for k, v in labels],
        "routing": {"stage": "rule", "reason": "heuristic_intent_parser"},
        "conflict": conflict,
        "signals": {
            "hasAction": has_trade,
            "hasRisk": has_risk,
            "hasSocial": has_social,
            "hasPrediction": has_prediction,
            "hasAsset": bool(contract_address or swap_slots.get("token_out")),
            "hasAmount": bool(swap_slots.get("amount")),
        },
    }
    swap_intent = {
        "tokenIn": swap_slots.get("token_in"),
        "tokenOut": swap_slots.get("token_out"),
        "amount": swap_slots.get("amount"),
        "amountSemantic": swap_slots.get("amount_semantic") or "input",
    }

    return IntentResult(
        high_level=high_level,
        detailed=detailed,
        decision=decision,
        contract_address=contract_address,
        chain_id=chain_id,
        swap_intent=swap_intent,
    )
