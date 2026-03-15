import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2, ChevronDown, ChevronRight, Circle, LoaderCircle, XCircle } from 'lucide-react';
import planStyles from './PlanCard.module.css';

type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface PlanStepExecution {
  id: string;
  toolName?: string;
  status: PlanStepStatus;
  summary: string;
  detail?: any;
  startedAt?: string;
  completedAt?: string;
}

interface PlanStep {
  id: string;
  title: string;
  description?: string;
  status: PlanStepStatus;
  preferredTools?: string[];
  startedAt?: string;
  completedAt?: string;
  feedback?: string;
  executions?: PlanStepExecution[];
}

interface PlanCardData {
  planId?: string;
  title?: string;
  summary?: string;
  locale?: 'en' | 'zh';
  status?: PlanStepStatus;
  currentStepId?: string;
  steps?: PlanStep[];
}

interface PlanCardProps {
  plan: PlanCardData;
  reasoningText?: string;
  isStreaming?: boolean;
  messageStatus?: string;
}

type DetailEntry = {
  label: string;
  value: string;
};

export const PlanCard: React.FC<PlanCardProps> = ({ plan, reasoningText, isStreaming = false, messageStatus }) => {
  const locale: 'en' | 'zh' = plan.locale === 'zh' ? 'zh' : 'en';
  const resolvedPlan = useMemo(() => normalizePlanForMessageStatus(plan, messageStatus, locale), [plan, messageStatus, locale]);
  const steps = Array.isArray(resolvedPlan.steps) ? resolvedPlan.steps : [];
  const liveReasoning = normalizeReasoning(reasoningText || '');
  const visualStatus: PlanStepStatus = isStreaming && (resolvedPlan.status === 'pending' || resolvedPlan.status === 'in_progress')
    ? 'in_progress'
    : (resolvedPlan.status || 'pending');
  const isActive = visualStatus === 'in_progress';
  const defaultOpen = useMemo(() => {
    const firstExpandable = steps.find((step) => (step.executions || []).length > 0);
    return firstExpandable?.id ? [firstExpandable.id] : [];
  }, [steps]);
  const [openStepIds, setOpenStepIds] = useState<string[]>(defaultOpen);

  useEffect(() => {
    setOpenStepIds((current) => {
      const allowedStepIds = new Set(
        steps
          .filter((step) => !!step.description || (step.executions || []).length > 0)
          .map((step) => step.id),
      );
      const filtered = current.filter((id) => allowedStepIds.has(id));
      if (filtered.length > 0) return filtered;
      return defaultOpen;
    });
  }, [steps, defaultOpen]);

  if (steps.length === 0) return null;

  return (
    <div className={clsx(planStyles.card, isActive && planStyles.cardActive)}>
      <div className={planStyles.header}>
        <div className={planStyles.headerMain}>
          <div className={planStyles.eyebrow}>Todo-list</div>
          <div className={planStyles.title}>{plan.title || 'Task execution'}</div>
          {plan.summary ? <div className={planStyles.summary}>{plan.summary}</div> : null}
        </div>
        <div className={clsx(planStyles.statusPill, planStyles[`status_${visualStatus}`], isActive && planStyles.statusPillActive)}>
          {labelForStatus(visualStatus, locale)}
        </div>
      </div>

      {liveReasoning ? (
        <div className={planStyles.reasoningBlock}>
          <div className={planStyles.reasoningLabel}>Reasoning</div>
          <div className={planStyles.reasoningText}>
            {liveReasoning}
            {isStreaming ? <span className={planStyles.reasoningCaret} aria-hidden="true" /> : null}
          </div>
        </div>
      ) : null}

      <div className={planStyles.timeline}>
        {steps.map((step, index) => {
          const visualStepStatus: PlanStepStatus = isStreaming && step.status === 'pending' && resolvedPlan.currentStepId === step.id
            ? 'in_progress'
            : step.status;
          const isExpanded = openStepIds.includes(step.id);
          const hasDetail = !!step.description || (step.executions || []).length > 0;
          return (
            <div key={step.id} className={planStyles.step}>
              <div className={planStyles.railColumn}>
                <div className={clsx(planStyles.node, planStyles[`status_${visualStepStatus}`], visualStepStatus === 'in_progress' && planStyles.nodeActive)}>
                  {iconForStatus(visualStepStatus)}
                </div>
                {index < steps.length - 1 ? <div className={planStyles.line} /> : null}
              </div>

              <div className={planStyles.stepBody}>
                <button
                  type="button"
                  className={clsx(planStyles.stepHeader, !hasDetail && planStyles.stepHeaderStatic)}
                  onClick={() => {
                    if (!hasDetail) return;
                    setOpenStepIds((current) => (
                      current.includes(step.id)
                        ? current.filter((id) => id !== step.id)
                        : [...current, step.id]
                    ));
                  }}
                >
                  <div className={planStyles.stepMain}>
                    <div className={clsx(planStyles.stepTitle, planStyles[`stepTitle_${visualStepStatus}`])}>
                      {step.title}
                    </div>
                    {step.feedback ? <div className={planStyles.feedback}>{compactSentence(step.feedback)}</div> : null}
                  </div>
                  {hasDetail ? (
                    isExpanded ? <ChevronDown size={16} className={planStyles.chevron} /> : <ChevronRight size={16} className={planStyles.chevron} />
                  ) : null}
                </button>

                {isExpanded ? (
                  <div className={planStyles.detailPanel}>
                    {step.description ? <div className={planStyles.description}>{step.description}</div> : null}

                    {(step.executions || []).map((execution) => {
                      const entries = summarizeDetail(execution.detail);
                      return (
                        <div key={execution.id} className={planStyles.execution}>
                          <div className={planStyles.executionHeader}>
                            <span className={clsx(planStyles.executionState, planStyles[`status_${execution.status}`])}>
                              {labelForStatus(execution.status, locale)}
                            </span>
                            <span className={planStyles.executionSummary}>{compactSentence(execution.summary)}</span>
                          </div>
                          {execution.toolName ? (
                            <div className={planStyles.executionToolRow}>
                              <span className={planStyles.executionToolPill}>{execution.toolName}</span>
                            </div>
                          ) : null}
                          {entries.length > 0 ? (
                            <div className={planStyles.detailList}>
                              {entries.map((entry) => (
                                <div key={`${execution.id}:${entry.label}`} className={planStyles.detailRow}>
                                  <span className={planStyles.detailLabel}>{entry.label}</span>
                                  <span className={planStyles.detailValue}>{entry.value}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function iconForStatus(status: PlanStepStatus) {
  if (status === 'completed') return <CheckCircle2 size={14} />;
  if (status === 'failed') return <XCircle size={14} />;
  if (status === 'in_progress') return <LoaderCircle size={14} className={planStyles.spinner} />;
  return <Circle size={12} />;
}

function labelForStatus(status: PlanStepStatus, locale: 'en' | 'zh'): string {
  if (locale === 'zh') {
    if (status === 'completed') return '完成';
    if (status === 'failed') return '失败';
    if (status === 'in_progress') return '进行中';
    return '待处理';
  }
  if (status === 'completed') return 'Done';
  if (status === 'failed') return 'Error';
  if (status === 'in_progress') return 'Loading';
  return 'Pending';
}

function compactSentence(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeReasoning(value: string): string {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function normalizePlanForMessageStatus(
  plan: PlanCardData,
  messageStatus: string | undefined,
  locale: 'en' | 'zh',
): PlanCardData {
  const resolved: PlanCardData = {
    ...plan,
    steps: Array.isArray(plan.steps) ? plan.steps.map((step) => ({ ...step, executions: [...(step.executions || [])] })) : [],
  };

  const isTerminalError = messageStatus === 'error';
  const isTerminalSuccess = messageStatus === 'complete';

  if (isTerminalError && resolved.status !== 'failed') {
    resolved.status = 'failed';
    resolved.currentStepId = undefined;
  } else if (isTerminalSuccess && (resolved.status === 'pending' || resolved.status === 'in_progress')) {
    resolved.status = 'completed';
    resolved.currentStepId = undefined;
  }

  if (resolved.status === 'failed') {
    resolved.steps = (resolved.steps || []).map((step) => {
      if (step.status !== 'pending' && step.status !== 'in_progress') return step;
      return {
        ...step,
        status: 'failed',
        feedback: step.feedback || (locale === 'zh'
          ? '由于任务已终止，此步骤未继续执行。'
          : 'This step did not continue because the task already stopped.'),
      };
    });
  } else if (resolved.status === 'completed') {
    resolved.steps = (resolved.steps || []).map((step) => {
      if (step.status !== 'pending' && step.status !== 'in_progress') return step;
      return {
        ...step,
        status: 'completed',
        feedback: step.feedback || (locale === 'zh'
          ? '任务已完成，此步骤无需继续执行。'
          : 'The task completed without needing additional work for this step.'),
      };
    });
  }

  return resolved;
}

function summarizeDetail(detail: any): DetailEntry[] {
  if (!detail || typeof detail !== 'object') return [];

  const entries: DetailEntry[] = [];
  const push = (label: string, value: unknown) => {
    const normalized = formatValue(value);
    if (!normalized) return;
    if (entries.some((entry) => entry.label === label && entry.value === normalized)) return;
    entries.push({ label, value: normalized });
  };

  push('Error', detail.error);

  if (detail.arguments && typeof detail.arguments === 'object') {
      for (const [key, value] of collectPrimitiveEntries(detail.arguments, 4)) {
      push(`Arg · ${humanizeKey(key)}`, value);
    }
  }

  if (detail.result && typeof detail.result === 'object' && !Array.isArray(detail.result)) {
    push('Summary', detail.result.summary);
    push('Summary', detail.result.message);
    push('Status', detail.result.status);
  } else if (typeof detail.result === 'string') {
    push('Summary', detail.result);
  }

  if (detail.metadata && typeof detail.metadata === 'object') {
    for (const [key, value] of collectPrimitiveEntries(detail.metadata, 2)) {
      push(`Meta · ${humanizeKey(key)}`, value);
    }
  }

  return entries.slice(0, 8);
}

function collectPrimitiveEntries(value: Record<string, any>, limit: number): Array<[string, unknown]> {
  const entries: Array<[string, unknown]> = [];
  for (const [key, item] of Object.entries(value || {})) {
    if (entries.length >= limit) break;
    if (key === '_truncated') continue;
    if (item === null || item === undefined) continue;
    if (typeof item === 'object') {
      continue;
    }
    entries.push([key, item]);
  }
  return entries;
}

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}
