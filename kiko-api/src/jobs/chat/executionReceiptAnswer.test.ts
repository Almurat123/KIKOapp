import assert from "node:assert/strict";
import { test } from "node:test";
import { buildExecutionReceiptAnswer, buildExecutionReceiptDecision } from "./executionReceiptAnswer.js";

test("buildExecutionReceiptAnswer formats transaction receipts without a model round", () => {
  const answer = buildExecutionReceiptAnswer(
    {
      id: "call-1",
      name: "prepare_swap_transaction",
      arguments: {},
      ok: true,
      result: {
        txHash: "0xabc123",
        explorerUrl: "https://basescan.org/tx/0xabc123",
      },
    },
    "zh",
  );

  assert.equal(
    answer,
    [
      "Swap 已提交。",
      "交易哈希: 0xabc123",
      "浏览器: https://basescan.org/tx/0xabc123",
    ].join("\n"),
  );
});

test("buildExecutionReceiptAnswer reports missing market URL instead of inventing one", () => {
  const answer = buildExecutionReceiptAnswer(
    {
      id: "call-2",
      name: "modify_polymarket_order",
      arguments: {},
      ok: true,
      result: {
        order_id: "new-order",
        replaced_order_id: "old-order",
      },
    },
    "zh",
  );

  assert.match(answer || "", /被替换订单: old-order/);
  assert.match(answer || "", /订单 ID: new-order/);
  assert.match(answer || "", /市场链接: 不可用/);
});

test("buildExecutionReceiptAnswer skips confirmation checkpoints", () => {
  const answer = buildExecutionReceiptAnswer(
    {
      id: "call-3",
      name: "prepare_swap_transaction",
      arguments: {},
      ok: true,
      result: {
        requires_confirmation: true,
        txHash: "0xshould-not-render",
      },
    },
    "zh",
  );

  assert.equal(answer, null);
});

test("buildExecutionReceiptAnswer formats nested config receipts", () => {
  const answer = buildExecutionReceiptAnswer(
    {
      id: "call-4",
      name: "create_polymarket_copy_config",
      arguments: {},
      ok: true,
      result: {
        success: true,
        config: {
          id: "cfg-1",
          target_wallet_full: "0x1111111111111111111111111111111111111111",
          target_wallet_url:
            "https://polymarket.com/profile/0x1111111111111111111111111111111111111111",
        },
      },
    },
    "zh",
  );

  assert.match(answer || "", /配置 ID: cfg-1/);
  assert.match(answer || "", /Polymarket 钱包: https:\/\/polymarket.com\/profile\/0x111/);
});

test("buildExecutionReceiptDecision formats failed deploy receipts without another model round", () => {
  const decision = buildExecutionReceiptDecision(
    {
      id: "call-5",
      name: "deploy_clanker_token",
      arguments: {},
      ok: false,
      error: "wallet signature rejected",
      reasonCode: "USER_REJECTED",
      result: {
        tokenAddress: "0xabc",
        tokenUrl: "https://clanker.world/clanker/0xabc",
      },
    },
    "zh",
  );

  assert.equal(decision.reason, "built_failure");
  assert.equal(
    decision.answer,
    [
      "Clanker 代币部署失败。",
      "错误: wallet signature rejected",
      "原因代码: USER_REJECTED",
      "代币地址: 0xabc",
      "Clanker 页面: https://clanker.world/clanker/0xabc",
    ].join("\n"),
  );
});

test("buildExecutionReceiptAnswer embeds the Clanker page as a clickable link", () => {
  const answer = buildExecutionReceiptAnswer(
    {
      id: "call-6",
      name: "deploy_clanker_token",
      arguments: {},
      ok: true,
      result: {
        tokenAddress: "0xabc",
        tokenUrl: "https://clanker.world/clanker/0xabc",
      },
    },
    "zh",
  );

  assert.match(answer || "", /Clanker 页面: \[打开链接\]\(https:\/\/clanker\.world\/clanker\/0xabc\)/);
});

test("buildExecutionReceiptAnswer formats Four.meme deploy receipts", () => {
  const answer = buildExecutionReceiptAnswer(
    {
      id: "call-7",
      name: "deploy_fourmeme_token",
      arguments: {},
      ok: true,
      result: {
        tokenAddress: "0xabc",
        tokenUrl: "https://four.meme/token/0xabc",
        txHash: "0xdef",
        txUrl: "https://bscscan.com/tx/0xdef",
      },
    },
    "zh",
  );

  assert.equal(
    answer,
    [
      "Four.meme 代币部署已提交。",
      "代币地址: 0xabc",
      "Four.meme 页面: [打开链接](https://four.meme/token/0xabc)",
      "部署交易: 0xdef",
      "交易浏览器: https://bscscan.com/tx/0xdef",
    ].join("\n"),
  );
});
