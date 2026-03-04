import type { CopytradeLifecycleState, CopytradeReasonCode } from '../contracts/lifecycle.js';
import { CT_ISSUES, CT_ISSUE_BY_ID } from './ct136Catalog.js';
import { ALL_COPYTRADE_REASON_CODES, type CtIssueDefinition, type CtIssueFlow, type CtIssueId, type CtIssueTrace } from './ct136Types.js';

export interface CtCatalogIntegrityReport {
  total: number;
  uniqueIds: number;
  missingIds: CtIssueId[];
  missingReasonCodes: CopytradeReasonCode[];
  disconnectedIds: CtIssueId[];
  danglingRelatedIds: CtIssueId[];
}

const issuesByReasonCode = new Map<CopytradeReasonCode, CtIssueDefinition[]>();
for (const issue of CT_ISSUES) {
  for (const reasonCode of issue.reasonCodes) {
    const existing = issuesByReasonCode.get(reasonCode) || [];
    existing.push(issue);
    issuesByReasonCode.set(reasonCode, existing);
  }
}

function toCtId(n: number): CtIssueId {
  return `CT-${String(n).padStart(3, '0')}`;
}

function uniq<T>(input: T[]): T[] {
  return [...new Set(input)];
}

function rankCandidates(params: {
  candidates: CtIssueDefinition[];
  preferredFlow?: CtIssueFlow;
  lifecycleState?: CopytradeLifecycleState;
  preferredIssueId?: CtIssueId;
}): CtIssueDefinition[] {
  const ranked = [...params.candidates];
  ranked.sort((a, b) => {
    const aIssue = params.preferredIssueId && a.id === params.preferredIssueId ? 1 : 0;
    const bIssue = params.preferredIssueId && b.id === params.preferredIssueId ? 1 : 0;
    if (aIssue !== bIssue) return bIssue - aIssue;

    const aFlow = params.preferredFlow && a.flow === params.preferredFlow ? 1 : 0;
    const bFlow = params.preferredFlow && b.flow === params.preferredFlow ? 1 : 0;
    if (aFlow !== bFlow) return bFlow - aFlow;

    const aState = params.lifecycleState && a.lifecycleStates.includes(params.lifecycleState) ? 1 : 0;
    const bState = params.lifecycleState && b.lifecycleStates.includes(params.lifecycleState) ? 1 : 0;
    if (aState !== bState) return bState - aState;

    return a.id.localeCompare(b.id);
  });
  return ranked;
}

export function resolveCtIssueTrace(params: {
  reasonCode: CopytradeReasonCode;
  preferredFlow?: CtIssueFlow;
  lifecycleState?: CopytradeLifecycleState;
  preferredIssueId?: CtIssueId;
  maxPrimary?: number;
}): CtIssueTrace {
  const candidates = issuesByReasonCode.get(params.reasonCode) || [];
  const ranked = rankCandidates({
    candidates,
    preferredFlow: params.preferredFlow,
    lifecycleState: params.lifecycleState,
    preferredIssueId: params.preferredIssueId,
  });

  const maxPrimary = Math.max(1, Math.min(params.maxPrimary || 3, 8));
  const primary = ranked.slice(0, maxPrimary);
  const primaryIds = primary.map((issue) => issue.id);

  const relatedIds = uniq(
    primary
      .flatMap((issue) => issue.relatedIds)
      .filter((id) => !primaryIds.includes(id)),
  );

  const flows = uniq([
    ...primary.map((issue) => issue.flow),
    ...relatedIds.map((id) => CT_ISSUE_BY_ID.get(id)?.flow).filter((flow): flow is CtIssueFlow => Boolean(flow)),
  ]);

  return {
    primaryIds,
    relatedIds,
    flows,
  };
}

function collectDisconnectedIds(): CtIssueId[] {
  if (CT_ISSUES.length === 0) return [];

  const visited = new Set<CtIssueId>();
  const queue: CtIssueId[] = [toCtId(1)];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const issue = CT_ISSUE_BY_ID.get(current);
    if (!issue) continue;

    for (const related of issue.relatedIds) {
      if (!visited.has(related)) queue.push(related);
    }

    const idx = Number(current.slice(3));
    const prev = idx > 1 ? toCtId(idx - 1) : null;
    const next = idx < 136 ? toCtId(idx + 1) : null;
    if (prev && !visited.has(prev)) queue.push(prev);
    if (next && !visited.has(next)) queue.push(next);
  }

  return CT_ISSUES.map((issue) => issue.id).filter((id) => !visited.has(id));
}

export function verifyCtCatalogIntegrity(): CtCatalogIntegrityReport {
  const ids = CT_ISSUES.map((issue) => issue.id);
  const uniqueIds = new Set(ids);

  const missingIds: CtIssueId[] = [];
  for (let i = 1; i <= 136; i += 1) {
    const id = toCtId(i);
    if (!uniqueIds.has(id)) missingIds.push(id);
  }

  const missingReasonCodes = ALL_COPYTRADE_REASON_CODES.filter(
    (reasonCode) => (issuesByReasonCode.get(reasonCode) || []).length === 0,
  );

  const danglingRelatedIds = uniq(
    CT_ISSUES
      .flatMap((issue) => issue.relatedIds)
      .filter((id) => !CT_ISSUE_BY_ID.has(id)),
  );

  return {
    total: CT_ISSUES.length,
    uniqueIds: uniqueIds.size,
    missingIds,
    missingReasonCodes,
    disconnectedIds: collectDisconnectedIds(),
    danglingRelatedIds,
  };
}

export const CT_CATALOG_INTEGRITY = verifyCtCatalogIntegrity();

export function listCtIssuesByFlow(flow: CtIssueFlow): CtIssueDefinition[] {
  return CT_ISSUES.filter((issue) => issue.flow === flow);
}
