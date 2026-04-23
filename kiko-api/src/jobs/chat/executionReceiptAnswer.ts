// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: Agent-mode execution replies were previously enforced by prompt
//         text, which spent tokens every turn and still left receipt fields
//         vulnerable to model omission. The runtime now owns the final receipt
//         answer for successful side-effecting tools. A 2026-04-19 runtime
//         deploy investigation also showed operators need an explicit skip
//         reason when this hook does not terminate a mutation turn. The same
//         investigation then showed failed deploy/order mutation tools were
//         falling back into another model round, so this owner must also build
//         deterministic failure receipts for supported side-effect tools.
// Goal: turn structured tool results into concise, deterministic user-visible
//       receipt answers that include hashes, order ids, token/config/rule ids,
//       returned product/explorer URLs, and tool-owned failure summaries,
//       while exposing machine-readable receipt decisions to orchestration logs.
// Owns: formatting terminal success/failure receipt answers from already-executed tool results.
// Does Not Own: building explorer URLs, executing tools, wallet policy checks,
//               or frontend card rendering.
// Design Language:
// - receipt answers are runtime output, not prompt obligations
// - use exact fields returned by tools; never fabricate unavailable links
// - supported side-effecting tools may terminate through this hook on success or failure
// - confirmation checkpoints are not execution receipts
// - receipt skip reasons must be logged without raw prompt or assistant text
// Document Provenance:
// - Source: operator requirement in local KiKo runtime thread
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-19
// - Applied To: deterministic tool-result receipt answer hook
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
// - Kind: repo doc
// - Retrieved: 2026-04-19
// - Applied To: receipt field and URL availability rules
// - Verification: verified in code
// - Source: operator browser console and app.log trace cmo5a4f1h03sjj5et046ndecy
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: receipt hook decision logging for failed deploy tool results
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-side-effect-tool-failure-terminal-receipts.md
// - Kind: repo doc
// - Retrieved: 2026-04-19
// - Applied To: deterministic failure receipts for supported side-effect tools
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-side-effect-tool-failure-terminal-receipts.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-stream-duplicate-and-tool-loop-diagnostics.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md

import type { OrchestratorToolResult } from "./contracts.js";

type Locale = "en" | "zh";
type ReceiptSkipReason =
  | "built_success"
  | "built_failure"
  | "tool_failed"
  | "unsupported_tool"
  | "missing_result"
  | "handled_response"
  | "confirmation_required"
  | "dry_run"
  | "missing_receipt_fields";

export type ExecutionReceiptDecision = {
  answer: string | null;
  reason: ReceiptSkipReason;
  toolName: string;
  resultKeys: string[];
};

const EXECUTION_RECEIPT_TOOLS = new Set([
  "prepare_swap_transaction",
  "execute_swap",
  "prepare_cross_chain_tx",
  "deploy_clanker_token",
  "place_polymarket_order",
  "withdraw_polymarket_position",
  "cancel_polymarket_order",
  "modify_polymarket_order",
  "create_copy_trade_config",
  "delete_copy_trade_config",
  "pause_copy_trade_config",
  "create_polymarket_copy_config",
  "update_polymarket_copy_config",
  "delete_polymarket_copy_config",
  "set_token_alert",
  "remove_token_alert",
]);

export function isExecutionReceiptToolName(toolName: string): boolean {
  return EXECUTION_RECEIPT_TOOLS.has(String(toolName || "").trim());
}

export function buildExecutionReceiptAnswer(
  toolResult: OrchestratorToolResult,
  locale: Locale = "zh",
): string | null {
  return buildExecutionReceiptDecision(toolResult, locale).answer;
}

