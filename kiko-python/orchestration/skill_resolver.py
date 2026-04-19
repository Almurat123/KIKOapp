from __future__ import annotations

# CONTEXT MEMORY
# Updated: 2026-04-19
# Author: Rowan
# Reason: the Python orchestration layer now mirrors the model-led tool
#         visibility rollout used by the Node chat path, but its skill loader
#         also has to survive runtime layouts where `skills_exec` is absent
#         instead of crashing the whole mount path.
# Goal: keep Python tool exposure aligned with the main model's own semantic
#       choice while preserving the existing skill prompt selection logic and
#       making optional skill catalogs non-fatal.
# Owns: Python skill selection, legacy heuristic pruning, and the model-led
#       tool visibility override for orchestration.
# Does Not Own: provider transport, tool execution, or side-effect permission.
# Design Language:
# - models see the whole registered tool catalog by default
# - backend policy still blocks unsafe or unconfirmed side effects
# - heuristics can guide prompts, but they must not hide tools in model-led mode
# - import-time loaders must never assume optional directories exist
# Document Provenance:
# - Source: operator architecture review on 2026-04-19
# - Kind: product instruction
# - Retrieved: 2026-04-19
# - Applied To: Python skill resolution and tool visibility override
# - Verification: verified in code
# - Source: local runtime log /Users/almurat/Downloads/logs.1776576842894.json
# - Kind: runtime observation
# - Retrieved: 2026-04-19
# - Applied To: making `skills_exec` absence non-fatal during orchestration startup
# - Verification: verified in code and targeted tests
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/adr/2026-04-19-model-led-tool-orchestration.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-python-model-led-tool-visibility-alignment.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-python-orchestration-skill-root-resilience.md

import json
import logging
from pathlib import Path
from typing import Any

from runtime_paths import resolve_kiko_api_src_root

from .model_led_tool_orchestration import (
    is_model_led_tool_orchestration_enabled,
    resolve_model_led_tool_names,
)

logger = logging.getLogger(__name__)


def _skills_root() -> Path:
    return resolve_kiko_api_src_root() / "skills_exec"


def _load_skills(root: Path | None = None) -> list[dict[str, Any]]:
    skills: list[dict[str, Any]] = []
    root = root or _skills_root()
    if not root.is_dir():
        logger.warning("Skill registry directory missing at %s; continuing with an empty registry", root)
        return skills
    for skill_dir in root.iterdir():
        if not skill_dir.is_dir():
            continue
        skill_json = skill_dir / "skill.json"
        prompt_md = skill_dir / "prompt.md"
        if not skill_json.exists() or not prompt_md.exists():
            continue
        try:
            skills.append({
                "meta": json.loads(skill_json.read_text(encoding="utf-8")),
                "prompt": prompt_md.read_text(encoding="utf-8").strip(),
            })
        except Exception:
            continue
    return skills


SKILLS = _load_skills()
SKILL_BY_ID = {str(item["meta"].get("id")): item for item in SKILLS}


def resolve_skills(snapshot: dict[str, Any], trading_intent: dict[str, Any] | None) -> dict[str, Any]:
    query = str(snapshot.get("lastUserMessage") or "").lower()
    runtime = snapshot.get("runtime") or {}
    context_blocks = (runtime.get("contextBlocks") or {}) if isinstance(runtime.get("contextBlocks"), dict) else {}
    prefetched = runtime.get("prefetchedToolResults") or {}
    strategy_notes: list[str] = []
    selected: list[str] = []

    if trading_intent:
        if trading_intent.get("type") == "copy_trade":
            selected.extend(["copy_trade", "wallet_portfolio"])
        elif trading_intent.get("type") == "cross_chain_trade":
            selected.extend(["cross_chain_swap", "wallet_portfolio"])
        else:
            selected.extend(["swap", "wallet_portfolio"])
            settings = (snapshot.get("runtime") or {}).get("userSettings") or {}
            if settings.get("checkTokenBeforeSwap"):
                selected.append("risk_security")
    else:
        if any(word in query for word in ["wallet", "balance", "portfolio", "pnl", "余额"]):
            selected.append("wallet_portfolio")
        if any(word in query for word in ["risk", "safe", "honeypot", "rug", "风险", "安全吗"]):
            selected.append("risk_security")
        if any(word in query for word in ["polymarket", "prediction", "odds"]):
            selected.append("polymarket_prediction")
        if any(word in query for word in ["farcaster", "twitter", "x.com", "sentiment", "social"]):
            selected.append("social_farcaster")
        if snapshot.get("requestedTokenAddresses"):
            selected.append("token_analysis")
        if not selected:
            selected.append("market_macro")

    deduped: list[str] = []
    for skill_id in selected:
        if skill_id not in deduped and skill_id in SKILL_BY_ID:
            deduped.append(skill_id)

    prompts: list[str] = []
    allowed_tools: list[str] = []
    for skill_id in deduped:
        item = SKILL_BY_ID[skill_id]
        prompts.append(item["prompt"])
        for tool_name in item["meta"].get("tools") or []:
            if tool_name not in allowed_tools:
                allowed_tools.append(str(tool_name))

    if trading_intent and trading_intent.get("kind") == "trade_confirmation":
        if trading_intent.get("type") == "swap":
            for tool_name in ["prepare_swap_transaction", "prepare_cross_chain_tx"]:
                if tool_name not in allowed_tools:
                    allowed_tools.append(tool_name)
        if trading_intent.get("type") == "copy_trade" and "create_copy_trade_config" not in allowed_tools:
            allowed_tools.append("create_copy_trade_config")

    if context_blocks.get("tokenContext"):
        allowed_tools = [tool for tool in allowed_tools if tool != "get_token_info"]
    if context_blocks.get("walletState"):
        allowed_tools = [tool for tool in allowed_tools if tool != "get_wallet_info"]
    if prefetched.get("get_token_info"):
        allowed_tools = [tool for tool in allowed_tools if tool != "get_token_info"]
    if prefetched.get("get_wallet_info"):
        allowed_tools = [tool for tool in allowed_tools if tool != "get_wallet_info"]

    explicit_risk_request = any(word in query for word in ["risk", "safe", "honeypot", "rug", "风险", "安全吗"])
    if context_blocks.get("launchpadContext") and not explicit_risk_request:
        allowed_tools = [tool for tool in allowed_tools if tool != "check_token_risk"]

    model = str(snapshot.get("model") or "").lower()
    if "grok" in model:
        for tool_name in ["external_web_search"]:
            if tool_name not in allowed_tools:
                allowed_tools.append(tool_name)

    model_led_enabled = is_model_led_tool_orchestration_enabled()
    if model_led_enabled:
        model_led_tool_names = resolve_model_led_tool_names(snapshot)
        if model_led_tool_names:
            allowed_tools = model_led_tool_names
        strategy_notes.append(
            "Model-led tool orchestration is enabled: all registered tools are visible to the main model, and backend policy still blocks unsafe or unconfirmed side effects.",
        )

    return {
        "selectedSkills": deduped,
        "skillPrompts": prompts,
        "allowedTools": allowed_tools,
        "allowAllTools": model_led_enabled,
        "strategyNotes": strategy_notes,
    }
