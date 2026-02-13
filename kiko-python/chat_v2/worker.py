from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from . import repository as repo
from .context_budget import context_budget_manager
from .db import SessionLocal
from .intent import parse_intent
from .prompt_orchestrator import prompt_orchestrator, skill_prompt_registry
from .settings import settings
from .ws import ws_manager


@dataclass
class TaskPayload:
    task_id: str
    user_id: str


class ChatWorker:
    def __init__(self, redis: Redis):
        self.redis = redis
        self._running = False
        self.logger = logging.getLogger(__name__)
        self.max_tool_calls = max(1, settings.MAX_TOOL_CALLS)
        self.max_tool_calls_per_tool = max(1, settings.MAX_TOOL_CALLS_PER_TOOL)
        self.max_tool_same_args_repeat = max(1, settings.MAX_TOOL_SAME_ARGS_REPEAT)
        self.max_tool_failures_per_tool = max(1, settings.MAX_TOOL_FAILURES_PER_TOOL)
        self.max_concurrent_tasks = max(1, settings.MAX_CONCURRENT_TASKS)
        self._sem = asyncio.Semaphore(self.max_concurrent_tasks)
        self._running_tasks: set[str] = set()

    def _short(self, value: Any, limit: int = 280) -> str:
        try:
            s = json.dumps(value, ensure_ascii=False, default=str)
        except Exception:
            s = str(value)
        if len(s) <= limit:
            return s
        return s[:limit] + "...(truncated)"

    async def start(self):
        self._running = True
        while self._running:
            try:
                item = await self.redis.blpop(settings.TASK_QUEUE_KEY, timeout=1)
                if not item:
                    continue
                _, raw = item
                data = json.loads(raw)
                payload = TaskPayload(task_id=data["task_id"], user_id=data["user_id"])
                if payload.task_id in self._running_tasks:
                    continue
                self._running_tasks.add(payload.task_id)
                asyncio.create_task(self._process_with_limit(payload))
            except Exception as e:
                self.logger.exception("ChatWorker loop error: %s", e)

    async def stop(self):
        self._running = False

    async def _process_with_limit(self, payload: TaskPayload):
        async with self._sem:
            try:
                await self.process(payload)
            finally:
                self._running_tasks.discard(payload.task_id)

    async def enqueue(self, task_id: str, user_id: str):
        await self.redis.rpush(settings.TASK_QUEUE_KEY, json.dumps({"task_id": task_id, "user_id": user_id}))

    async def process(self, payload: TaskPayload):
        async with SessionLocal() as db:
            task = await repo.get_task(db, payload.task_id)
            if not task or task.status == "cancelled":
                return
            task_type = "card" if ((task.tool_context or {}).get("allowanceMode") == "instant" or ((task.tool_context or {}).get("toolConfig") or {}).get("fastSwapMode")) else "text"
            await repo.set_task_status(db, task, "running")
            self.logger.info(
                "chat task start task_id=%s session_id=%s user_id=%s model=%s wallet=%s chain=%s",
                task.id,
                task.session_id,
                payload.user_id,
                task.model,
                (task.tool_context or {}).get("walletAddress"),
                (task.tool_context or {}).get("chainId"),
            )
            await ws_manager.broadcast_event(
                payload.user_id,
                "status",
                task.session_id,
                task.assistant_message_id,
                {"status": "running", "message": "Thinking", "task_id": task.id, "taskId": task.id, "taskType": task_type},
            )
        await self._run_llm(payload)

    async def _fetch_tool_definitions(self, client: httpx.AsyncClient, headers: dict[str, str]) -> list[dict[str, Any]]:
        try:
            resp = await client.get(
                settings.TOOL_RUNTIME_URL.rstrip("/") + "/internal/v1/tool/definitions",
                headers=headers,
                timeout=15,
            )
            if resp.status_code >= 400:
                self.logger.warning("tool definitions fetch failed: %s %s", resp.status_code, resp.text[:300])
                return []
            data = resp.json()
            return list(data.get("tools", []) or [])
        except Exception as e:
            self.logger.warning("tool definitions fetch error: %s", e)
            return []

    def _merge_tool_call_deltas(self, acc: dict[str, dict[str, Any]], deltas: list[dict[str, Any]]):
        for i, tc in enumerate(deltas):
            # Never use len(acc) as fallback key; that creates new keys per chunk and
            # explodes one logical tool call into many duplicates.
            idx = tc.get("index")
            key = str(tc.get("id") or (f"idx:{idx}" if idx is not None else f"idx:{i}"))
            cur = acc.get(key)
            if not cur:
                cur = {
                    "id": tc.get("id") or key,
                    "type": tc.get("type") or "function",
                    "function": {"name": "", "arguments": ""},
                }
                acc[key] = cur
            fn = tc.get("function") or {}
            name = fn.get("name")
            if isinstance(name, str) and name:
                if not cur["function"]["name"]:
                    cur["function"]["name"] = name
                elif cur["function"]["name"] != name:
                    cur["function"]["name"] = name
            args = fn.get("arguments")
            if isinstance(args, str) and args:
                existing = cur["function"]["arguments"]
                # Provider may stream either deltas or repeated snapshots.
                if not existing:
                    cur["function"]["arguments"] = args
                elif args == existing:
                    pass
                elif args.startswith(existing):
                    cur["function"]["arguments"] = args
                elif existing.endswith(args):
                    pass
                else:
                    cur["function"]["arguments"] += args

    def _stable_stringify(self, value: Any) -> str:
        def normalize(v: Any, seen: set[int]) -> Any:
            if v is None or isinstance(v, (str, int, float, bool)):
                return v
            if isinstance(v, list):
                return [normalize(x, seen) for x in v]
            if isinstance(v, dict):
                vid = id(v)
                if vid in seen:
                    return "[Circular]"
                seen.add(vid)
                return {k: normalize(v[k], seen) for k in sorted(v.keys())}
            return str(v)

        try:
            return json.dumps(normalize(value, set()), ensure_ascii=False, sort_keys=True)
        except Exception:
            return str(value)

    def _build_tool_key(self, name: str, args: Any) -> str:
        return f"{name}:{self._stable_stringify(args)}"

    def _normalize_tool_args(self, name: str, args: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(args or {})

        def _normalize_chain_id(v: Any) -> Any:
            if isinstance(v, int):
                return v
            if isinstance(v, str):
                s = v.strip().lower()
                if s.startswith("0x"):
                    try:
                        return int(s, 16)
                    except Exception:
                        return v
                if s.isdigit():
                    try:
                        return int(s)
                    except Exception:
                        return v
            return v

        def _normalize_addr(v: Any) -> Any:
            if isinstance(v, str):
                s = v.strip()
                if s.startswith("0x") and len(s) == 42:
                    return s.lower()
                return s
            return v

        if name == "get_wallet_info":
            if not normalized.get("address"):
                normalized["address"] = context.get("walletAddress") or context.get("userAddress")
            normalized["address"] = _normalize_addr(normalized.get("address"))
            if not normalized.get("chainId") and context.get("chainId"):
                normalized["chainId"] = context.get("chainId")
            normalized["chainId"] = _normalize_chain_id(normalized.get("chainId"))

        if name == "get_token_info":
            if not normalized.get("chain_id") and context.get("chainId"):
                normalized["chain_id"] = context.get("chainId")
            normalized["chain_id"] = _normalize_chain_id(normalized.get("chain_id"))
            if isinstance(normalized.get("token"), str):
                normalized["token"] = normalized.get("token").strip()
            if isinstance(normalized.get("symbol"), str):
                normalized["symbol"] = normalized.get("symbol").strip().upper()

        if name in {"simulate_swap", "prepare_swap_transaction"}:
            for k in ("token_in", "token_out"):
                if isinstance(normalized.get(k), str):
                    normalized[k] = _normalize_addr(normalized[k])
                    if isinstance(normalized[k], str) and not normalized[k].startswith("0x"):
                        normalized[k] = normalized[k].strip().upper()
            if isinstance(normalized.get("amount_in"), str):
                normalized["amount_in"] = normalized["amount_in"].strip()
            if not normalized.get("chain_id") and context.get("chainId"):
                normalized["chain_id"] = context.get("chainId")
            normalized["chain_id"] = _normalize_chain_id(normalized.get("chain_id"))
            if normalized.get("wallet_address"):
                normalized["wallet_address"] = _normalize_addr(normalized.get("wallet_address"))

        return normalized

    def _resolve_routing_mode(self, intent: str) -> str:
        if intent in {"TRADING", "COPY_TRADING"}:
            return "execution"
        return "thinking"

    def _is_confirmation_message(self, text: str) -> bool:
        t = (text or "").strip().lower()
        return t in {
            "proceed",
            "confirm",
            "yes",
            "y",
            "go",
            "execute",
            "继续",
            "确认",
            "是",
            "可以",
            "执行",
        }

    def _chain_slug(self, chain_id: Any) -> str:
        try:
            cid = int(chain_id)
        except Exception:
            cid = 8453
        mapping = {
            1: "eth",
            8453: "base",
            56: "bsc",
            42161: "arbitrum",
            10: "optimism",
            137: "polygon",
            43114: "avalanche",
            900: "solana",
        }
        return mapping.get(cid, "base")

    def _resolve_token_identifier(self, token: Any, context: dict[str, Any]) -> str | None:
        if not token:
            return None
        t = str(token).strip()
        if not t:
            return None
        if t.startswith("0x") and len(t) == 42:
            return t.lower()

        symbol = t.upper()
        wallet_cache = context.get("__wallet_info_cache") or {}
        tokens = wallet_cache.get("tokens") if isinstance(wallet_cache, dict) else None
        if isinstance(tokens, list):
            for item in tokens:
                if not isinstance(item, dict):
                    continue
                if str(item.get("symbol") or "").upper() == symbol:
                    contract = item.get("contract") or item.get("contractAddress")
                    if isinstance(contract, str) and contract.startswith("0x") and len(contract) == 42:
                        return contract.lower()

        # Common fallback for Base USDC.
        if symbol == "USDC":
            chain_id = context.get("chainId") or context.get("chain_id") or 8453
            try:
                if int(chain_id) == 8453:
                    return "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
            except Exception:
                pass
        return symbol

    def _infer_tool_args(self, name: str, args: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        out = dict(args or {})
        intent_slots = context.get("__intent_slots") if isinstance(context.get("__intent_slots"), dict) else {}
        token_in_slot = intent_slots.get("token_in")
        token_out_slot = intent_slots.get("token_out")
        amount_slot = intent_slots.get("amount")
        amount_semantic = str(intent_slots.get("amount_semantic") or "input")
        chain_slot = intent_slots.get("chain_id") or context.get("chainId")

        if name in {"simulate_swap", "prepare_swap_transaction"}:
            token_in_raw = out.get("token_in") or token_in_slot
            token_out_raw = out.get("token_out") or token_out_slot
            if not out.get("token_in"):
                out["token_in"] = self._resolve_token_identifier(token_in_slot, context)
            else:
                out["token_in"] = self._resolve_token_identifier(out.get("token_in"), context)
            if not out.get("token_out"):
                out["token_out"] = self._resolve_token_identifier(token_out_slot, context)
            else:
                out["token_out"] = self._resolve_token_identifier(out.get("token_out"), context)
            if not out.get("amount_in") and amount_slot:
                out["amount_in"] = str(amount_slot)
            if not out.get("chain_id") and chain_slot:
                out["chain_id"] = chain_slot
            # "sell all TOKEN to ETH" => resolve "all" from provided balance context.
            if str(out.get("amount_in") or "").strip().lower() == "all":
                try:
                    resolved = None
                    token_in_val = out.get("token_in")
                    balance_map = context.get("balance")
                    if not isinstance(balance_map, dict):
                        ctx = context.get("context")
                        if isinstance(ctx, dict) and isinstance(ctx.get("balance"), dict):
                            balance_map = ctx.get("balance")
                    if not isinstance(balance_map, dict):
                        balance_map = {}

                    token_upper = str(token_in_val or "").upper()
                    token_lower = str(token_in_val or "").lower()

                    # Prefer explicit symbol key (e.g., USDC) from context balance map.
                    if token_upper and token_upper in balance_map:
                        resolved = balance_map.get(token_upper)
                    # Fallback to exact token key as-is.
                    if resolved is None and token_in_val in balance_map:
                        resolved = balance_map.get(token_in_val)
                    # Fallback for address key in lower/upper forms.
                    if resolved is None and token_lower and token_lower in balance_map:
                        resolved = balance_map.get(token_lower)
                    if resolved is None and token_upper and token_upper in balance_map:
                        resolved = balance_map.get(token_upper)

                    # Native balance fallback for ETH/WETH-like input.
                    if resolved is None and token_upper in {"ETH", "WETH"}:
                        resolved = context.get("nativeBalance")
                        if resolved is None:
                            ctx = context.get("context")
                            if isinstance(ctx, dict):
                                resolved = ctx.get("nativeBalance")

                    if resolved is not None and str(resolved).strip():
                        out["amount_in"] = str(resolved).strip()
                except Exception:
                    pass
            # "buy 1 USDC using ETH" => amount is target output. Convert to input estimate.
            if amount_semantic == "output":
                token_in_norm = str(token_in_raw or "").upper()
                token_out_norm = str(token_out_raw or "").upper()
                token_out_resolved = str(out.get("token_out") or "").lower()
                token_in_resolved = str(out.get("token_in") or "").lower()
                is_stable_target = (
                    ("USDC" in token_out_norm)
                    or ("USDT" in token_out_norm)
                    or ("DAI" in token_out_norm)
                    or (token_out_resolved == "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913")
                )
                is_eth_like_input = (
                    token_in_norm in {"ETH", "WETH"}
                    or token_in_resolved in {
                        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                        "0x4200000000000000000000000000000000000006",
                    }
                )
                if is_eth_like_input and is_stable_target:
                    try:
                        target = float(str(amount_slot or out.get("amount_in") or "0"))
                        wallet_cache = context.get("__wallet_info_cache") or {}
                        native_price = float(wallet_cache.get("nativePriceUsd") or 0)
                        if native_price <= 0:
                            native_price = float(getattr(settings, "DEFAULT_NATIVE_PRICE_USD", 2000.0))
                        if target > 0 and native_price > 0:
                            est = target / native_price
                            out["amount_in"] = f"{est:.8f}".rstrip("0").rstrip(".")
                    except Exception:
                        pass

        if name == "get_token_info":
            if not out.get("address"):
                out["address"] = self._resolve_token_identifier(token_out_slot or token_in_slot, context)
            if not out.get("chain"):
                out["chain"] = self._chain_slug(chain_slot)

        return out

    def _missing_required_tool_args(self, name: str, args: dict[str, Any]) -> list[str]:
        required: dict[str, list[str]] = {
            "simulate_swap": ["token_in", "token_out", "amount_in", "chain_id"],
            "prepare_swap_transaction": ["token_in", "token_out", "amount_in", "chain_id"],
        }
        req = required.get(name, [])
        missing: list[str] = []
        for k in req:
            v = args.get(k)
            if v is None:
                missing.append(k)
                continue
            if isinstance(v, str) and not v.strip():
                missing.append(k)
        return missing

    def _build_intent_hints(self, decision: dict[str, Any] | None) -> dict[str, Any] | None:
        if not decision:
            return None
        labels = [x.get("label") for x in (decision.get("labels") or []) if isinstance(x, dict) and x.get("label")]
        conflict = decision.get("conflict") or {}
        out: dict[str, Any] = {}
        if labels:
            out["labels"] = labels
        if conflict.get("type"):
            out["conflict"] = f"{conflict.get('type')} ({', '.join(conflict.get('labels') or [])})"
        if conflict.get("question"):
            out["question"] = conflict.get("question")
        return out or None

    def _build_wallet_info_from_context(self, tool_context: dict[str, Any]) -> dict[str, Any] | None:
        wallet_address = tool_context.get("walletAddress") or tool_context.get("userAddress")
        chain_id = tool_context.get("chainId")
        if not wallet_address or not chain_id:
            return None
        normalized_balance = tool_context.get("balance") or ((tool_context.get("context") or {}).get("balance") if isinstance(tool_context.get("context"), dict) else None)
        native_balance = tool_context.get("nativeBalance")
        if not normalized_balance and not native_balance:
            return None
        tokens: list[dict[str, Any]] = []
        if isinstance(normalized_balance, dict):
            for symbol, bal in normalized_balance.items():
                tokens.append({"symbol": str(symbol), "balance": str(bal)})
        return {
            "address": wallet_address,
            "chain": self._chain_slug(chain_id),
            "ethBalance": str(native_balance) if native_balance is not None else None,
            "tokens": tokens,
        }

    def _seed_tool_cache_from_context(self, cache: dict[str, Any], tool_context: dict[str, Any]) -> dict[str, int]:
        hits = {"get_wallet_info": 0, "get_token_info": 0}
        wallet_info = self._build_wallet_info_from_context(tool_context)
        if wallet_info:
            args = {
                "address": tool_context.get("walletAddress"),
                "chainId": tool_context.get("chainId"),
            }
            cache[self._build_tool_key("get_wallet_info", args)] = wallet_info
            hits["get_wallet_info"] += 1

        intent_slots = tool_context.get("__intent_slots") if isinstance(tool_context.get("__intent_slots"), dict) else {}
        chain_id = intent_slots.get("chain_id") or tool_context.get("chainId")
        for token_like in [intent_slots.get("token_in"), intent_slots.get("token_out")]:
            token_id = self._resolve_token_identifier(token_like, tool_context)
            if not token_id:
                continue
            if isinstance(token_id, str) and token_id.startswith("0x"):
                args = {"address": token_id, "chain": self._chain_slug(chain_id)}
                cache[self._build_tool_key("get_token_info", args)] = {
                    "address": token_id,
                    "chainId": chain_id,
                    "symbol": token_like if isinstance(token_like, str) and not token_like.startswith("0x") else None,
                }
                hits["get_token_info"] += 1
        return hits

    def _find_recent_swap_from_messages(self, messages: list[Any]) -> dict[str, Any] | None:
        for msg in reversed(messages or []):
            try:
                trace = getattr(msg, "tool_trace_json", None)
                if isinstance(trace, str):
                    trace = json.loads(trace)
                if not isinstance(trace, dict):
                    continue
                calls = trace.get("toolCalls") or []
                if not isinstance(calls, list):
                    continue
                for call in reversed(calls):
                    if not isinstance(call, dict):
                        continue
                    tool = str(call.get("tool") or "")
                    if tool not in {"simulate_swap", "prepare_swap_transaction"}:
                        continue
                    if call.get("status") not in {"success", "cached"}:
                        continue
                    args = call.get("args") if isinstance(call.get("args"), dict) else {}
                    token_in = args.get("token_in")
                    token_out = args.get("token_out")
                    amount_in = args.get("amount_in")
                    chain_id = args.get("chain_id")
                    if token_in and token_out and amount_in:
                        return {
                            "token_in": str(token_in),
                            "token_out": str(token_out),
                            "amount_in": str(amount_in),
                            "chain_id": int(chain_id) if str(chain_id).isdigit() else chain_id,
                            "is_cross_chain": bool(args.get("to_chain") or args.get("toChain")),
                            "to_chain": args.get("to_chain") or args.get("toChain"),
                        }
            except Exception:
                continue
        return None

    async def _pre_fetch_by_intent(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        tool_context: dict[str, Any],
        parsed_intent: Any,
        result_cache: dict[str, Any],
    ) -> list[str]:
        plan: list[str] = []
        intent_type = str(parsed_intent.high_level.get("type") or "")
        lower_query = str(parsed_intent.detailed.get("query") or "").lower()
        wallet = tool_context.get("walletAddress")
        chain_id = tool_context.get("chainId")

        async def _prefetch(tool_name: str, args: dict[str, Any]):
            key = self._build_tool_key(tool_name, args)
            if key in result_cache:
                return
            plan.append(f"{tool_name}:{self._short(args, 120)}")
            try:
                resp = await client.post(
                    settings.TOOL_RUNTIME_URL.rstrip("/") + "/internal/v1/tool/execute",
                    headers=headers,
                    json={"tool_name": tool_name, "arguments": args, "context": tool_context},
                    timeout=min(12, settings.TOOL_EXEC_TIMEOUT_SEC),
                )
                if resp.status_code >= 400:
                    return
                data = resp.json() or {}
                if data.get("ok"):
                    result_cache[key] = data.get("result")
            except Exception:
                return

        if intent_type == "TRADING" and wallet and chain_id:
            await _prefetch("get_wallet_info", {"address": wallet, "chainId": chain_id})

        if any(x in lower_query for x in ["balance", "portfolio", "余额", "钱包"]):
            if wallet and chain_id:
                await _prefetch("get_wallet_info", {"address": wallet, "chainId": chain_id})

        return plan

    def _sanitize_tool_call_history(self, history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        sanitized: list[dict[str, Any]] = []
        for idx, msg in enumerate(history):
            if msg.get("role") != "assistant" or not msg.get("tool_calls"):
                sanitized.append(msg)
                continue
            expected = {str(x.get("id")) for x in msg.get("tool_calls") if isinstance(x, dict) and x.get("id")}
            check_idx = idx + 1
            while check_idx < len(history) and expected:
                nxt = history[check_idx]
                if nxt.get("role") == "tool" and nxt.get("tool_call_id"):
                    expected.discard(str(nxt.get("tool_call_id")))
                    check_idx += 1
                    continue
                break
            if expected:
                sanitized.append({"role": "assistant", "content": msg.get("content") or "(Tool call interrupted)"})
            else:
                sanitized.append(msg)
        return sanitized

    async def _record_intent_trace(self, task_user_message_id: str | None, parsed_intent: Any, user_message: str):
        if not task_user_message_id:
            return
        try:
            async with SessionLocal() as db:
                msg = await repo.get_message(db, task_user_message_id)
                if not msg:
                    return
                old = msg.tool_trace_json if isinstance(msg.tool_trace_json, dict) else {}
                intent_trace = {
                    "parsedAt": datetime.utcnow().isoformat() + "Z",
                    "input": user_message,
                    "highLevel": parsed_intent.high_level,
                    "decision": parsed_intent.decision,
                    "detailed": {
                        "action": parsed_intent.detailed.get("action"),
                        "token_in": parsed_intent.detailed.get("token_in"),
                        "token_out": parsed_intent.detailed.get("token_out"),
                        "amount": parsed_intent.detailed.get("amount"),
                        "chain_id": parsed_intent.detailed.get("chain_id"),
                    },
                }
                merged = {**old, "intentTrace": intent_trace}
                await repo.update_message_content(db, task_user_message_id, tool_trace_json=merged)
        except Exception as e:
            self.logger.warning("record intent trace failed: %s", e)

    async def _execute_tool_call(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        tool_call: dict[str, Any],
        context: dict[str, Any],
        trace_state: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        fn = tool_call.get("function") or {}
        name = str(fn.get("name") or "").strip()
        args_raw = fn.get("arguments") or "{}"
        parsed_args: dict[str, Any]
        try:
            parsed = json.loads(args_raw) if isinstance(args_raw, str) else (args_raw or {})
            parsed_args = parsed if isinstance(parsed, dict) else {"_value": parsed}
        except Exception:
            parsed_args = {"_raw_arguments": str(args_raw)}

        parsed_args = self._normalize_tool_args(name, parsed_args, context)
        parsed_args = self._infer_tool_args(name, parsed_args, context)
        parsed_args = self._normalize_tool_args(name, parsed_args, context)
        missing = self._missing_required_tool_args(name, parsed_args)
        if missing:
            trace_state["stopReasons"].append(f"tool_missing_args:{name}")
            self.logger.warning(
                "tool blocked missing args task=%s tool=%s missing=%s args=%s",
                context.get("task_id"),
                name,
                missing,
                self._short(parsed_args, 500),
            )
            return (
                {
                    "role": "tool",
                    "tool_call_id": tool_call.get("id"),
                    "name": name,
                    "content": f"Error: missing required arguments for {name}: {', '.join(missing)}",
                },
                {
                    "tool": name,
                    "tool_call_id": tool_call.get("id"),
                    "args": parsed_args,
                    "error": f"missing required arguments: {', '.join(missing)}",
                    "status": "error",
                },
            )
        args_key = self._build_tool_key(name, parsed_args)
        limit_exempt_tools = {"get_wallet_info"}
        is_limit_exempt = name in limit_exempt_tools
        cacheable_tools = {"get_wallet_info", "get_token_info", "simulate_swap", "external_web_search"}
        result_cache: dict[str, Any] = trace_state.get("resultCache") or {}

        # Task-local cache only (never persisted across user turns).
        if name in cacheable_tools and args_key in result_cache:
            cached = result_cache[args_key]
            self.logger.info("tool cache hit task=%s tool=%s key=%s", context.get("task_id"), name, args_key)
            return (
                {
                    "role": "tool",
                    "tool_call_id": tool_call.get("id"),
                    "name": name,
                    "content": json.dumps(cached, ensure_ascii=False),
                },
                {
                    "tool": name,
                    "tool_call_id": tool_call.get("id"),
                    "args": parsed_args,
                    "result": cached,
                    "status": "cached",
                },
            )

        if not is_limit_exempt:
            next_repeat = trace_state["toolArgsCounts"].get(args_key, 0) + 1
            if next_repeat > self.max_tool_same_args_repeat:
                trace_state["blockedKeys"].add(args_key)
                trace_state["stopReasons"].append(f"tool_args_repeat:{name}")
                self.logger.warning(
                    "tool blocked args-repeat task=%s tool=%s repeat=%s max=%s key=%s",
                    context.get("task_id"),
                    name,
                    next_repeat,
                    self.max_tool_same_args_repeat,
                    args_key,
                )
                return (
                    {"role": "tool", "tool_call_id": tool_call.get("id"), "content": "Duplicate tool arguments blocked."},
                    {"tool": name, "tool_call_id": tool_call.get("id"), "args": parsed_args, "status": "blocked"},
                )
            trace_state["toolArgsCounts"][args_key] = next_repeat

            next_tool_count = trace_state["toolCallCounts"].get(name, 0) + 1
            next_total_calls = sum(trace_state["toolCallCounts"].values()) + 1
            if next_total_calls > self.max_tool_calls:
                trace_state["stopReasons"].append("tool_call_limit:total")
                self.logger.warning(
                    "tool blocked total limit task=%s total=%s max=%s tool=%s",
                    context.get("task_id"),
                    next_total_calls,
                    self.max_tool_calls,
                    name,
                )
                return (
                    {"role": "tool", "tool_call_id": tool_call.get("id"), "content": "Tool call limit reached."},
                    {"tool": name, "tool_call_id": tool_call.get("id"), "args": parsed_args, "status": "blocked"},
                )
            if next_tool_count > self.max_tool_calls_per_tool:
                trace_state["stopReasons"].append(f"tool_call_limit:{name}")
                self.logger.warning(
                    "tool blocked per-tool limit task=%s tool=%s count=%s max=%s",
                    context.get("task_id"),
                    name,
                    next_tool_count,
                    self.max_tool_calls_per_tool,
                )
                return (
                    {"role": "tool", "tool_call_id": tool_call.get("id"), "content": f"Tool call limit reached for {name}."},
                    {"tool": name, "tool_call_id": tool_call.get("id"), "args": parsed_args, "status": "blocked"},
                )
            trace_state["toolCallCounts"][name] = next_tool_count

        req = {"tool_name": name, "arguments": parsed_args, "context": context}
        try:
            resp = await client.post(
                settings.TOOL_RUNTIME_URL.rstrip("/") + "/internal/v1/tool/execute",
                headers=headers,
                json=req,
                timeout=settings.TOOL_EXEC_TIMEOUT_SEC,
            )
            if resp.status_code >= 400:
                raise RuntimeError(f"tool {name} failed HTTP {resp.status_code}: {resp.text[:400]}")
            data = resp.json()
            if not data.get("ok"):
                raise RuntimeError(data.get("error") or f"tool {name} failed")
            result = data.get("result")
            if isinstance(result, dict) and result.get("error"):
                raise RuntimeError(str(result.get("error")))
            tool_msg = {
                "role": "tool",
                "tool_call_id": tool_call.get("id"),
                "name": name,
                "content": json.dumps(result, ensure_ascii=False),
            }
            trace = {
                "tool": name,
                "tool_call_id": tool_call.get("id"),
                "args": parsed_args,
                "result": result,
                "status": "success",
            }
            if name in cacheable_tools:
                result_cache[args_key] = result
                trace_state["resultCache"] = result_cache
            if isinstance(result, dict) and result.get("_final"):
                trace_state["stopReasons"].append(f"tool_final:{name}")
                trace_state["shouldExitImmediately"] = True
            if isinstance(result, dict) and (result.get("requires_confirmation") or str(result.get("mode") or "").lower() == "simulation_only"):
                trace_state["stopReasons"].append(f"tool_final:{name}")
                trace_state["shouldExitImmediately"] = True
            return tool_msg, trace
        except Exception as exc:
            trace_state["toolFailures"][name] = trace_state["toolFailures"].get(name, 0) + 1
            if trace_state["toolFailures"][name] >= self.max_tool_failures_per_tool:
                trace_state["stopReasons"].append(f"tool_failure_limit:{name}")
            err_text = str(exc)
            tool_msg = {
                "role": "tool",
                "tool_call_id": tool_call.get("id"),
                "name": name,
                "content": f"Error: {err_text}",
            }
            trace = {
                "tool": name,
                "tool_call_id": tool_call.get("id"),
                "args": parsed_args,
                "error": err_text,
                "status": "error",
            }
            return tool_msg, trace

    async def _run_llm(self, payload: TaskPayload):
        started = time.time()
        task_id = ""
        session_id = ""
        assistant_message_id = ""
        model = "deepseek-chat"
        provider = None
        provider_request_id = None
        selected_intent = "GENERAL_CHAT"
        selected_routing_mode = "thinking"
        task_type = "text"

        content = ""
        reasoning = ""
        usage = None
        citations: list[Any] = []
        chunk_idx = 0
        first_token_ms = None
        last_flush = time.time()
        pending_content = ""
        pending_reasoning = ""
        tool_trace: list[dict[str, Any]] = []
        tool_trace_state: dict[str, Any] = {
            "mode": "thinking",
            "skillVersion": "clean",
            "toolCalls": tool_trace,
            "toolCallCounts": {},
            "toolArgsCounts": {},
            "toolFailures": {},
            "toolRepeats": {},
            "stopReasons": [],
            "blockedKeys": set(),
            "lastResultByKey": {},
            "resultCache": {},
            "shouldExitImmediately": False,
            "stoppedByLimit": False,
            "intent_decision": {},
            "system_injection_applied": [],
            "balance_context_block_bytes": 0,
            "tool_cache_seed_hits": {},
            "pre_fetch_plan": [],
        }
        sent_message_start = False

        async with SessionLocal() as db:
            task = await repo.get_task(db, payload.task_id)
            if not task:
                return
            session = await repo.get_session(db, task.session_id, payload.user_id)
            if not session:
                return
            if task.status == "cancelled":
                await ws_manager.broadcast_event(
                    payload.user_id,
                    "status",
                    task.session_id,
                    task.assistant_message_id,
                    {"status": "stopped", "task_id": task.id, "taskId": task.id, "cancelled": True},
                )
                await ws_manager.broadcast_event(
                    payload.user_id,
                    "message_complete",
                    task.session_id,
                    task.assistant_message_id,
                    {"message_id": task.assistant_message_id},
                )
                return

            msgs = await repo.get_messages(db, task.session_id)
            llm_messages: list[dict[str, Any]] = []
            for m in msgs:
                if m.role not in ("system", "user", "assistant", "tool"):
                    continue
                msg: dict[str, Any] = {"role": m.role, "content": m.content}
                if m.role == "assistant" and m.reasoning_content:
                    msg["reasoning_content"] = m.reasoning_content
                llm_messages.append(msg)

            task_id = task.id
            session_id = task.session_id
            assistant_message_id = task.assistant_message_id or ""
            model = task.model
            tool_context = task.tool_context or {}
            task_type = "card" if (tool_context.get("allowanceMode") == "instant" or (tool_context.get("toolConfig") or {}).get("fastSwapMode")) else "text"
            context_balance = tool_context.get("balance") or (tool_context.get("context") or {}).get("balance")
            if tool_context.get("walletAddress") and tool_context.get("chainId") and (context_balance or tool_context.get("nativeBalance")):
                chain_name = "base" if tool_context.get("chainId") == 8453 else str(tool_context.get("chainId"))
                cached_tokens: list[dict[str, Any]] = []
                if isinstance(context_balance, dict):
                    for symbol, bal in context_balance.items():
                        cached_tokens.append({"symbol": str(symbol), "balance": str(bal)})
                tool_context["__wallet_info_cache"] = {
                    "address": tool_context.get("walletAddress"),
                    "chain": chain_name,
                    "ethBalance": str(tool_context.get("nativeBalance")) if tool_context.get("nativeBalance") is not None else None,
                    "tokens": cached_tokens,
                }

            last_user = next((m for m in reversed(llm_messages) if m.get("role") == "user"), {"content": ""})
            parsed_intent = parse_intent(str(last_user.get("content") or ""), tool_context)
            current_user_text = str(last_user.get("content") or "")
            recent_swap = self._find_recent_swap_from_messages(msgs) if self._is_confirmation_message(current_user_text) else None
            if (
                parsed_intent.high_level.get("type") == "GENERAL_CHAT"
                and self._is_confirmation_message(current_user_text)
            ):
                # Confirmation follow-up should inherit the most recent trading intent.
                for prev in reversed(llm_messages[:-1]):
                    if prev.get("role") != "user":
                        continue
                    prev_text = str(prev.get("content") or "")
                    prev_intent = parse_intent(prev_text, tool_context)
                    if prev_intent.high_level.get("type") == "TRADING" and prev_intent.detailed.get("token_in") and prev_intent.detailed.get("token_out"):
                        parsed_intent = prev_intent
                        self.logger.info(
                            "confirmation inherited trading intent task_id=%s text=%s inherited=%s",
                            task_id,
                            current_user_text,
                            self._short(prev_intent.detailed, 500),
                        )
                        break
                if parsed_intent.high_level.get("type") == "GENERAL_CHAT":
                    for prev in reversed(llm_messages[:-1]):
                        if prev.get("role") != "assistant":
                            continue
                        prev_text = str(prev.get("content") or "").lower()
                        if "reply \"confirm\"" in prev_text or "reply \"execute\"" in prev_text:
                            for prior_user in reversed(llm_messages[:-1]):
                                if prior_user.get("role") != "user":
                                    continue
                                prior_text = str(prior_user.get("content") or "")
                                prior_intent = parse_intent(prior_text, tool_context)
                                if prior_intent.high_level.get("type") == "TRADING":
                                    parsed_intent = prior_intent
                                    self.logger.info(
                                        "confirmation inherited by assistant cue task_id=%s text=%s inherited=%s",
                                        task_id,
                                        current_user_text,
                                        self._short(prior_intent.detailed, 500),
                                    )
                                    break
                            break
            if recent_swap:
                parsed_intent.high_level["type"] = "TRADING"
                parsed_intent.high_level["confidence"] = 1
                parsed_intent.detailed["action"] = "swap"
                parsed_intent.detailed["token_in"] = recent_swap.get("token_in")
                parsed_intent.detailed["token_out"] = recent_swap.get("token_out")
                parsed_intent.detailed["amount"] = recent_swap.get("amount_in")
                if recent_swap.get("chain_id") is not None:
                    parsed_intent.detailed["chain_id"] = recent_swap.get("chain_id")
                parsed_intent.decision = {
                    "primary": "TRADING",
                    "confidence": 1,
                    "labels": [{"label": "TRADING", "confidence": 1}],
                    "routing": {"stage": "rule", "reason": "confirmation_followup"},
                }
                self.logger.info(
                    "confirmation enriched by recent swap task_id=%s recent=%s",
                    task_id,
                    self._short(recent_swap, 500),
                )
            intent = str(parsed_intent.high_level.get("type") or "GENERAL_CHAT")
            routing_mode = self._resolve_routing_mode(intent)
            self.logger.info(
                "intent parsed task_id=%s intent=%s routing=%s confidence=%s detail=%s",
                task_id,
                intent,
                routing_mode,
                parsed_intent.high_level.get("confidence"),
                self._short(parsed_intent.detailed),
            )
            selected_intent = intent
            selected_routing_mode = routing_mode
            tool_trace_state["mode"] = routing_mode
            tool_trace_state["skillVersion"] = "clean" if routing_mode == "thinking" else "exec"
            if not tool_context.get("walletAddress"):
                m = re.search(r"\b0x[a-fA-F0-9]{40}\b", str(last_user.get("content") or ""))
                if m:
                    tool_context["walletAddress"] = m.group(0)
                    if not tool_context.get("chainId"):
                        tool_context["chainId"] = 8453
                    self.logger.info(
                        "wallet recovered from user text task_id=%s wallet=%s chain=%s",
                        task_id,
                        tool_context.get("walletAddress"),
                        tool_context.get("chainId"),
                    )

            user_context = {
                "userAddress": tool_context.get("walletAddress"),
                "chainId": tool_context.get("chainId"),
                "chainName": "Base" if tool_context.get("chainId") == 8453 else str(tool_context.get("chainId") or ""),
                "isWalletConnected": bool(tool_context.get("walletAddress")),
                "nativeBalance": tool_context.get("nativeBalance"),
                "currentPage": tool_context.get("currentPage"),
                "pageContext": tool_context.get("pageContext"),
                "balance": (tool_context.get("context") or {}).get("balance") or {},
                "intentHints": self._build_intent_hints(parsed_intent.decision),
            }
            system_prompt = prompt_orchestrator.get_system_prompt(model, intent, routing_mode)
            enriched_user = prompt_orchestrator.build_prompt(str(last_user.get("content") or ""), user_context, intent)
            await self._record_intent_trace(task.user_message_id, parsed_intent, str(last_user.get("content") or ""))
            trading_slots_complete = (
                intent == "TRADING"
                and bool(parsed_intent.detailed.get("token_in"))
                and bool(parsed_intent.detailed.get("token_out"))
                and bool(parsed_intent.detailed.get("amount"))
            )
            tool_context["__intent_slots"] = {
                "token_in": parsed_intent.detailed.get("token_in"),
                "token_out": parsed_intent.detailed.get("token_out"),
                "amount": parsed_intent.detailed.get("amount"),
                "amount_semantic": parsed_intent.detailed.get("amount_semantic") or "input",
                "chain_id": parsed_intent.detailed.get("chain_id"),
            }
            tool_trace_state["intent_decision"] = {
                "intent": intent,
                "routing_mode": routing_mode,
                "confidence": parsed_intent.high_level.get("confidence"),
                "detail": parsed_intent.detailed,
            }

            system_injections: list[str] = []
            if self._is_confirmation_message(current_user_text) and intent == "TRADING":
                tool_context["__confirmed_swap"] = True
                conf_token_in = parsed_intent.detailed.get("token_in")
                conf_token_out = parsed_intent.detailed.get("token_out")
                conf_amount = parsed_intent.detailed.get("amount")
                conf_chain = parsed_intent.detailed.get("chain_id") or tool_context.get("chainId")
                system_injections.append(
                    "CONFIRMED_SWAP: User confirmed swap after simulation. "
                    f"You MUST call prepare_swap_transaction now with: token_in={conf_token_in}, token_out={conf_token_out}, amount_in={conf_amount}, chain_id={conf_chain}. "
                    "Do NOT call simulate_swap again or use web search."
                )
                is_cross_hint = any(x in current_user_text.lower() for x in ["cross", "bridge", "跨链"])
                if recent_swap and (recent_swap.get("is_cross_chain") or recent_swap.get("to_chain")):
                    is_cross_hint = True
                if is_cross_hint:
                    to_chain = (recent_swap or {}).get("to_chain")
                    system_injections.append(
                        "CONFIRMED_CROSS_CHAIN_SWAP: User confirmed cross-chain swap. "
                        f"You MUST call prepare_cross_chain_tx now with: fromToken={conf_token_in}, toToken={conf_token_out}, fromAmount={conf_amount}, fromChain={conf_chain}, toChain={to_chain}. "
                        "Do NOT call get_cross_chain_quote again."
                    )
            if (
                intent == "TRADING"
                and not parsed_intent.detailed.get("amount")
                and re.search(r"\b0x[a-fA-F0-9]{40}\b", current_user_text)
            ):
                system_injections.append(
                    "FAST SWAP SAFE MODE: User shared a token address without explicit trade amount/side. Ask one short confirmation question."
                )

            # replace the latest user message with enriched content
            for idx in range(len(llm_messages) - 1, -1, -1):
                if llm_messages[idx].get("role") == "user":
                    llm_messages[idx] = {"role": "user", "content": enriched_user}
                    break
            llm_messages = self._sanitize_tool_call_history(llm_messages)
            budget = context_budget_manager.apply_budget(
                llm_messages,
                recent_window=settings.CONTEXT_RECENT_WINDOW,
                max_input_tokens=settings.CONTEXT_MAX_INPUT_TOKENS,
                reserved_output_tokens=settings.CONTEXT_RESERVED_OUTPUT_TOKENS,
            )
            llm_messages = budget.messages
            if budget.compacted_summary:
                llm_messages.insert(0, {"role": "system", "content": budget.compacted_summary})
            llm_messages.insert(0, {"role": "system", "content": system_prompt})
            for inj in reversed(system_injections):
                llm_messages.insert(1, {"role": "system", "content": inj})
            if system_injections:
                tool_trace_state["system_injection_applied"] = list(system_injections)
            if tool_context.get("walletAddress"):
                llm_messages.insert(
                    1,
                    {
                        "role": "system",
                        "content": (
                            "Wallet is already connected in app context. "
                            "Do not ask for wallet address. Continue using the connected wallet directly."
                        ),
                    },
                )

            # Node parity: explicit balance context module as a standalone system block.
            balance_block = ""
            balance_snapshot = tool_context.get("balance") or ((tool_context.get("context") or {}).get("balance") if isinstance(tool_context.get("context"), dict) else None)
            if tool_context.get("walletAddress"):
                if isinstance(balance_snapshot, dict) and balance_snapshot:
                    preview = []
                    for i, (k, v) in enumerate(balance_snapshot.items()):
                        if i >= 12:
                            break
                        preview.append(f"- {k}: {v}")
                    balance_block = (
                        "[USER_BALANCE_CONTEXT]\n"
                        f"User Wallet: {tool_context.get('walletAddress')}\n"
                        f"Chain ID: {tool_context.get('chainId')}\n"
                        f"Native Balance: {tool_context.get('nativeBalance')}\n"
                        + "\n".join(preview)
                        + "\nRule: If token is not present in this snapshot, do not infer balance."
                    )
                else:
                    balance_block = (
                        "[USER_BALANCE_CONTEXT]\n"
                        f"User Wallet: {tool_context.get('walletAddress')}\n"
                        "Status: unavailable (balance data not available from cache)."
                    )

            requested_tokens: list[str] = []
            for v in [
                parsed_intent.detailed.get("token_in"),
                parsed_intent.detailed.get("token_out"),
                parsed_intent.detailed.get("token_address"),
            ]:
                if isinstance(v, str) and v.strip():
                    requested_tokens.append(v.strip())
            if requested_tokens:
                req_lines: list[str] = []
                bal_map = balance_snapshot if isinstance(balance_snapshot, dict) else {}
                for req in requested_tokens:
                    if req.startswith("0x"):
                        req_lines.append(f"- {req}: not present in provided balance snapshot")
                        continue
                    key = req.upper()
                    if key in bal_map:
                        req_lines.append(f"- {key}: {bal_map[key]}")
                    else:
                        req_lines.append(f"- {key}: not present in provided balance snapshot")
                requested_block = (
                    "[REQUESTED_TOKEN_BALANCE]\n"
                    + "\n".join(req_lines)
                    + "\nRule: If token is marked 'not present', balance is unknown/zero; do NOT infer or guess."
                )
                if balance_block:
                    balance_block = balance_block + "\n\n" + requested_block
                else:
                    balance_block = requested_block

            if balance_block:
                tool_trace_state["balance_context_block_bytes"] = len(balance_block)
                llm_messages.insert(1, {"role": "system", "content": balance_block})

            seed_hits = self._seed_tool_cache_from_context(tool_trace_state.get("resultCache", {}), tool_context)
            tool_trace_state["tool_cache_seed_hits"] = seed_hits

        async def flush_chunks(db: AsyncSession):
            nonlocal chunk_idx, pending_content, pending_reasoning
            if not assistant_message_id:
                pending_content = ""
                pending_reasoning = ""
                return
            if pending_content:
                await repo.add_chunk(db, assistant_message_id, chunk_idx, "content", content=pending_content)
                chunk_idx += 1
                pending_content = ""
            if pending_reasoning:
                await repo.add_chunk(db, assistant_message_id, chunk_idx, "reasoning", reasoning_content=pending_reasoning)
                chunk_idx += 1
                pending_reasoning = ""

        headers = {"Content-Type": "application/json"}
        if settings.INTERNAL_SERVICE_KEY:
            headers["x-service-key"] = settings.INTERNAL_SERVICE_KEY

        try:
            timeout = httpx.Timeout(connect=8, read=120, write=20, pool=8)
            async with httpx.AsyncClient(timeout=timeout) as client:
                # Node parity: prefetch wallet snapshot for trading intents to avoid redundant
                # "please provide wallet address" replies when wallet is already connected.
                if (
                    selected_intent == "TRADING"
                    and isinstance(tool_context, dict)
                    and tool_context.get("walletAddress")
                    and not isinstance(tool_context.get("__wallet_info_cache"), dict)
                ):
                    self.logger.info(
                        "wallet prefetch start task_id=%s wallet=%s chain=%s",
                        task_id,
                        tool_context.get("walletAddress"),
                        tool_context.get("chainId"),
                    )
                    try:
                        prefetch_resp = await client.post(
                            settings.TOOL_RUNTIME_URL.rstrip("/") + "/internal/v1/tool/execute",
                            headers=headers,
                            json={
                                "tool_name": "get_wallet_info",
                                "arguments": {
                                    "address": tool_context.get("walletAddress"),
                                    "chainId": tool_context.get("chainId"),
                                },
                                "context": {
                                    "walletAddress": tool_context.get("walletAddress"),
                                    "chainId": tool_context.get("chainId"),
                                    "nativeBalance": tool_context.get("nativeBalance"),
                                    "balance": tool_context.get("balance"),
                                    "context": tool_context.get("context"),
                                },
                            },
                            timeout=min(12, settings.TOOL_EXEC_TIMEOUT_SEC),
                        )
                        if prefetch_resp.status_code < 400:
                            prefetch_json = prefetch_resp.json() or {}
                            self.logger.info(
                                "wallet prefetch response task_id=%s status=%s body=%s",
                                task_id,
                                prefetch_resp.status_code,
                                self._short(prefetch_json),
                            )
                            if prefetch_json.get("ok") and isinstance(prefetch_json.get("result"), dict):
                                wallet_info = prefetch_json.get("result")
                                tool_context["__wallet_info_cache"] = wallet_info
                                # Node parity: project wallet snapshot back into task context so prompt/context
                                # can directly expose balances without forcing another tool round.
                                if not tool_context.get("nativeBalance"):
                                    nb = wallet_info.get("ethBalanceFormatted")
                                    if nb is None:
                                        nb = wallet_info.get("ethBalance")
                                    if nb is not None:
                                        tool_context["nativeBalance"] = str(nb)
                                if not tool_context.get("balance"):
                                    tokens_map: dict[str, str] = {}
                                    tokens = wallet_info.get("tokens") if isinstance(wallet_info, dict) else []
                                    if isinstance(tokens, list):
                                        for t in tokens[:24]:
                                            if not isinstance(t, dict):
                                                continue
                                            sym = str(t.get("symbol") or "").upper().strip()
                                            bal = t.get("balance")
                                            if sym and bal is not None:
                                                tokens_map[sym] = str(bal)
                                    if tokens_map:
                                        tool_context["balance"] = tokens_map
                                        base_ctx = tool_context.get("context") if isinstance(tool_context.get("context"), dict) else {}
                                        base_ctx = dict(base_ctx)
                                        base_ctx["balance"] = tokens_map
                                        tool_context["context"] = base_ctx
                                llm_messages.insert(
                                    1,
                                    {
                                        "role": "system",
                                        "content": (
                                            "[WALLET_CONTEXT]\n"
                                            f"- Wallet connected: yes\n"
                                            f"- Address: {wallet_info.get('address') or tool_context.get('walletAddress')}\n"
                                            f"- Chain: {wallet_info.get('chain') or tool_context.get('chainId')}\n"
                                            f"- Native balance: {tool_context.get('nativeBalance')}\n"
                                            "- Use this wallet context directly. Do not ask for wallet address again unless context is missing."
                                        ),
                                    },
                                )
                    except Exception as e:
                        self.logger.warning("wallet prefetch failed (non-fatal): %s", e)

                if (
                    selected_intent == "TRADING"
                    and parsed_intent.detailed.get("amount")
                    and str(parsed_intent.detailed.get("amount_semantic") or "input") == "output"
                ):
                    llm_messages.insert(
                        2,
                        {
                            "role": "system",
                            "content": (
                                "Trade handling rule: target output amount is already specified by user. "
                                "Do not ask the user to confirm input amount; infer amount_in from quote and continue."
                            ),
                        },
                    )

                prefetch_plan = await self._pre_fetch_by_intent(
                    client,
                    headers,
                    tool_context,
                    parsed_intent,
                    tool_trace_state.get("resultCache", {}),
                )
                if prefetch_plan:
                    tool_trace_state["pre_fetch_plan"] = prefetch_plan
                    self.logger.info(
                        "prefetch plan task_id=%s items=%s",
                        task_id,
                        prefetch_plan,
                    )

                tools = await self._fetch_tool_definitions(client, headers)
                # Skills-gated tool availability by intent/mode (Node parity behavior).
                allowed_tool_names = skill_prompt_registry.tools_for(selected_intent, selected_routing_mode)
                # For explicit trading requests, hard-limit tools to the minimal swap path.
                if trading_slots_complete:
                    allowed_tool_names = {
                        "get_wallet_info",
                        "get_token_info",
                        "simulate_swap",
                        "prepare_swap_transaction",
                        "execute_swap",
                        "get_cross_chain_quote",
                        "prepare_cross_chain_tx",
                    }
                # Only allow web search for analysis/research intents.
                if selected_intent in {"MARKET_ANALYSIS", "SOCIAL_SENSING", "PREDICTION_MARKETS", "RISK_SCAN"}:
                    allowed_tool_names.add("external_web_search")
                # If wallet snapshot already exists in context, don't waste a round on wallet tool.
                if isinstance(tool_context.get("__wallet_info_cache"), dict):
                    allowed_tool_names.discard("get_wallet_info")
                if tool_context.get("__confirmed_swap"):
                    allowed_tool_names.discard("simulate_swap")
                # IMPORTANT: if skills resolve to 0 tools, keep it 0 (no full-tool fallback).
                tools = [t for t in tools if ((t.get("function") or {}).get("name") in allowed_tool_names)]
                self.logger.info(
                    "tool selection task_id=%s intent=%s mode=%s allowed=%s selected=%s",
                    task_id,
                    selected_intent,
                    selected_routing_mode,
                    sorted(list(allowed_tool_names)),
                    [((t.get("function") or {}).get("name")) for t in tools],
                )

                completed = False
                for round_idx in range(settings.MAX_TOOL_ROUNDS):
                    self.logger.info(
                        "llm round start task_id=%s round=%s/%s tool_trace_calls=%s",
                        task_id,
                        round_idx + 1,
                        settings.MAX_TOOL_ROUNDS,
                        len(tool_trace),
                    )
                    await ws_manager.broadcast_event(
                        payload.user_id,
                        "status",
                        session_id,
                        assistant_message_id,
                        {
                            "status": "running",
                            "message": "Thinking" if round_idx == 0 else f"Processing tool results ({round_idx + 1}/{settings.MAX_TOOL_ROUNDS})",
                            "task_id": task_id,
                            "taskId": task_id,
                            "taskType": task_type,
                            "iteration": round_idx + 1,
                            "maxIterations": settings.MAX_TOOL_ROUNDS,
                        },
                    )
                    round_tool_deltas: dict[str, dict[str, Any]] = {}
                    round_had_done = False
                    round_assistant_content = ""
                    round_assistant_reasoning = ""

                    req: dict[str, Any] = {
                        "model": model,
                        "messages": llm_messages,
                        "stream": True,
                        "metadata": {
                            "task_id": task_id,
                            "session_id": session_id,
                            "assistant_message_id": assistant_message_id,
                            "tool_round": str(round_idx),
                        },
                    }
                    if tools:
                        req["tools"] = tools
                    self.logger.info(
                        "llm request task_id=%s round=%s model=%s tools=%s msg_count=%s",
                        task_id,
                        round_idx + 1,
                        model,
                        [((t.get("function") or {}).get("name")) for t in (req.get("tools") or [])],
                        len(llm_messages),
                    )

                    async with client.stream(
                        "POST",
                        settings.LLM_GATEWAY_URL.rstrip("/") + "/internal/v1/generate",
                        headers=headers,
                        json=req,
                    ) as resp:
                        if resp.status_code >= 400:
                            txt = (await resp.aread()).decode("utf-8", errors="ignore")
                            raise RuntimeError(f"LLM gateway error HTTP {resp.status_code}: {txt[:400]}")

                        last_cancel_check = 0.0
                        async with SessionLocal() as db:
                            async for line in resp.aiter_lines():
                                if not line or not line.startswith("data: "):
                                    continue
                                now = time.time()
                                if (now - last_cancel_check) * 1000 >= settings.CANCEL_CHECK_MS:
                                    t = await repo.get_task(db, task_id)
                                    if not t or t.status == "cancelled":
                                        await ws_manager.broadcast_event(
                                            payload.user_id,
                                            "status",
                                            session_id,
                                            assistant_message_id,
                                            {"status": "stopped", "task_id": task_id, "taskId": task_id, "cancelled": True, "taskType": task_type},
                                        )
                                        await ws_manager.broadcast_event(
                                            payload.user_id,
                                            "message_complete",
                                            session_id,
                                            assistant_message_id,
                                            {"message_id": assistant_message_id},
                                        )
                                        return
                                    last_cancel_check = now

                                data = json.loads(line[6:])
                                et = data.get("event_type")
                                provider = data.get("provider") or provider
                                provider_request_id = data.get("provider_request_id") or provider_request_id
                                p = data.get("payload") or {}

                                if et == "message_start":
                                    if not sent_message_start:
                                        sent_message_start = True
                                        await ws_manager.broadcast_event(
                                            payload.user_id,
                                            "message_start",
                                            session_id,
                                            assistant_message_id,
                                            {"message_id": assistant_message_id, "task_id": task_id, "taskId": task_id},
                                        )
                                elif et == "delta_text":
                                    txt = str(p.get("text") or "")
                                    if txt:
                                        if first_token_ms is None:
                                            first_token_ms = int((time.time() - started) * 1000)
                                        content += txt
                                        round_assistant_content += txt
                                        pending_content += txt
                                        await ws_manager.broadcast_event(payload.user_id, "delta_text", session_id, assistant_message_id, {"text": txt})
                                elif et == "delta_reasoning":
                                    txt = str(p.get("text") or "")
                                    if txt:
                                        reasoning += txt
                                        round_assistant_reasoning += txt
                                        pending_reasoning += txt
                                        await ws_manager.broadcast_event(payload.user_id, "delta_reasoning", session_id, assistant_message_id, {"text": txt})
                                elif et == "tool_call":
                                    deltas = p.get("tool_calls") or []
                                    if isinstance(deltas, list):
                                        self._merge_tool_call_deltas(round_tool_deltas, deltas)
                                elif et == "usage":
                                    usage = p.get("usage")
                                    self.logger.info("llm usage task_id=%s round=%s usage=%s", task_id, round_idx + 1, self._short(usage, 400))
                                    await ws_manager.broadcast_event(payload.user_id, "usage", session_id, assistant_message_id, {"usage": usage})
                                elif et == "citation":
                                    cits = p.get("citations") or []
                                    if isinstance(cits, list):
                                        citations.extend(cits)
                                    await ws_manager.broadcast_event(payload.user_id, "citation", session_id, assistant_message_id, {"citations": cits})
                                elif et == "latency_metrics":
                                    await ws_manager.broadcast_event(payload.user_id, "latency_metrics", session_id, assistant_message_id, p)
                                elif et == "error":
                                    raise RuntimeError(p.get("message") or "LLM stream error")
                                elif et == "done":
                                    round_had_done = True
                                    break

                                if (now - last_flush) * 1000 >= settings.CHUNK_FLUSH_MS:
                                    await flush_chunks(db)
                                    last_flush = now

                    # build complete tool calls for this round
                    round_tool_calls = list(round_tool_deltas.values())
                    round_tool_calls = [tc for tc in round_tool_calls if (tc.get("function") or {}).get("name")]
                    if round_tool_calls:
                        self.logger.info(
                            "round tool_calls merged task_id=%s round=%s count=%s calls=%s",
                            task_id,
                            round_idx + 1,
                            len(round_tool_calls),
                            self._short(
                                [
                                    {
                                        "id": tc.get("id"),
                                        "name": (tc.get("function") or {}).get("name"),
                                        "args": (tc.get("function") or {}).get("arguments"),
                                    }
                                    for tc in round_tool_calls
                                ],
                                1200,
                            ),
                        )
                    if round_tool_calls:
                        exec_context = {
                            "user_id": payload.user_id,
                            "session_id": session_id,
                            "task_id": task_id,
                            **(tool_context or {}),
                        }
                        traces_this_round: list[dict[str, Any]] = []
                        # Deduplicate tool calls within the same round by normalized name+args.
                        deduped_calls: list[dict[str, Any]] = []
                        seen_keys: set[str] = set()
                        for tc in round_tool_calls:
                            fn = tc.get("function") or {}
                            name = str(fn.get("name") or "").strip()
                            args_raw = fn.get("arguments") or "{}"
                            try:
                                parsed = json.loads(args_raw) if isinstance(args_raw, str) else (args_raw or {})
                                parsed_args = parsed if isinstance(parsed, dict) else {"_value": parsed}
                            except Exception:
                                parsed_args = {"_raw_arguments": str(args_raw)}
                            parsed_args = self._normalize_tool_args(name, parsed_args, exec_context)
                            tc_key = self._build_tool_key(name, parsed_args)
                            if tc_key in seen_keys:
                                continue
                            seen_keys.add(tc_key)
                            deduped_calls.append(tc)
                            if len(deduped_calls) >= settings.MAX_TOOL_CALLS_PER_ROUND:
                                break
                        round_tool_calls = deduped_calls
                        # Broadcast a single merged tool_call event per round to avoid delta spam on frontend.
                        await ws_manager.broadcast_event(
                            payload.user_id,
                            "tool_call",
                            session_id,
                            assistant_message_id,
                            {"tool_calls": round_tool_calls},
                        )
                        # feed assistant tool-call turn back to model context
                        llm_messages.append(
                            {
                                "role": "assistant",
                                "content": round_assistant_content or None,
                                "tool_calls": round_tool_calls,
                            }
                        )

                        async def _persist_and_broadcast_tool_trace(trace: dict[str, Any]):
                            nonlocal chunk_idx, task_type
                            tool_trace.append(trace)
                            traces_this_round.append(trace)
                            await ws_manager.broadcast_event(
                                payload.user_id,
                                "tool_result",
                                session_id,
                                assistant_message_id,
                                {
                                    "tool_name": trace["tool"],
                                    "tool_call_id": trace["tool_call_id"],
                                    "result": trace.get("result"),
                                    "status": trace.get("status"),
                                },
                            )
                            result_obj = trace.get("result")
                            if isinstance(result_obj, dict):
                                action = result_obj.get("__client_action")
                                tx_card = result_obj.get("__transaction_card")
                                if not action and isinstance(tx_card, dict):
                                    action = {"type": "show_transaction_status_card", "data": tx_card}
                                if isinstance(action, dict) and action.get("type"):
                                    action_type = str(action.get("type"))
                                    if action_type in {"show_transaction_status_card", "show_cross_chain_status_card"}:
                                        task_type = "card"
                                    await ws_manager.broadcast_event(
                                        payload.user_id,
                                        "client_action",
                                        session_id,
                                        assistant_message_id,
                                        {
                                            "message_id": assistant_message_id,
                                            "messageId": assistant_message_id,
                                            "action": action,
                                        },
                                    )
                            async with SessionLocal() as db:
                                await repo.add_chunk(
                                    db,
                                    assistant_message_id,
                                    chunk_idx,
                                    "tool_result",
                                    metadata_json={
                                        "tool_name": trace["tool"],
                                        "tool_call_id": trace["tool_call_id"],
                                        "status": trace.get("status"),
                                    },
                                )
                                chunk_idx += 1

                        for tc in round_tool_calls:
                            self.logger.info(
                                "tool execute start task_id=%s round=%s tool=%s raw_args=%s",
                                task_id,
                                round_idx + 1,
                                (tc.get("function") or {}).get("name"),
                                self._short((tc.get("function") or {}).get("arguments"), 500),
                            )
                            tool_msg, trace = await self._execute_tool_call(client, headers, tc, exec_context, tool_trace_state)
                            self.logger.info(
                                "tool execute done task_id=%s round=%s tool=%s status=%s result=%s error=%s",
                                task_id,
                                round_idx + 1,
                                trace.get("tool"),
                                trace.get("status"),
                                self._short(trace.get("result"), 600),
                                self._short(trace.get("error"), 300),
                            )
                            llm_messages.append(tool_msg)
                            await _persist_and_broadcast_tool_trace(trace)

                        should_auto_prepare = (
                            selected_intent == "TRADING"
                            and str(parsed_intent.detailed.get("amount_semantic") or "input") == "output"
                            and not tool_trace_state.get("auto_prepare_done")
                            and any(
                                t.get("tool") == "simulate_swap" and t.get("status") in {"success", "cached"}
                                for t in traces_this_round
                            )
                            and not any(
                                t.get("tool") == "prepare_swap_transaction" and t.get("status") in {"success", "cached"}
                                for t in tool_trace
                            )
                        )
                        if should_auto_prepare:
                            auto_tc = {
                                "id": f"auto_prepare_{round_idx + 1}",
                                "type": "function",
                                "function": {"name": "prepare_swap_transaction", "arguments": "{}"},
                            }
                            self.logger.info(
                                "auto prepare triggered task_id=%s round=%s reason=simulate_success_output_intent",
                                task_id,
                                round_idx + 1,
                            )
                            await ws_manager.broadcast_event(
                                payload.user_id,
                                "tool_call",
                                session_id,
                                assistant_message_id,
                                {"tool_calls": [auto_tc]},
                            )
                            llm_messages.append(
                                {
                                    "role": "assistant",
                                    "content": None,
                                    "tool_calls": [auto_tc],
                                }
                            )
                            tool_msg, trace = await self._execute_tool_call(client, headers, auto_tc, exec_context, tool_trace_state)
                            self.logger.info(
                                "auto prepare done task_id=%s round=%s status=%s result=%s error=%s",
                                task_id,
                                round_idx + 1,
                                trace.get("status"),
                                self._short(trace.get("result"), 700),
                                self._short(trace.get("error"), 300),
                            )
                            llm_messages.append(tool_msg)
                            await _persist_and_broadcast_tool_trace(trace)
                            if isinstance(trace.get("result"), dict):
                                summary = str(trace["result"].get("summary") or "").strip()
                                if summary and summary not in content:
                                    content = (content + "\n\n" + summary).strip()
                            tool_trace_state["auto_prepare_done"] = True
                        if tool_trace_state["shouldExitImmediately"]:
                            completed = True
                            break
                        if any(
                            r.startswith("tool_call_limit")
                            or r.startswith("tool_failure_limit")
                            or r.startswith("tool_args_repeat")
                            or r.startswith("tool_missing_args")
                            for r in tool_trace_state["stopReasons"]
                        ):
                            tool_trace_state["stoppedByLimit"] = True
                            self.logger.warning(
                                "tool loop stopped by limit task_id=%s stop_reasons=%s counts=%s",
                                task_id,
                                list(dict.fromkeys(tool_trace_state.get("stopReasons", []))),
                                tool_trace_state.get("toolCallCounts", {}),
                            )
                            break
                        # continue next round with tool results in context
                        continue

                    # no tool calls this round: finalize
                    if round_had_done:
                        completed = True
                        break

                async with SessionLocal() as db:
                    await flush_chunks(db)
                    # Guardrail: wallet already present in context, prevent incorrect asks for wallet address.
                    if (
                        isinstance(tool_context, dict)
                        and tool_context.get("walletAddress")
                        and content
                    ):
                        lower_content = content.lower()
                        wallet_ask_patterns = [
                            "provide your wallet address",
                            "please provide your wallet address",
                            "need your wallet address",
                            "what is your wallet address",
                        ]
                        if any(x in lower_content for x in wallet_ask_patterns) or ("钱包地址" in content):
                            self.logger.warning(
                                "wallet ask suppressed task_id=%s wallet=%s original=%s",
                                task_id,
                                tool_context.get("walletAddress"),
                                self._short(content, 700),
                            )
                            content = re.sub(
                                r"(?is).*?(provide|please provide|need|what is).*wallet address.*",
                                "Wallet is already connected. Continuing with your connected wallet on Base and proceeding to quote + prepare the swap.",
                                content,
                            )
                            content = content.replace("我需要你的钱包地址", "已检测到你的钱包已连接，继续执行报价和交易准备。")
                            content = content.replace("请提供你的钱包地址", "已检测到你的钱包已连接，继续执行报价和交易准备。")
                    # Do not expose internal guardrail notices to end-users.
                    end_to_end = int((time.time() - started) * 1000)
                    if assistant_message_id:
                        await repo.update_message_content(
                            db,
                            assistant_message_id,
                            content=content,
                            reasoning_content=reasoning,
                            status="complete",
                            usage_json=usage,
                            citations_json=citations or None,
                            provider=provider,
                            provider_request_id=provider_request_id,
                            first_token_ms=first_token_ms,
                            end_to_end_ms=end_to_end,
                            tool_trace_json={
                                "mode": tool_trace_state.get("mode"),
                                "skillVersion": tool_trace_state.get("skillVersion"),
                                "toolCalls": tool_trace,
                                "toolCallCounts": tool_trace_state.get("toolCallCounts", {}),
                                "toolFailures": tool_trace_state.get("toolFailures", {}),
                                "toolRepeats": tool_trace_state.get("toolRepeats", {}),
                                "stopReasons": list(dict.fromkeys(tool_trace_state.get("stopReasons", []))),
                                "intent_decision": tool_trace_state.get("intent_decision"),
                                "system_injection_applied": tool_trace_state.get("system_injection_applied", []),
                                "balance_context_block_bytes": tool_trace_state.get("balance_context_block_bytes", 0),
                                "tool_cache_seed_hits": tool_trace_state.get("tool_cache_seed_hits", {}),
                                "pre_fetch_plan": tool_trace_state.get("pre_fetch_plan", []),
                            },
                        )
                    t = await repo.get_task(db, task_id)
                    if not t:
                        return
                    await repo.set_task_status(db, t, "done")
                    await ws_manager.broadcast_event(
                        payload.user_id,
                        "status",
                        session_id,
                        assistant_message_id,
                        {"status": "done", "task_id": task_id, "taskId": task_id, "taskType": task_type},
                    )
                    await ws_manager.broadcast_event(
                        payload.user_id,
                        "message_complete",
                        session_id,
                        assistant_message_id,
                        {"message_id": assistant_message_id},
                    )
                    self.logger.info(
                        "chat task complete task_id=%s session_id=%s end_to_end_ms=%s first_token_ms=%s tool_counts=%s stop_reasons=%s",
                        task_id,
                        session_id,
                        end_to_end,
                        first_token_ms,
                        tool_trace_state.get("toolCallCounts", {}),
                        list(dict.fromkeys(tool_trace_state.get("stopReasons", []))),
                    )

        except Exception as e:
            self.logger.exception("ChatWorker task failed: task_id=%s error=%s", task_id, e)
            async with SessionLocal() as db:
                t = await repo.get_task(db, task_id)
                if not t:
                    return
                await repo.set_task_status(db, t, "error", error_message=str(e))
                if assistant_message_id:
                    await repo.update_message_content(
                        db,
                        assistant_message_id,
                        status="error",
                        content=content,
                        reasoning_content=reasoning,
                        tool_trace_json={
                            "mode": tool_trace_state.get("mode"),
                            "skillVersion": tool_trace_state.get("skillVersion"),
                            "toolCalls": tool_trace,
                            "toolCallCounts": tool_trace_state.get("toolCallCounts", {}),
                            "toolFailures": tool_trace_state.get("toolFailures", {}),
                            "toolRepeats": tool_trace_state.get("toolRepeats", {}),
                            "stopReasons": list(dict.fromkeys(tool_trace_state.get("stopReasons", []))),
                            "intent_decision": tool_trace_state.get("intent_decision"),
                            "system_injection_applied": tool_trace_state.get("system_injection_applied", []),
                            "balance_context_block_bytes": tool_trace_state.get("balance_context_block_bytes", 0),
                            "tool_cache_seed_hits": tool_trace_state.get("tool_cache_seed_hits", {}),
                            "pre_fetch_plan": tool_trace_state.get("pre_fetch_plan", []),
                        },
                    )
                await ws_manager.broadcast_event(
                    payload.user_id,
                    "error",
                    session_id,
                    assistant_message_id,
                    {"message": str(e), "task_id": task_id, "taskId": task_id},
                )
                await ws_manager.broadcast_event(
                    payload.user_id,
                    "status",
                    session_id,
                    assistant_message_id,
                    {"status": "failed", "error": str(e), "task_id": task_id, "taskId": task_id, "taskType": task_type},
                )
                await ws_manager.broadcast_event(
                    payload.user_id,
                    "message_complete",
                    session_id,
                    assistant_message_id,
                    {"message_id": assistant_message_id},
                )