export function buildExecutionReceiptDecision(
  toolResult: OrchestratorToolResult,
  locale: Locale = "zh",
): ExecutionReceiptDecision {
  const toolName = String(toolResult?.name || "");
  const base = (reason: ReceiptSkipReason, answer: string | null = null): ExecutionReceiptDecision => ({
    answer,
    reason,
    toolName,
    resultKeys: objectKeys(toolResult?.result),
  });

  if (!isExecutionReceiptToolName(toolName)) return base("unsupported_tool");
  const result = asRecord(toolResult.result);
  if (result?.handled_response === true) return base("handled_response");
  if (toolResult?.ok && result?.requires_confirmation === true) return base("confirmation_required");
  if (toolResult?.ok && result?.dryRun === true) return base("dry_run");
  if (!toolResult?.ok) {
    const answer = buildFailureReceiptAnswer(toolResult, result, locale);
    return base(answer ? "built_failure" : "tool_failed", answer);
  }
  if (!result) return base("missing_result");

  let answer: string | null = null;

  switch (toolResult.name) {
    case "prepare_swap_transaction":
    case "execute_swap":
      answer = buildTransactionAnswer(result, {
        locale,
        zhTitle: "Swap 已提交。",
        enTitle: "Swap submitted.",
      });
      break;
    case "prepare_cross_chain_tx":
      answer = buildCrossChainAnswer(result, locale);
      break;
    case "deploy_clanker_token":
      answer = buildClankerDeployAnswer(result, locale);
      break;
    case "place_polymarket_order":
    case "withdraw_polymarket_position":
    case "cancel_polymarket_order":
    case "modify_polymarket_order":
      answer = buildPolymarketOrderAnswer(toolResult.name, result, locale);
      break;
    case "create_copy_trade_config":
    case "delete_copy_trade_config":
    case "pause_copy_trade_config":
      answer = buildCopyTradeConfigAnswer(toolResult.name, result, locale);
      break;
    case "create_polymarket_copy_config":
    case "update_polymarket_copy_config":
    case "delete_polymarket_copy_config":
      answer = buildPolymarketCopyConfigAnswer(toolResult.name, result, locale);
      break;
    case "set_token_alert":
    case "remove_token_alert":
      answer = buildTokenAlertAnswer(toolResult.name, result, locale);
      break;
    default:
      return base("unsupported_tool");
  }
  return base(answer ? "built_success" : "missing_receipt_fields", answer);
}

function buildFailureReceiptAnswer(
  toolResult: OrchestratorToolResult,
  result: Record<string, any> | null,
  locale: Locale,
): string {
  const errorText =
    normalizeString(toolResult.error)
    || pick(result || {}, ["error", "message", "detail", "details", "summary"])
    || (locale === "zh" ? "未返回错误详情" : "No error details returned.");
  const reasonCode =
    normalizeString(toolResult.reasonCode)
    || pick(result || {}, ["reasonCode", "reason_code"]);

  return compactLines([
    failureTitle(toolResult.name, locale),
    formatLine(locale, "错误", "Error", errorText),
    reasonCode ? formatLine(locale, "原因代码", "Reason code", reasonCode) : null,
    ...buildFailureDetailLines(toolResult.name, result || {}, locale),
  ]);
}

function buildTransactionAnswer(
  result: Record<string, any>,
  labels: { locale: Locale; zhTitle: string; enTitle: string },
): string | null {
  const txHash = pick(result, ["txHash", "transactionHash", "hash"]);
  const explorerUrl = pick(result, [
    "explorerUrl",
    "explorer_url",
    "txUrl",
    "tx_url",
    "sourceExplorerUrl",
  ]);
  if (!txHash && !explorerUrl) return null;
  const lines = [
    labels.locale === "zh" ? labels.zhTitle : labels.enTitle,
    formatLine(labels.locale, "交易哈希", "Transaction hash", txHash),
    formatLine(labels.locale, "浏览器", "Explorer", explorerUrl),
  ];
  return compactLines(lines);
}

function buildCrossChainAnswer(
  result: Record<string, any>,
  locale: Locale,
): string | null {
  const txHash = pick(result, ["txHash", "transactionHash", "hash"]);
  const sourceExplorerUrl = pick(result, [
    "sourceExplorerUrl",
    "explorerUrl",
    "explorer_url",
    "txUrl",
  ]);
  const lifiExplorerUrl = pick(result, [
    "lifiExplorerUrl",
    "explorerLink",
    "lifiTrackerUrl",
  ]);
  if (!txHash && !sourceExplorerUrl && !lifiExplorerUrl) return null;
  return compactLines([
    locale === "zh" ? "跨链交易已提交。" : "Cross-chain transaction submitted.",
    formatLine(locale, "交易哈希", "Transaction hash", txHash),
    formatLine(locale, "源链浏览器", "Source explorer", sourceExplorerUrl),
    formatLine(locale, "LI.FI 跟踪", "LI.FI tracker", lifiExplorerUrl),
  ]);
}

function buildClankerDeployAnswer(
  result: Record<string, any>,
  locale: Locale,
): string | null {
  const tokenAddress = pick(result, ["tokenAddress", "token_address"]);
  const tokenUrl = pick(result, ["tokenUrl", "token_url"]);
  const tokenExplorerUrl = pick(result, ["tokenExplorerUrl", "token_explorer_url"]);
  const txHash = pick(result, ["txHash", "transactionHash", "hash"]);
  const explorerUrl = pick(result, ["explorerUrl", "txUrl", "tx_url"]);
  if (!tokenAddress && !tokenUrl && !txHash) return null;
  return compactLines([
    locale === "zh" ? "Clanker 代币已部署。" : "Clanker token deployed.",
    formatLine(locale, "代币地址", "Token address", tokenAddress),
    formatMarkdownLinkLine(locale, "Clanker 页面", "Clanker page", tokenUrl),
    formatLine(locale, "代币浏览器", "Token explorer", tokenExplorerUrl),
    txHash ? formatLine(locale, "部署交易", "Deployment transaction", txHash) : null,
    txHash || explorerUrl
      ? formatLine(locale, "交易浏览器", "Transaction explorer", explorerUrl)
      : null,
  ]);
}

