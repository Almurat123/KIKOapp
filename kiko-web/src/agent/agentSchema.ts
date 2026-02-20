export const AGENT_SCHEMA_VERSION = '1.0.0';

export type AgentRole =
  | 'nav'
  | 'input'
  | 'button'
  | 'list'
  | 'row'
  | 'card'
  | 'toggle'
  | 'dialog'
  | 'tab';

export type AgentActionType =
  | 'navigate'
  | 'open'
  | 'close'
  | 'submit'
  | 'select'
  | 'toggle'
  | 'copy'
  | 'confirm';

export interface AgentNode {
  id: string;
  role: string;
  action?: string;
  page?: string;
  key?: string;
  text?: string;
  value?: string;
  visible: boolean;
  disabled: boolean;
  route: string;
  timestamp: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
  };
}

export interface AgentMapData {
  schema_version: string;
  app: {
    name: string;
    version: string;
    route: string;
    agent_mode: boolean;
  };
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  actions: AgentRouteAction[];
  nodes: AgentNode[];
  timestamp: string;
}

export interface AgentActionStep {
  action: string;
  target: string;
  description: string;
}

export interface AgentRouteAction {
  id: string;
  track: 'ui' | 'api';
  title: string;
  preconditions: string[];
  expected_result: string;
  fallback: string;
  params: Record<string, unknown>;
  steps: AgentActionStep[];
}

export const AGENT_ATTRS = {
  id: 'data-agent-id',
  role: 'data-agent-role',
  action: 'data-agent-action',
  page: 'data-agent-page',
  key: 'data-agent-key',
} as const;
