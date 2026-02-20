import type { AgentActionType, AgentRole } from './agentSchema';

interface AgentAttrInput {
  id: string;
  role: AgentRole | string;
  action?: AgentActionType | string;
  page?: string;
  key?: string;
}

export const agentAttrs = ({ id, role, action, page, key }: AgentAttrInput): Record<string, string> => {
  const attrs: Record<string, string> = {
    'data-agent-id': id,
    'data-agent-role': role,
  };

  if (action) attrs['data-agent-action'] = action;
  if (page) attrs['data-agent-page'] = page;
  if (key) attrs['data-agent-key'] = key;

  return attrs;
};