function buildPolymarketOrderAnswer(
  toolName: string,
  result: Record<string, any>,
  locale: Locale,
): string | null {
  const orderId = pick(result, ["order_id", "orderId", "newOrderId"]);
  const replacedOrderId = pick(result, ["replaced_order_id", "replacedOrderId"]);
  const marketUrl = pick(result, ["market_url", "marketUrl"]);
  const marketSlug = pick(result, ["market_slug", "marketSlug"]);
  if (!orderId && !replacedOrderId) return null;
  return compactLines([
    polymarketOrderTitle(toolName, locale),
    replacedOrderId
      ? formatLine(locale, "被替换订单", "Replaced order", replacedOrderId)
      : null,
    formatLine(locale, "订单 ID", "Order ID", orderId),
    marketSlug ? formatLine(locale, "市场", "Market", marketSlug) : null,
    formatLine(locale, "市场链接", "Market URL", marketUrl),
  ]);
}

function buildCopyTradeConfigAnswer(
  toolName: string,
  result: Record<string, any>,
  locale: Locale,
): string | null {
  const id = pickDeep(result, ["id", "config_id", "configId"]);
  const targetWallet = pickDeep(result, ["targetWallet", "target_wallet"]);
  const targetUrl = pickDeep(result, ["targetWalletUrl", "target_url", "target_wallet_url"]);
  if (!id && !targetWallet && !targetUrl) return null;
  return compactLines([
    copyTradeTitle(toolName, locale),
    formatLine(locale, "配置 ID", "Config ID", id),
    targetWallet ? formatLine(locale, "目标钱包", "Target wallet", targetWallet) : null,
    formatLine(locale, "目标钱包链接", "Target wallet URL", targetUrl),
  ]);
}

function buildPolymarketCopyConfigAnswer(
  toolName: string,
  result: Record<string, any>,
  locale: Locale,
): string | null {
  const id = pickDeep(result, ["id", "config_id", "configId"]);
  const targetWallet = pickDeep(result, [
    "target_wallet_full",
    "target_wallet",
    "targetWallet",
  ]);
  const targetUrl = pickDeep(result, [
    "target_wallet_url",
    "targetWalletUrl",
    "target_url",
  ]);
  if (!id && !targetWallet && !targetUrl) return null;
  return compactLines([
    polymarketCopyTitle(toolName, locale),
    formatLine(locale, "配置 ID", "Config ID", id),
    targetWallet ? formatLine(locale, "目标钱包", "Target wallet", targetWallet) : null,
    formatLine(locale, "Polymarket 钱包", "Polymarket wallet", targetUrl),
  ]);
}

function buildTokenAlertAnswer(
  toolName: string,
  result: Record<string, any>,
  locale: Locale,
): string | null {
  const ruleId = pick(result, ["ruleId", "rule_id", "id"]);
  const tokenAddress = pick(result, ["tokenAddress", "token_address", "address"]);
  const tokenUrl = pick(result, ["tokenUrl", "token_url"]);
  if (!ruleId && !tokenAddress && !tokenUrl) return null;
  return compactLines([
    toolName === "remove_token_alert"
      ? locale === "zh"
        ? "Token alert 已删除。"
        : "Token alert removed."
      : locale === "zh"
        ? "Token alert 已创建。"
        : "Token alert created.",
    formatLine(locale, "规则 ID", "Rule ID", ruleId),
    tokenAddress ? formatLine(locale, "代币地址", "Token address", tokenAddress) : null,
    formatLine(locale, "代币链接", "Token URL", tokenUrl),
  ]);
}

