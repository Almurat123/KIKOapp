import type { CopytradeLifecycleState, CopytradeReasonCode } from '../contracts/lifecycle.js';
import type { CtIssueDefinition, CtIssueFlow, CtIssueId } from './ct136Types.js';

interface ClusterSpec {
  from: number;
  to: number;
  flow: CtIssueFlow;
  theme: string;
  fault: string;
  invariant: string;
  reasonCodes: CopytradeReasonCode[];
  lifecycleStates: CopytradeLifecycleState[];
  trigger: string;
  expected: string;
  probe: string;
  crossLinks: number[];
}

function ctId(n: number): CtIssueId {
  return `CT-${String(n).padStart(3, '0')}`;
}

function uniqueIds(ids: CtIssueId[]): CtIssueId[] {
  return [...new Set(ids)];
}

function buildCluster(spec: ClusterSpec): CtIssueDefinition[] {
  const rows: CtIssueDefinition[] = [];
  for (let idx = spec.from; idx <= spec.to; idx += 1) {
    const localNo = idx - spec.from + 1;
    const links: CtIssueId[] = [];
    if (idx > spec.from) links.push(ctId(idx - 1));
    if (idx < spec.to) links.push(ctId(idx + 1));
    for (const link of spec.crossLinks) {
      links.push(ctId(link));
    }

    rows.push({
      id: ctId(idx),
      flow: spec.flow,
      modeScope: 'turbo/normal/safety',
      title: `${spec.theme} #${localNo}`,
      fault: spec.fault,
      invariant: spec.invariant,
      reasonCodes: spec.reasonCodes,
      lifecycleStates: spec.lifecycleStates,
      reproduction: {
        trigger: `${spec.trigger} (case ${ctId(idx)})`,
        expected: spec.expected,
        probe: `${spec.probe}; verify link to ${ctId(idx)} and cross-flow edges`,
      },
      relatedIds: uniqueIds(links),
    });
  }
  return rows;
}

