import React, { useEffect, useState } from 'react';
import type { AgentMapData } from '../agent/agentSchema';

const EVENT_NAME = 'kiko-agent-map-updated';

const getSnapshot = (): AgentMapData | null => {
  if (typeof window === 'undefined') return null;
  return window.__KIKO_AGENT_MAP__ || null;
};

export const AgentMapPage: React.FC = () => {
  const [data, setData] = useState<AgentMapData | null>(getSnapshot);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<AgentMapData>;
      setData(custom.detail || getSnapshot());
    };

    window.addEventListener(EVENT_NAME, handler);
    const timer = window.setInterval(() => {
      setData(getSnapshot());
    }, 800);

    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <pre
      style={{
        margin: 0,
        padding: '16px',
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#e4e4e7',
        overflow: 'auto',
        fontSize: '12px',
        lineHeight: 1.5,
      }}
      data-agent-ignore="true"
    >
      {JSON.stringify(data || { status: 'waiting_for_agent_runtime' }, null, 2)}
    </pre>
  );
};

export default AgentMapPage;