function buildFailureDetailLines(
  toolName: string,
  result: Record<string, any>,
  locale: Locale,
): Array<string | null> {
  switch (toolName) {
    case "prepare_swap_transaction":
    case "execute_swap":
      return [
        formatOptionalLine(locale, "交易哈希", "Transaction hash", pick(result, ["txHash", "transactionHash", "hash"])),
        formatOptionalLine(locale, "浏览器", "Explorer", pick(result, ["explorerUrl", "explorer_url", "txUrl", "tx_url", "sourceExplorerUrl"])),
      ];
    case "prepare_cross_chain_tx":
      return [
        formatOptionalLine(locale, "交易哈希", "Transaction hash", pick(result, ["txHash", "transactionHash", "hash"])),
        formatOptionalLine(locale, "源链浏览器", "Source explorer", pick(result, ["sourceExplorerUrl", "explorerUrl", "explorer_url", "txUrl"])),
        formatOptionalLine(locale, "LI.FI 跟踪", "LI.FI tracker", pick(result, ["lifiExplorerUrl", "explorerLink", "lifiTrackerUrl"])),
      ];
    case "deploy_clanker_token":
      return [
        formatOptionalLine(locale, "代币地址", "Token address", pick(result, ["tokenAddress", "token_address"])),
        formatOptionalLine(locale, "Clanker 页面", "Clanker page", pick(result, ["tokenUrl", "token_url"])),
        formatOptionalLine(locale, "代币浏览器", "Token explorer", pick(result, ["tokenExplorerUrl", "token_explorer_url"])),
        formatOptionalLine(locale, "部署交易", "Deployment transaction", pick(result, ["txHash", "transactionHash", "hash"])),
        formatOptionalLine(locale, "交易浏览器", "Transaction explorer", pick(result, ["explorerUrl", "txUrl", "tx_url"])),
      ];
    case "place_polymarket_order":
    case "withdraw_polymarket_position":
    case "cancel_polymarket_order":
    case "modify_polymarket_order":
      return [
        formatOptionalLine(locale, "被替换订单", "Replaced order", pick(result, ["replaced_order_id", "replacedOrderId"])),
        formatOptionalLine(locale, "订单 ID", "Order ID", pick(result, ["order_id", "orderId", "newOrderId"])),
        formatOptionalLine(locale, "市场", "Market", pick(result, ["market_slug", "marketSlug"])),
        formatOptionalLine(locale, "市场链接", "Market URL", pick(result, ["market_url", "marketUrl"])),
      ];
    case "create_copy_trade_config":
    case "delete_copy_trade_config":
    case "pause_copy_trade_config":
      return [
        formatOptionalLine(locale, "配置 ID", "Config ID", pickDeep(result, ["id", "config_id", "configId"])),
        formatOptionalLine(locale, "目标钱包", "Target wallet", pickDeep(result, ["targetWallet", "target_wallet"])),
        formatOptionalLine(locale, "目标钱包链接", "Target wallet URL", pickDeep(result, ["targetWalletUrl", "target_url", "target_wallet_url"])),
      ];
    case "create_polymarket_copy_config":
    case "update_polymarket_copy_config":
    case "delete_polymarket_copy_config":
      return [
        formatOptionalLine(locale, "配置 ID", "Config ID", pickDeep(result, ["id", "config_id", "configId"])),
        formatOptionalLine(locale, "目标钱包", "Target wallet", pickDeep(result, ["target_wallet_full", "target_wallet", "targetWallet"])),
        formatOptionalLine(locale, "Polymarket 钱包", "Polymarket wallet", pickDeep(result, ["target_wallet_url", "targetWalletUrl", "target_url"])),
      ];
    case "set_token_alert":
    case "remove_token_alert":
      return [
        formatOptionalLine(locale, "规则 ID", "Rule ID", pick(result, ["ruleId", "rule_id", "id"])),
        formatOptionalLine(locale, "代币地址", "Token address", pick(result, ["tokenAddress", "token_address", "address"])),
        formatOptionalLine(locale, "代币链接", "Token URL", pick(result, ["tokenUrl", "token_url"])),
      ];
    default:
      return [];
  }
}

function polymarketOrderTitle(toolName: string, locale: Locale): string {
  if (locale !== "zh") {
    if (toolName === "modify_polymarket_order") return "Polymarket order replaced.";
    if (toolName === "cancel_polymarket_order") return "Polymarket order cancelled.";
    if (toolName === "withdraw_polymarket_position") return "Polymarket close order placed.";
    return "Polymarket order placed.";
  }
  if (toolName === "modify_polymarket_order") return "Polymarket 订单已替换。";
  if (toolName === "cancel_polymarket_order") return "Polymarket 订单已取消。";
  if (toolName === "withdraw_polymarket_position") return "Polymarket 平仓订单已提交。";
  return "Polymarket 订单已提交。";
}

