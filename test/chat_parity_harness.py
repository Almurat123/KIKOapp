#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx
import websockets


@dataclass
class Target:
    name: str
    base_http: str
    base_ws: str
    api_prefix: str
    ws_path: str


def _normalize_event(ev: dict[str, Any]) -> dict[str, Any]:
    t = ev.get("type")
    payload = ev.get("payload") or ev.get("data") or {}
    # Legacy Node WS normalization
    if t == "task_status":
        t = "status"
        payload = {
            "status": payload.get("status"),
            "taskType": payload.get("taskType"),
            "iteration": payload.get("iteration"),
            "maxIterations": payload.get("maxIterations"),
        }
    if t == "chunk":
        chunk_type = payload.get("type")
        if chunk_type == "reasoning":
            t = "delta_reasoning"
            payload = {"len": len(str(payload.get("reasoning_content") or ""))}
        else:
            t = "delta_text"
            payload = {"len": len(str(payload.get("content") or payload.get("delta") or ""))}
    if t == "citations":
        t = "citation"
        cits = payload.get("citations") or []
        payload = {"count": len(cits) if isinstance(cits, list) else 0}
    if t == "usage":
        payload = {"has_usage": bool(payload.get("usage") or payload)}
    if t == "message_complete":
        payload = {"message_id": payload.get("message_id") or payload.get("messageId")}
    if t == "status":
        payload = {
            "status": payload.get("status"),
            "taskType": payload.get("taskType"),
            "iteration": payload.get("iteration"),
            "maxIterations": payload.get("maxIterations"),
        }
    if t == "delta_text":
        payload = {"len": len(str(payload.get("text") or payload.get("content") or ""))}
    if t == "delta_reasoning":
        payload = {"len": len(str(payload.get("text") or payload.get("reasoning_content") or ""))}
    if t == "tool_call":
        tool_calls = payload.get("tool_calls") or []
        payload = {"tools": [((tc.get("function") or {}).get("name")) for tc in tool_calls]}
    if t == "tool_result":
        payload = {
            "tool": payload.get("tool_name"),
            "status": payload.get("status"),
            "has_result": payload.get("result") is not None,
        }
    if t == "client_action":
        action = payload.get("action") or payload
        payload = {"action_type": action.get("type")}
    return {"type": t, "payload": payload}


def _normalize_text(s: str | None) -> str:
    if not s:
        return ""
    return " ".join(str(s).strip().split())


def _extract_tool_names(trace: Any) -> list[str]:
    if not isinstance(trace, dict):
        return []
    calls = trace.get("toolCalls") or []
    if not isinstance(calls, list):
        return []
    out: list[str] = []
    for c in calls:
        if isinstance(c, dict):
            name = c.get("tool")
            if isinstance(name, str) and name:
                out.append(name)
    return out


def _extract_stop_reasons(trace: Any) -> list[str]:
    if not isinstance(trace, dict):
        return []
    reasons = trace.get("stopReasons") or []
    return [str(r) for r in reasons if r is not None]


async def _run_target(
    target: Target,
    token: str,
    app_key: str,
    message: str,
    model: str,
    wallet: str,
    chain_id: int,
    timeout_sec: int,
) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    if app_key:
        headers["X-App-Key"] = app_key
    async with httpx.AsyncClient(timeout=30) as client:
        s_resp = await client.post(f"{target.base_http}{target.api_prefix}/sessions", headers=headers, json={"model": model})
        s_resp.raise_for_status()
        session_id = s_resp.json()["session"]["id"]

        ws_qs = {"token": token}
        if app_key:
            ws_qs["appKey"] = app_key
        ws_url = f"{target.base_ws}{target.ws_path}?{urlencode(ws_qs)}"

        events: list[dict[str, Any]] = []
        started = time.time()
        timed_out = False
        async with websockets.connect(ws_url, max_size=4 * 1024 * 1024) as ws:
            send_payload = {
                "content": message,
                "model": model,
                "walletAddress": wallet,
                "chainId": chain_id,
                "context": {
                    "walletAddress": wallet,
                    "chainId": chain_id,
                    "chainName": "Base",
                    "isWalletConnected": True,
                },
            }
            m_resp = await client.post(
                f"{target.base_http}{target.api_prefix}/sessions/{session_id}/messages",
                headers=headers,
                json=send_payload,
            )
            m_resp.raise_for_status()
            task_id = m_resp.json()["task"]["id"]

            while time.time() - started < timeout_sec:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=timeout_sec)
                except TimeoutError:
                    timed_out = True
                    break
                ev = json.loads(raw)
                ev_session = ev.get("session_id") or ev.get("sessionId")
                if ev_session != session_id:
                    continue
                events.append(ev)
                if ev.get("type") == "message_complete":
                    break

        conv = await client.get(f"{target.base_http}{target.api_prefix}/sessions/{session_id}", headers=headers)
        conv.raise_for_status()
        data = conv.json()
        assistant = next((m for m in data.get("messages", []) if m.get("role") == "assistant"), None)

        return {
            "target": target.name,
            "session_id": session_id,
            "task_id": task_id,
            "events": events,
            "normalized_events": [_normalize_event(e) for e in events],
            "assistant_content": (assistant or {}).get("content"),
            "assistant_reasoning": (assistant or {}).get("reasoning_content"),
            "assistant_tool_trace": (assistant or {}).get("tool_trace_json"),
            "timed_out": timed_out,
        }


