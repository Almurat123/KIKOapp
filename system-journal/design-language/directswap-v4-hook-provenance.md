# DirectSwap V4 Hook Provenance

Updated: 2026-04-11

## Purpose

DirectSwap 的 v4 hook 集成同时依赖三类信息源：

- Uniswap 官方协议与 periphery 文档
- 第三方协议的公开文档
- 生产交易与预模拟里的运行时观察

这三类来源不能再混写成同一种“已确认事实”。

## Canonical Rules

- 协议层事实只来自 Uniswap 官方文档或官方源码。
- 第三方 hook 地址只有在供应商公开文档可复核时，才能标成文档已证实。
- 仅从生产交易、日志或预模拟看到的地址，必须标成运行时观察。
- capability 判定与 provenance 判定分离。
  capability 说的是“当前仓库怎么处理它”。
  provenance 说的是“我们为什么相信这个地址属于这个家族”。
- 同一个 hook 地址不能同时落在多个家族。
- 发现式搜索窗口可以比官方文档更宽，但必须明确它是启发式兼容，不是协议规范。

## Forbidden Patch Patterns

- 不要把“观察到的地址”改注释成“官方地址”。
- 不要因为某个 hook 家族已经接入，就默认该家族下所有地址都 `supported_safe`。
- 不要在没有文档或运行时证据的情况下新增第三方 hook 地址。
- 不要把 DirectSwap 的执行适配注释成 Uniswap 官方保证。

## Owner Boundaries

- `kiko-api/src/services/dex/v4Hooks.ts`
  - owns: 地址登记、家族归类、静态 hookData 候选
  - does not own: 执行期 capability 和 probe 结论
- `kiko-api/src/services/dex/v4HookCapabilities.ts`
  - owns: capability、probe、unknown/custom hook 的降级路径
  - does not own: 地址发布真相
- `kiko-api/src/services/dex/uniswapV4.ts`
  - owns: 官方 StateView 部署地址、PoolId 发现、启发式搜索窗口
  - does not own: 第三方 hook 正式发布状态
- `kiko-api/src/services/dex/uniswapV4Swap.ts`
  - owns: Universal Router 编码和当前仓库启用的路由器地址
  - does not own: 哪些链必须被 DirectSwap 打开

## Document Provenance

- Source: Uniswap v4 deployments
- Kind: official API doc
- Retrieved: 2026-04-11
- Applied To: StateView / Universal Router / Quoter 官方部署地址边界
- Verification: verified in docs

- Source: Uniswap `IHooks.sol`, `Hooks.sol`, `Actions.sol`, `V4Router.sol`
- Kind: official API doc
- Retrieved: 2026-04-11
- Applied To: hook 位定义、action ids、router 支持动作子集
- Verification: verified in code

- Source: Clanker v4 reference and deployed contracts
- Kind: product doc
- Retrieved: 2026-04-11
- Applied To: Clanker v4.0 / v4.1 hook 地址归因
- Verification: verified in docs

- Source: Doppler Hooks
- Kind: product doc
- Retrieved: 2026-04-11
- Applied To: `setHook`、`onSwap`、动态 fee 边界
- Verification: verified in docs

- Source: DirectSwap production observations on Base
- Kind: runtime observation
- Retrieved: 2026-04-11
- Applied To: 供应商文档缺口下保留的 hook 地址
- Verification: partially verified