function failureTitle(toolName: string, locale: Locale): string {
  const zh = locale === "zh";
  switch (toolName) {
    case "prepare_swap_transaction":
    case "execute_swap":
      return zh ? "Swap 执行失败。" : "Swap failed.";
    case "prepare_cross_chain_tx":
      return zh ? "跨链交易执行失败。" : "Cross-chain transaction failed.";
    case "deploy_clanker_token":
      return zh ? "Clanker 代币部署失败。" : "Clanker token deployment failed.";
    case "place_polymarket_order":
      return zh ? "Polymarket 订单提交失败。" : "Polymarket order failed.";
    case "withdraw_polymarket_position":
      return zh ? "Polymarket 平仓提交失败。" : "Polymarket close order failed.";
    case "cancel_polymarket_order":
      return zh ? "Polymarket 订单取消失败。" : "Polymarket order cancellation failed.";
    case "modify_polymarket_order":
      return zh ? "Polymarket 订单修改失败。" : "Polymarket order modification failed.";
    case "create_copy_trade_config":
      return zh ? "Copy trade 配置创建失败。" : "Copy-trade config creation failed.";
    case "delete_copy_trade_config":
      return zh ? "Copy trade 配置删除失败。" : "Copy-trade config deletion failed.";
    case "pause_copy_trade_config":
      return zh ? "Copy trade 配置更新失败。" : "Copy-trade config update failed.";
    case "create_polymarket_copy_config":
      return zh ? "Polymarket 跟单配置创建失败。" : "Polymarket copy config creation failed.";
    case "update_polymarket_copy_config":
      return zh ? "Polymarket 跟单配置更新失败。" : "Polymarket copy config update failed.";
    case "delete_polymarket_copy_config":
      return zh ? "Polymarket 跟单配置删除失败。" : "Polymarket copy config deletion failed.";
    case "set_token_alert":
      return zh ? "Token alert 创建失败。" : "Token alert creation failed.";
    case "remove_token_alert":
      return zh ? "Token alert 删除失败。" : "Token alert removal failed.";
    default:
      return zh ? "执行失败。" : "Execution failed.";
  }
}

function copyTradeTitle(toolName: string, locale: Locale): string {
  if (locale !== "zh") {
    if (toolName === "delete_copy_trade_config") return "Copy-trade config deleted.";
    if (toolName === "pause_copy_trade_config") return "Copy-trade config updated.";
    return "Copy-trade config created.";
  }
  if (toolName === "delete_copy_trade_config") return "Copy trade 配置已删除。";
  if (toolName === "pause_copy_trade_config") return "Copy trade 配置已更新。";
  return "Copy trade 配置已创建。";
}

function polymarketCopyTitle(toolName: string, locale: Locale): string {
  if (locale !== "zh") {
    if (toolName === "delete_polymarket_copy_config") return "Polymarket copy config deleted.";
    if (toolName === "update_polymarket_copy_config") return "Polymarket copy config updated.";
    return "Polymarket copy config created.";
  }
  if (toolName === "delete_polymarket_copy_config") return "Polymarket 跟单配置已删除。";
  if (toolName === "update_polymarket_copy_config") return "Polymarket 跟单配置已更新。";
  return "Polymarket 跟单配置已创建。";
}

function formatLine(
  locale: Locale,
  zhLabel: string,
  enLabel: string,
  value: string | null,
): string {
  const label = locale === "zh" ? zhLabel : enLabel;
  const fallback = locale === "zh" ? "不可用" : "unavailable";
  return `${label}: ${value || fallback}`;
}

function formatOptionalLine(
  locale: Locale,
  zhLabel: string,
  enLabel: string,
  value: string | null,
): string | null {
  return value ? formatLine(locale, zhLabel, enLabel, value) : null;
}

function formatMarkdownLinkLine(
  locale: Locale,
  zhLabel: string,
  enLabel: string,
  url: string | null,
): string | null {
  if (!url) return null;
  const label = locale === "zh" ? zhLabel : enLabel;
  const linkText = locale === "zh" ? "打开链接" : "Open link";
  return `${label}: [${linkText}](${url})`;
}

function compactLines(lines: Array<string | null | undefined>): string {
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

function pick(source: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = normalizeString(source[key]);
    if (value) return value;
  }
  const data = asRecord(source.data);
  if (data) {
    for (const key of keys) {
      const value = normalizeString(data[key]);
      if (value) return value;
    }
  }
  return null;
}

function pickDeep(source: Record<string, any>, keys: string[]): string | null {
  const direct = pick(source, keys);
  if (direct) return direct;
  for (const branch of ["config", "existing_config", "deleted_config"]) {
    const nested = asRecord(source[branch]);
    if (!nested) continue;
    const value = pick(nested, keys);
    if (value) return value;
  }
  return null;
}

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

function objectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).slice(0, 32);
}