const CLUSTERS: ClusterSpec[] = [
  {
    from: 1,
    to: 6,
    flow: 'order-flow',
    theme: 'Ingress Identity & Dedup Race',
    fault: '相同信号在 webhook/pending/tx-state 并发入口下被重复接单或丢失身份字段。',
    invariant: '同一 chainId+txHash+targetWallet 只能生成一个订单聚合且身份字段必须完整。',
    reasonCodes: ['ok_detected', 'ingress_deduped', 'ingress_missing_identity', 'ingress_invalid_swap'],
    lifecycleStates: ['DETECTED', 'FAILED_TERMINAL'],
    trigger: '并发注入同 txHash 的 TARGET_BUY 信号并随机打乱 targetWallet 大小写',
    expected: '仅一单进入 DETECTED，重复信号被标记 deduped，缺失身份直接 terminal',
    probe: '检查 copytrade_orders 唯一键 + copytrade_order_events 中 REJECTED/INGRESS_DEDUPED',
    crossLinks: [47, 93],
  },
  {
    from: 7,
    to: 12,
    flow: 'order-flow',
    theme: 'Validation Guard Matrix',
    fault: '低置信度、方向冲突、不可路由信号未在统一验证口被截断。',
    invariant: '验证失败只能进入 DEFERRED/QUARANTINED/FAILED_TERMINAL，不得直接下单。',
    reasonCodes: ['ok_validated', 'validation_low_confidence', 'validation_direction_conflict', 'validation_unroutable'],
    lifecycleStates: ['VALIDATED', 'DEFERRED', 'QUARANTINED', 'FAILED_TERMINAL'],
    trigger: '构造 tokenIn/tokenOut 冲突与低置信度组合输入并切换三模式',
    expected: 'turbo/normal/safety 走同一接口但分叉到不同 reasonCode',
    probe: '检查状态机迁移 + reasonCode 不出现裸 return/null',
    crossLinks: [53, 99],
  },
  {
    from: 13,
    to: 18,
    flow: 'order-flow',
    theme: 'Buy Submission Atomicity',
    fault: 'BUY_SUBMITTING 阶段执行意图和状态推进可能不一致。',
    invariant: '先状态推进后执行记录，失败必须回写 retryable/terminal，不允许无结果悬挂。',
    reasonCodes: ['ok_buy_submitted', 'failed_retryable', 'failed_terminal', 'trading_execution_failed'],
    lifecycleStates: ['BUY_SUBMITTING', 'FAILED_RETRYABLE', 'FAILED_TERMINAL'],
    trigger: '注入 execute() 网络超时、nonce 冲突、签名失败三类故障',
    expected: '所有失败都能绑定失败类型并进入统一失败分支',
    probe: '检查 executionRecorder attemptNo 连续与状态机一致',
    crossLinks: [59, 105],
  },
  {
    from: 19,
    to: 24,
    flow: 'order-flow',
    theme: 'Buy Acceptance/Confirmation Race',
    fault: 'accepted/submitted/confirmed 信号混序导致重复开仓或遗漏开仓确认。',
    invariant: 'BUY_ACCEPTED -> BUY_CONFIRMED_OPEN 只能单向推进，确认中断必须可 defer。',
    reasonCodes: ['ok_buy_accepted', 'ok_buy_confirmed_open', 'deferred_confirmation_pending', 'deferred_retry_later'],
    lifecycleStates: ['BUY_ACCEPTED', 'BUY_CONFIRMED_OPEN', 'DEFERRED'],
    trigger: '模拟先收到 confirmed 再收到 accepted 的乱序回执',
    expected: '乱序回执不破坏最终状态且不触发重复 BUY_CONFIRM_OPEN',
    probe: '检查事件流中 BUY_ACCEPT 与 BUY_CONFIRM_OPEN 次数上限为 1',
    crossLinks: [71, 111],
  },
  {
    from: 25,
    to: 30,
    flow: 'order-flow',
    theme: 'Exit Arming Consistency',
    fault: '买入已确认后 EXIT_ARMED 标记不稳定，导致后续卖出丢失。',
    invariant: '任何可卖订单必须可重放恢复到 EXIT_ARMED，且风控封禁需明确 reasonCode。',
    reasonCodes: ['ok_exit_armed', 'quarantined_policy', 'quarantine_direction_conflict', 'deferred_retry_later'],
    lifecycleStates: ['EXIT_ARMED', 'QUARANTINED', 'DEFERRED'],
    trigger: '在 target full exit 与 buy confirm 并发场景反复重放事件',
    expected: '订单最终可进入 EXIT_ARMED 或被可解释地 quarantine/defer',
    probe: '检查 lifecycle + reasonCode 是否可审计回放',
    crossLinks: [83, 123],
  },
  {
    from: 31,
    to: 36,
    flow: 'order-flow',
    theme: 'Exit Submit/Accept Handshake',
    fault: '卖出提交与受理阶段缺少统一握手，出现提交成功但业务状态未推进。',
    invariant: 'EXIT_SUBMITTING -> EXIT_ACCEPTED 必须由 execution outcome 驱动且可追踪。',
    reasonCodes: ['ok_exit_submitted', 'ok_exit_accepted', 'trading_execution_uncertain', 'failed_retryable'],
    lifecycleStates: ['EXIT_SUBMITTING', 'EXIT_ACCEPTED', 'FAILED_RETRYABLE'],
    trigger: '注入 txHash 可见但确认不确定的卖出回执',
    expected: '进入 EXIT_ACCEPTED 或 FAILED_RETRYABLE，不得停留无原因中间态',
    probe: '检查 copytrade_order_executions 与 lifecycle event 对齐',
    crossLinks: [65, 105],
  },
  {
    from: 37,
    to: 42,
    flow: 'order-flow',
    theme: 'Retry Budget & Re-entry',
    fault: '重试预算、重入状态和调度时间可能脱节。',
    invariant: 'retryCount 单调递增，超过预算必须 terminal，未超预算必须产生 schedule 记录。',
    reasonCodes: ['failed_retryable', 'ok_retry_scheduled', 'failed_retry_budget_exhausted', 'deferred_retry_later'],
    lifecycleStates: ['FAILED_RETRYABLE', 'FAILED_TERMINAL', 'VALIDATED'],
    trigger: '连续制造 retryable 失败直到超过 maxRetries',
    expected: '前 N 次 retryable + schedule，最后一次 terminal + budget_exhausted',
    probe: '检查 retry scheduler 与 order retryCount 一致性',
    crossLinks: [117, 133],
  },
  {
    from: 43,
    to: 46,
    flow: 'order-flow',
    theme: 'State Transition Integrity',
    fault: '非法状态迁移被静默吞掉或无标准错误码。',
    invariant: '非法迁移必须记录 invalid_transition，并保持当前状态不变。',
    reasonCodes: ['invalid_transition', 'failed_terminal', 'ok_exit_confirmed_closed'],
    lifecycleStates: ['EXIT_CONFIRMED_CLOSED', 'FAILED_TERMINAL', 'DETECTED'],
    trigger: '主动触发 DETECTED->EXIT_SUBMIT 等非法跳转',
    expected: '状态不变且写入 REJECTED_ 事件与 invalid_transition reasonCode',
    probe: '检查事件落盘和 observability invalid_transition 指标',
    crossLinks: [89, 99],
  },
  {
    from: 47,
    to: 52,
    flow: 'trading-flow',
    theme: 'Route Selection Determinism',
    fault: '路由选择在同输入下不稳定，导致结果不可复现。',
    invariant: '同一模式/同一输入输出路由必须确定或显式记载随机因子。',
    reasonCodes: ['validation_unroutable', 'trading_execution_failed', 'failed_terminal'],
    lifecycleStates: ['VALIDATED', 'BUY_SUBMITTING', 'EXIT_SUBMITTING'],
    trigger: '固定输入重复报价 100 次并比较 route hash',
    expected: '稳定命中同一策略或明确 fallback 链路',
    probe: '检查 outcome.metadata.provider 与 route 轨迹',
    crossLinks: [7, 93],
  },
  {
    from: 53,
    to: 58,
    flow: 'trading-flow',
    theme: 'Quote Freshness & Slippage Windows',
    fault: '报价过期和滑点窗口错配导致成交与预期偏离。',
    invariant: '执行前必须校验 quote freshness 与 mode-specific slippage policy。',
    reasonCodes: ['trading_execution_failed', 'failed_terminal', 'deferred_retry_later'],
    lifecycleStates: ['BUY_SUBMITTING', 'EXIT_SUBMITTING', 'DEFERRED'],
    trigger: '模拟 quote 延迟与链上价格跳变',
    expected: '过期报价触发 retry/defer/terminal，不得假成功',
    probe: '检查 reasonCode 与 quote timestamp 审计字段',
    crossLinks: [8, 123],
  },
  {
    from: 59,
    to: 64,
    flow: 'trading-flow',
    theme: 'Tx Build/Sign Broadcast Contract',
    fault: '构建、签名、广播步骤错误被归并为模糊错误，难以追踪。',
    invariant: '构建/签名/广播失败必须分类，并保留可用于重放的最小上下文。',
    reasonCodes: ['trading_execution_failed', 'failed_terminal', 'ok_buy_submitted'],
    lifecycleStates: ['BUY_SUBMITTING', 'EXIT_SUBMITTING', 'FAILED_TERMINAL'],
    trigger: '分别注入 signer、nonce、gas 参数异常',
    expected: '错误分类可区分并映射到可重试/不可重试',
    probe: '检查 outcome.metadata.hint 与 reasonCode 绑定',
    crossLinks: [13, 105],
  },
  {
    from: 65,
    to: 70,
    flow: 'trading-flow',
    theme: 'Broadcast Visibility Gap',
    fault: '已广播交易在可见性窗口内被误判失败。',
    invariant: 'broadcasted_unseen/visible_pending 必须进入 submitted/accepted 语义。',
    reasonCodes: ['ok_buy_submitted', 'ok_exit_submitted', 'trading_execution_uncertain', 'ok_exit_accepted'],
    lifecycleStates: ['BUY_ACCEPTED', 'EXIT_ACCEPTED', 'DEFERRED'],
    trigger: '返回 txHash 但 RPC 查询短时不可见',
    expected: '订单保持可恢复中间态，不直接 terminal',
    probe: '检查 lifecycle 与 txLifecycleStatus 对齐',
    crossLinks: [31, 111],
  },
  {
    from: 71,
    to: 76,
    flow: 'trading-flow',
    theme: 'Confirmation Uncertainty Handling',
    fault: '确认不确定三态未闭环，导致开平仓状态漂移。',
    invariant: 'uncertain 必须进入 defer/retryable，且不可直接标记 confirmed_closed。',
    reasonCodes: ['trading_execution_uncertain', 'deferred_confirmation_pending', 'failed_retryable'],
    lifecycleStates: ['BUY_ACCEPTED', 'EXIT_ACCEPTED', 'FAILED_RETRYABLE', 'DEFERRED'],
    trigger: '模拟 success/uncertain/failed 混合回执序列',
    expected: '状态机可在 uncertain 下保持一致并允许后续重试',
    probe: '检查 uncertain 注入用例的最终状态一致性',
    crossLinks: [19, 117],
  },
  {
    from: 77,
    to: 82,
    flow: 'trading-flow',
    theme: 'Terminal Failure Taxonomy',
    fault: '不可恢复错误与可恢复错误边界不清，导致错误重试。',
    invariant: 'slippage/revert/allowance 等不可恢复错误必须 terminal。',
    reasonCodes: ['failed_terminal', 'trading_execution_failed', 'failed_retry_budget_exhausted'],
    lifecycleStates: ['FAILED_TERMINAL', 'FAILED_RETRYABLE'],
    trigger: '注入 slippage revert、allowance 不足、余额不足异常',
    expected: 'terminal 分类准确，不进入无意义重试循环',
    probe: '检查 errorClassifier hint 与 reasonCode 映射',
    crossLinks: [37, 123],
  },
  {
    from: 83,
    to: 88,
    flow: 'trading-flow',
    theme: 'Mode Degradation Chain',
    fault: 'Turbo->Normal->Safety 降级链路不一致，可能跳档或漏档。',
    invariant: '降级行为必须遵循统一策略接口，不允许散落 if 分支。',
    reasonCodes: ['quarantined_policy', 'deferred_retry_later', 'ok_retry_scheduled'],
    lifecycleStates: ['DEFERRED', 'QUARANTINED', 'FAILED_RETRYABLE'],
    trigger: '在高失败率场景强制触发 mode 降级',
    expected: '降级路径可追踪且每一步可复现',
    probe: '检查 mode policy 输出与执行 outcome 一致性',
    crossLinks: [25, 133],
  },
  {
    from: 89,
    to: 92,
    flow: 'trading-flow',
    theme: 'Trading Observability Contract',
    fault: '交易流关键字段缺失，导致无法对账或事后追责。',
    invariant: '每次执行必须携带 reasonCode、provider、attemptNo、CT 链接。',
    reasonCodes: ['trading_execution_uncertain', 'invalid_transition', 'failed_terminal'],
    lifecycleStates: ['BUY_SUBMITTING', 'EXIT_SUBMITTING', 'FAILED_TERMINAL'],
    trigger: '执行高并发买卖并随机注入 provider 异常',
    expected: '每条执行都可回溯到订单事件与CT编号',
    probe: '检查 copytrade_order_executions metadata 完整性',
    crossLinks: [43, 136],
  },
  {
    from: 93,
    to: 98,
    flow: 'data-flow',
    theme: 'Aggregate Truth Source',
    fault: '订单聚合真相表与旧字段投影不一致。',
    invariant: 'copytrade_orders 是唯一写真相源，其他均为派生投影。',
    reasonCodes: ['ok_detected', 'ok_validated', 'ingress_deduped'],
    lifecycleStates: ['DETECTED', 'VALIDATED'],
    trigger: '迁移后对同订单进行多入口重复写入压测',
    expected: '聚合表单真相稳定，不出现双写冲突',
    probe: '核对主表与事件表键一致与版本推进',
    crossLinks: [1, 47],
  },
  {
    from: 99,
    to: 104,
    flow: 'data-flow',
    theme: 'Event Ordering & Idempotency',
    fault: '事件乱序或重复写入导致投影状态倒退。',
    invariant: '事件追加必须幂等且顺序可重建，非法迁移必须可见。',
    reasonCodes: ['invalid_transition', 'ingress_deduped', 'ok_validated'],
    lifecycleStates: ['DETECTED', 'VALIDATED', 'FAILED_TERMINAL'],
    trigger: '并发发送重复事件与逆序事件',
    expected: '投影结果稳定且保留 reject 事件轨迹',
    probe: '检查 eventType 序列与 lifecycleState 单调性',
    crossLinks: [43, 71],
  },
  {
    from: 105,
    to: 110,
    flow: 'data-flow',
    theme: 'Execution Attempt Journal',
    fault: '执行尝试记录缺失导致 retry 与失败诊断失真。',
    invariant: '每次执行尝试必须落盘 attemptNo + status + reasonCode。',
    reasonCodes: ['trading_execution_failed', 'failed_retryable', 'failed_terminal', 'ok_exit_submitted'],
    lifecycleStates: ['BUY_SUBMITTING', 'EXIT_SUBMITTING', 'FAILED_RETRYABLE', 'FAILED_TERMINAL'],
    trigger: '制造连续失败并在中途重启服务',
    expected: '重启后 attemptNo 不中断且可继续追踪',
    probe: '检查 execution 表 attemptNo 连续与去重',
    crossLinks: [31, 59],
  },
  {
    from: 111,
    to: 116,
    flow: 'data-flow',
    theme: 'Projection Freshness',
    fault: '查询视图与事件流刷新延迟过高，误导运营决策。',
    invariant: '关键状态切换后查询视图需在 SLA 内可见。',
    reasonCodes: ['ok_buy_confirmed_open', 'ok_exit_confirmed_closed', 'ok_exit_accepted'],
    lifecycleStates: ['BUY_CONFIRMED_OPEN', 'EXIT_ACCEPTED', 'EXIT_CONFIRMED_CLOSED'],
    trigger: '执行买入到平仓全链路并实时查询视图',
    expected: '查询模型及时反映生命周期变化',
    probe: '对比 event createdAt 与 query updatedAt 延迟',
    crossLinks: [19, 65],
  },
  {
    from: 117,
    to: 122,
    flow: 'data-flow',
    theme: 'Retry Schedule Consistency',
    fault: '调度表、订单重试计数、事件流之间出现分叉。',
    invariant: 'retryCount、schedule、reasonCode 三者必须同源一致。',
    reasonCodes: ['ok_retry_scheduled', 'failed_retry_budget_exhausted', 'failed_retryable'],
    lifecycleStates: ['FAILED_RETRYABLE', 'FAILED_TERMINAL', 'VALIDATED'],
    trigger: '重复触发 retry 并插入 scheduler 异常',
    expected: '异常可恢复且不会产生幽灵重试任务',
    probe: '检查 retryScheduler 与订单状态闭环',
    crossLinks: [37, 71],
  },
  {
    from: 123,
    to: 128,
    flow: 'data-flow',
    theme: 'ReasonCode Lineage Audit',
    fault: 'reasonCode 在订单、事件、执行三表中断链。',
    invariant: '同一节点的 reasonCode 必须端到端可追踪并能映射 CT 编号。',
    reasonCodes: ['failed_terminal', 'failed_retryable', 'quarantine_direction_conflict', 'trading_execution_failed'],
    lifecycleStates: ['FAILED_RETRYABLE', 'FAILED_TERMINAL', 'QUARANTINED'],
    trigger: '在买卖失败和风控隔离混合场景下抽样审计',
    expected: '三表 reasonCode 与 CT issue 映射一致',
    probe: '执行 lineage 查询脚本比对表间一致性',
    crossLinks: [25, 77],
  },
  {
    from: 129,
    to: 132,
    flow: 'data-flow',
    theme: 'Migration Reconciliation',
    fault: 'legacy 迁移后账目与生命周期对不齐。',
    invariant: '迁移校验必须保证持仓、事件、执行尝试三维一致。',
    reasonCodes: ['ok_detected', 'ingress_deduped', 'ok_exit_confirmed_closed'],
    lifecycleStates: ['DETECTED', 'EXIT_CONFIRMED_CLOSED'],
    trigger: '执行全量迁移 + 校验脚本 + 随机抽样回放',
    expected: '迁移前后差异在阈值内并可解释',
    probe: '比对 validateCopytradeV2Migration 输出',
    crossLinks: [1, 111],
  },
  {
    from: 133,
    to: 136,
    flow: 'data-flow',
    theme: 'Metrics & SLO Guardrail',
    fault: 'SLO 指标缺口导致问题扩散后才被发现。',
    invariant: '成功率/重复执行率/未知失败率必须实时可观测并可熔断。',
    reasonCodes: ['trading_execution_uncertain', 'deferred_retry_later', 'quarantined_policy', 'ok_retry_scheduled'],
    lifecycleStates: ['DEFERRED', 'QUARANTINED', 'FAILED_RETRYABLE'],
    trigger: '注入 success/uncertain/failed 三态并压测',
    expected: '阈值越界时立即触发告警与降级动作',
    probe: '检查 observability 输出与开关动作记录',
    crossLinks: [83, 89],
  },
];

export const CT_ISSUES: CtIssueDefinition[] = CLUSTERS.flatMap(buildCluster);

if (CT_ISSUES.length !== 136) {
  throw new Error(`CT catalog size mismatch: expected 136, got ${CT_ISSUES.length}`);
}

export const CT_ISSUE_BY_ID: ReadonlyMap<CtIssueId, CtIssueDefinition> = new Map(
  CT_ISSUES.map((issue) => [issue.id, issue]),
);

export function getCtIssue(id: CtIssueId): CtIssueDefinition | null {
  return CT_ISSUE_BY_ID.get(id) || null;
}
