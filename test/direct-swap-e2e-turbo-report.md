# Direct Swap E2E — Turbo 耗时与失败用例记录

RPC: BASE_RPC_URL=base.drpc.org, BSC_RPC_URL=bsc-rpc.publicnode.com, ETH_RPC_URL=ethereum-rpc.publicnode.com

---

## Run 1 — 2026-02-20 (单次完整 run)

### Turbo 相关耗时

| 用例 | 结果 | 用例耗时 (duration_ms) | 内部 durationMs | timelineMs (poolDiscovery / execution) |
|------|------|------------------------|-----------------|----------------------------------------|
| [base] executeDirectSwap **turbo** WETH→USDC | **FAIL** | 4.9 | 2 | poolDiscovery=null (cached) |
| [base] executeDirectSwap with **real tx hint** (turbo) | **PASS** | **1064.95** | **1060** | poolDiscovery=null, execution≈1060 (turbo fast path) |
| [base] executeDirectSwap balanced WETH→USDC | FAIL | 17275 | 17265 | poolDiscovery=6465, execution=null |

### 失败用例 (4)

| # | 用例名 | 失败原因 | 用例耗时 |
|---|--------|----------|----------|
| 8 | [base] executeDirectSwap balanced WETH→USDC | success=false, failureCode=failed_pool_unavailable_hard, referenceQuote 过大导致 no strategy matched threshold | 17275 ms |
| 9 | [base] executeDirectSwap **turbo** WETH→USDC | success=false (cached: 同 8 的 no-pool 结果复用) | 4.9 ms |
| 10 | [base] executeDirectSwap with hint preferredStrategy v3 | success=false (cached) | 2.2 ms |
| 11 | [bsc] executeDirectSwap WBNB→USDT | success=false, provider=failed, durationMs=9395 (strategy evaluation 未选中) | 9396 ms |

### 通过的 executeDirectSwap 用例

- [eth] executeDirectSwap WETH→USDC: **5927 ms** (balanced), provider=uniswap-v3
- [base] executeDirectSwap tiny amount (1 wei): **7066 ms** (balanced), provider=uniswap-v3
- [base] executeDirectSwap with real tx hint: **1060 ms** (turbo), provider=uniswap-v4

---

## Run 2 — 2026-02-20

### Turbo 相关耗时

| 用例 | 结果 | 用例耗时 (duration_ms) | 内部 durationMs | 说明 |
|------|------|------------------------|-----------------|------|
| [base] executeDirectSwap **turbo** WETH→USDC | **FAIL** | 3.4 | 2 | cached（同 Run 1） |
| [base] executeDirectSwap with **real tx hint** (turbo) | **PASS** | **952.14** | **950** | turbo fast path，无 poolDiscovery |
| [base] executeDirectSwap balanced WETH→USDC | FAIL | 13555 | 13550 | poolDiscovery=6588 |

### 失败用例 (4，与 Run 1 一致)

| # | 用例名 | 失败原因 | Run 2 耗时 |
|---|--------|----------|-----------|
| 8 | [base] executeDirectSwap balanced WETH→USDC | failed_pool_unavailable_hard, no strategy matched threshold | 13555 ms |
| 9 | [base] executeDirectSwap **turbo** WETH→USDC | cached failure（无 sourceTxHint 时 turbo 仍走 cache） | 3.4 ms |
| 10 | [base] executeDirectSwap with hint preferredStrategy v3 | cached failure | 2.2 ms |
| 11 | [bsc] executeDirectSwap WBNB→USDT | provider=failed（strategy 未选中） | ~9s 量级 |

### 通过的 executeDirectSwap (Run 2)

- [eth] WETH→USDC: ~6s, uniswap-v3
- [base] tiny amount (1 wei): **10684 ms**, uniswap-v3
- [base] **real tx hint (turbo)**: **950 ms**, uniswap-v4

---

## 汇总

### Turbo 耗时（成功路径）

| 场景 | Run 1 (ms) | Run 2 (ms) |
|------|------------|------------|
| [base] executeDirectSwap with **real tx hint** (turbo) | **1060** | **950** |

结论：带 `sourceTxHash` hint 的 turbo 路径稳定在 **~1s 内**（无 pool discovery，直接 V4 执行）。

### 稳定失败用例（4 个）

1. **[base] executeDirectSwap balanced WETH→USDC** — 1 WETH 大额，Gecko reference 数值异常放大 → minReasonable 过高 → 所有 strategy 不达标。
2. **[base] executeDirectSwap turbo WETH→USDC** — 无 hint 时复用上一条的 no-pool cache，立即失败。
3. **[base] executeDirectSwap with hint preferredStrategy v3** — 同上，cache 导致未真正跑 v3。
4. **[bsc] executeDirectSwap WBNB→USDT** — 1 BNB 大额，reference quote / 策略选择导致 provider=failed。
