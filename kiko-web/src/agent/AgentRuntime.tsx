import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAgentMode } from '../contexts/AgentModeContext';
import { buildAgentMap } from './agentMap';
import type { AgentMapData } from './agentSchema';

declare global {
  interface Window {
    __KIKO_AGENT_MAP__?: AgentMapData;
  }
}

const MAP_EVENT = 'kiko-agent-map-updated';

const publishMap = (pathname: string, enabled: boolean) => {
  const next = buildAgentMap(pathname, enabled);
  window.__KIKO_AGENT_MAP__ = next;
  window.dispatchEvent(new CustomEvent(MAP_EVENT, { detail: next }));
};

export const AgentRuntime: React.FC = () => {
  const location = useLocation();
  const { agentModeEnabled } = useAgentMode();
  const tickingRef = useRef(false);

  useEffect(() => {
    publishMap(location.pathname, agentModeEnabled);
  }, [location.pathname, agentModeEnabled]);

  useEffect(() => {
    const requestPublish = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        publishMap(location.pathname, agentModeEnabled);
        tickingRef.current = false;
      });
    };

    const mutationObserver = new MutationObserver(requestPublish);
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });

    window.addEventListener('resize', requestPublish);
    window.addEventListener('scroll', requestPublish, true);

    return () => {
      mutationObserver.disconnect();
      window.removeEventListener('resize', requestPublish);
      window.removeEventListener('scroll', requestPublish, true);
    };
  }, [location.pathname, agentModeEnabled]);

  return null;
};
