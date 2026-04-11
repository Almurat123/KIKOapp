# 2026-04-11 DirectSwap V4 Hook Provenance Audit

## What Changed

- 给 DirectSwap 的 v4 hook owner 文件补了 `CONTEXT MEMORY`。
- 重写了 `v4Hooks.ts` 的地址来源注释，分开：
  - Uniswap 官方协议事实
  - 第三方公开文档已证实
  - 运行时观察值
- 去掉了 `0xbb7784...` 在 `doppler` 和 `custom` 之间的重复归类。
- 把 `v4HookCapabilities.ts` 里的 `custom` 从静态 `supported_safe` 改成 `probe_only`。
- 更新了 `uniswapV4Swap.ts` 的 v4 action 表注释，使其与当前官方 `Actions.sol` 同步。
- 把 `uniswapV4Swap.ts` 里的 Ethereum Universal Router 注释从“需验证”改成已验证。
- 把 `uniswapV4Swap.ts` 里的“官方已部署地址表”和“当前已启用执行边界”拆开。
  现在 BSC / Arbitrum / Optimism 的官方部署地址会被保留，但不会因为地址表补全而自动打开下单支持。
- 给 `directSwap/constants.ts` 补了 owner 层 `CONTEXT MEMORY`，把产品支持链、
  默认策略优先级和官方 v4 只读地址映射收拢到同一条可见边界里。

## Why

之前仓库把多种证据源混在一起：

- 有些内容来自 Uniswap 官方文档
- 有些内容来自第三方供应商文档
- 有些内容只是从 Base 生产交易里看到

这样会让后续模型或开发者误以为：

- 所有登记地址都被公开文档证实
- 所有已收录家族都可以静态安全放行
- 只要某条链存在官方 Universal Router 部署，KiKo 就已经准备好在该链上做 v4 实盘执行

这三个结论都不成立。

## Target Behavior

- 任何人打开 owner 文件，都能知道某个 hook 地址为什么在表里。
- 第三方文档缺口不再被伪装成“官方真相”。
- 没有强 provenance 的 custom hook，先 probe，再决定是否可执行。
- upstream deployment 与产品 enablement 的边界保持显式分离。
- 默认策略排序和产品支持链不再只是隐式常量，而是 owner 层规则。

## Guardrail

- 不要把生产观察值升级成“官方地址”而不写来源。
- 不要把 `custom` 家族重新静态标成 `supported_safe`，除非新增了可复核来源。
- 不要让同一个 hook 地址同时属于多个家族。
- 不要把更宽的 PoolKey 搜索窗口写成 Uniswap 官方完整参数表。

## Document Provenance

- Source: Uniswap v4 deployments
- Kind: official API doc
- Retrieved: 2026-04-11
- Applied To: `StateView`、官方 `Universal Router` 部署表，以及 DirectSwap 启用边界拆分
- Verification: verified in docs

- Source: Uniswap `IHooks.sol`, `Hooks.sol`
- Kind: official API doc
- Retrieved: 2026-04-11
- Applied To: hook 位定义未发生破坏 DirectSwap 的接口级刷新
- Verification: verified in code

- Source: Uniswap `Actions.sol`, `V4Router.sol`
- Kind: official API doc
- Retrieved: 2026-04-11
- Applied To: DirectSwap v4 动作码表与 router 支持动作子集
- Verification: verified in code

- Source: Clanker v4 reference and deployed contracts
- Kind: product doc
- Retrieved: 2026-04-11
- Applied To: Base 上 Clanker v4.0 / v4.1 hook 地址
- Verification: verified in docs

- Source: Doppler Hooks
- Kind: product doc
- Retrieved: 2026-04-11
- Applied To: `setHook`、`onSwap`、`onGraduation` 与动态 fee 约束
- Verification: verified in docs

- Source: Flaunch contract-addresses page
- Kind: product doc
- Retrieved: 2026-04-11
- Applied To: 识别当前公开文档存在地址抓取缺口，不能把本地表直接标成文档已证实
- Verification: partially verified

- Source: Base production swap traffic sampled by DirectSwap diagnostics
- Kind: runtime observation
- Retrieved: 2026-04-11
- Applied To: 保留 `0x7debe...`、`0x23321...` 等运行时观察地址
- Verification: partially verified