def _diff_lists(a: list[dict[str, Any]], b: list[dict[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {"same_length": len(a) == len(b), "len_a": len(a), "len_b": len(b), "first_mismatch": None}
    for i in range(min(len(a), len(b))):
        if a[i] != b[i]:
            out["first_mismatch"] = {"index": i, "a": a[i], "b": b[i]}
            break
    return out


async def main():
    parser = argparse.ArgumentParser(description="Node/Python chat parity harness")
    parser.add_argument("--node-http", default=os.getenv("NODE_HTTP_BASE", "http://127.0.0.1:3001"))
    parser.add_argument("--node-ws", default=os.getenv("NODE_WS_BASE", "ws://127.0.0.1:3001"))
    parser.add_argument("--node-api-prefix", default=os.getenv("NODE_API_PREFIX", "/api/chat"))
    parser.add_argument("--node-ws-path", default=os.getenv("NODE_WS_PATH", "/api/chat/ws"))
    parser.add_argument("--py-http", default=os.getenv("PY_HTTP_BASE", "http://127.0.0.1:8001"))
    parser.add_argument("--py-ws", default=os.getenv("PY_WS_BASE", "ws://127.0.0.1:8001"))
    parser.add_argument("--py-api-prefix", default=os.getenv("PY_API_PREFIX", "/v2/chat"))
    parser.add_argument("--py-ws-path", default=os.getenv("PY_WS_PATH", "/v2/chat/ws"))
    parser.add_argument("--token", default=os.getenv("PARITY_BEARER_TOKEN", ""))
    parser.add_argument("--app-key", default=os.getenv("VITE_APP_KEY", ""))
    parser.add_argument("--message", default="")
    parser.add_argument(
        "--messages",
        default="Buy 1 USDC use ETH||Proceed||Sell all USDC to ETH||What is trending on Base today?",
        help="Multiple test messages separated by ||",
    )
    parser.add_argument("--model", default="deepseek-chat")
    parser.add_argument("--wallet", default=os.getenv("PARITY_WALLET", "0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E"))
    parser.add_argument("--chain-id", type=int, default=8453)
    parser.add_argument("--timeout-sec", type=int, default=120)
    parser.add_argument("--out", default="test/parity-report-latest.json")
    args = parser.parse_args()

    if not args.token:
        raise SystemExit("Missing --token (or PARITY_BEARER_TOKEN)")

    node = Target(
        "node",
        args.node_http.rstrip("/"),
        args.node_ws.rstrip("/"),
        args.node_api_prefix.rstrip("/"),
        args.node_ws_path,
    )
    py = Target(
        "python",
        args.py_http.rstrip("/"),
        args.py_ws.rstrip("/"),
        args.py_api_prefix.rstrip("/"),
        args.py_ws_path,
    )
    cases = [x.strip() for x in ((args.message or "").split("||") if args.message else args.messages.split("||")) if x.strip()]

    case_reports: list[dict[str, Any]] = []
    for idx, case_msg in enumerate(cases, start=1):
        node_res, py_res = await asyncio.gather(
            _run_target(node, args.token, args.app_key, case_msg, args.model, args.wallet, args.chain_id, args.timeout_sec),
            _run_target(py, args.token, args.app_key, case_msg, args.model, args.wallet, args.chain_id, args.timeout_sec),
        )
        node_trace = node_res.get("assistant_tool_trace")
        py_trace = py_res.get("assistant_tool_trace")

        node_tools = _extract_tool_names(node_trace)
        py_tools = _extract_tool_names(py_trace)
        node_stop = _extract_stop_reasons(node_trace)
        py_stop = _extract_stop_reasons(py_trace)

        events_diff = _diff_lists(node_res["normalized_events"], py_res["normalized_events"])
        tool_sequence_equal = node_tools == py_tools
        stop_reasons_equal = node_stop == py_stop
        content_equal = _normalize_text(node_res.get("assistant_content")) == _normalize_text(py_res.get("assistant_content"))
        events_equal = bool(events_diff.get("same_length")) and events_diff.get("first_mismatch") is None
        case_pass = events_equal and tool_sequence_equal and stop_reasons_equal and content_equal

        case_reports.append(
            {
                "index": idx,
                "message": case_msg,
                "node": node_res,
                "python": py_res,
                "diff": {
                    "events": events_diff,
                    "assistant_content_equal_normalized": content_equal,
                    "tool_sequence_equal": tool_sequence_equal,
                    "stop_reasons_equal": stop_reasons_equal,
                    "node_tools": node_tools,
                    "python_tools": py_tools,
                    "node_stop_reasons": node_stop,
                    "python_stop_reasons": py_stop,
                },
                "pass": case_pass,
            }
        )

    pass_count = sum(1 for c in case_reports if c.get("pass"))
    total = len(case_reports)
    report = {
        "input": {
            "messages": cases,
            "model": args.model,
            "wallet": args.wallet,
            "chain_id": args.chain_id,
        },
        "summary": {
            "total_cases": total,
            "passed_cases": pass_count,
            "pass_rate": (pass_count / total) if total else 0,
            "all_passed_100_percent": total > 0 and pass_count == total,
        },
        "cases": case_reports,
    }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(json.dumps({"ok": True, "out": args.out, "summary": report["summary"]}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
