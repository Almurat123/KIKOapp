import { getActionsForRoute } from './pageActions';
import { AGENT_ATTRS, AGENT_SCHEMA_VERSION, type AgentMapData, type AgentNode } from './agentSchema';

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[role="tab"]',
].join(',');

const toPageKey = (pathname: string) => {
  if (pathname === '/') return 'chat';
  return pathname.replace(/^\//, '').replace(/\//g, '.').replace(/[^a-zA-Z0-9._-]/g, '_') || 'root';
};

const ensureAgentIds = (pathname: string) => {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR));
  const pageKey = toPageKey(pathname);
  let autoIndex = 0;

  for (const el of elements) {
    if (el.closest('[data-agent-ignore="true"]')) continue;

    if (!el.getAttribute(AGENT_ATTRS.id)) {
      const role =
        el.getAttribute('role') ||
        (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea' ? 'input' : 'button');
      const action =
        el.tagName.toLowerCase() === 'a'
          ? 'navigate'
          : el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea'
            ? 'input'
            : 'click';

      el.setAttribute(AGENT_ATTRS.id, `auto.${pageKey}.${role}.${autoIndex}`);
      if (!el.getAttribute(AGENT_ATTRS.role)) el.setAttribute(AGENT_ATTRS.role, role);
      if (!el.getAttribute(AGENT_ATTRS.action)) el.setAttribute(AGENT_ATTRS.action, action);
      if (!el.getAttribute(AGENT_ATTRS.page)) el.setAttribute(AGENT_ATTRS.page, pageKey);
      autoIndex += 1;
    }
  }
};

const getNodeValue = (el: HTMLElement): string | undefined => {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return el.value;
  }
  return undefined;
};

const isVisible = (el: HTMLElement, rect: DOMRect): boolean => {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  if (rect.width <= 0 || rect.height <= 0) return false;
  return true;
};

const getText = (el: HTMLElement): string | undefined => {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria;
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  return text || undefined;
};

export const buildAgentMap = (pathname: string, agentModeEnabled: boolean): AgentMapData => {
  ensureAgentIds(pathname);
  const now = new Date().toISOString();
  const nodes: AgentNode[] = [];

  const elements = Array.from(document.querySelectorAll<HTMLElement>(`[${AGENT_ATTRS.id}]`));
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    nodes.push({
      id: el.getAttribute(AGENT_ATTRS.id) || 'unknown',
      role: el.getAttribute(AGENT_ATTRS.role) || el.tagName.toLowerCase(),
      action: el.getAttribute(AGENT_ATTRS.action) || undefined,
      page: el.getAttribute(AGENT_ATTRS.page) || undefined,
      key: el.getAttribute(AGENT_ATTRS.key) || undefined,
      text: getText(el),
      value: getNodeValue(el),
      visible: isVisible(el, rect),
      disabled: 'disabled' in el ? Boolean((el as HTMLButtonElement | HTMLInputElement).disabled) : false,
      route: pathname,
      timestamp: now,
      bbox: {
        x: Number(rect.x.toFixed(2)),
        y: Number(rect.y.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
        right: Number(rect.right.toFixed(2)),
        bottom: Number(rect.bottom.toFixed(2)),
      },
    });
  }

  return {
    schema_version: AGENT_SCHEMA_VERSION,
    app: {
      name: 'kikoapp',
      version: import.meta.env.VITE_APP_VERSION || 'dev',
      route: pathname,
      agent_mode: agentModeEnabled,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    },
    actions: getActionsForRoute(pathname),
    nodes,
    timestamp: now,
  };
};
