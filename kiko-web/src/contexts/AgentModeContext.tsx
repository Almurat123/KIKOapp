import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AgentModeSource = 'query' | 'settings' | 'default';

interface AgentModeContextType {
  agentModeEnabled: boolean;
  agentModeSource: AgentModeSource;
  setAgentModeEnabled: (enabled: boolean) => void;
  isQueryOverride: boolean;
}

const STORAGE_KEY = 'kiko-agent-mode-enabled';

const AgentModeContext = createContext<AgentModeContextType | undefined>(undefined);

const parseQueryOverride = (): boolean | null => {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('agent_mode');
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
  } catch {
    // noop
  }
  return null;
};

const readStoredValue = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

interface AgentModeProviderProps {
  children: ReactNode;
}

export const AgentModeProvider: React.FC<AgentModeProviderProps> = ({ children }) => {
  const [queryOverride, setQueryOverride] = useState<boolean | null>(() => parseQueryOverride());
  const [storedEnabled, setStoredEnabled] = useState<boolean>(() => readStoredValue());

  useEffect(() => {
    const updateQuery = () => setQueryOverride(parseQueryOverride());
    window.addEventListener('popstate', updateQuery);
    return () => window.removeEventListener('popstate', updateQuery);
  }, []);

  const setAgentModeEnabled = (enabled: boolean) => {
    setStoredEnabled(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      // noop
    }
  };

  const { agentModeEnabled, agentModeSource } = useMemo(() => {
    if (queryOverride !== null) {
      return { agentModeEnabled: queryOverride, agentModeSource: 'query' as const };
    }

    if (storedEnabled) {
      return { agentModeEnabled: true, agentModeSource: 'settings' as const };
    }

    return { agentModeEnabled: false, agentModeSource: 'default' as const };
  }, [queryOverride, storedEnabled]);

  useEffect(() => {
    const root = document.documentElement;
    if (agentModeEnabled) {
      root.classList.add('agent-mode');
    } else {
      root.classList.remove('agent-mode');
    }
  }, [agentModeEnabled]);

  return (
    <AgentModeContext.Provider
      value={{
        agentModeEnabled,
        agentModeSource,
        setAgentModeEnabled,
        isQueryOverride: queryOverride !== null,
      }}
    >
      {children}
    </AgentModeContext.Provider>
  );
};

export const useAgentMode = () => {
  const context = useContext(AgentModeContext);
  if (!context) {
    throw new Error('useAgentMode must be used within AgentModeProvider');
  }
  return context;
};
