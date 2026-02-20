import type { AgentMapData } from '../agent/agentSchema';

declare global {
  interface Window {
    __KIKO_AGENT_MAP__?: AgentMapData;
  }
}

export {};
