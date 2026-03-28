/**
 * Chat WebSocket Client
 * Manages connection to backend chat WebSocket
 */
import { getAuthToken, clearAuthTokenCache } from './authToken';
import { getRuntimeConfigUrl, getEnvUrl } from './runtimeConfig';
import { adaptLoopbackUrlForBrowser, isLocalLikeHost } from './runtimeHosts';

function resolveWsBaseUrl(): string {
    const viteEnv = (import.meta as any)?.env || {};
    const explicit = getRuntimeConfigUrl('CHAT_WS_URL') || getEnvUrl('VITE_CHAT_WS_URL') || getEnvUrl('VITE_WS_URL');
    if (explicit) {
        try {
            const parsed = new URL(explicit);
            if (parsed.protocol === 'ws:' || parsed.protocol === 'wss:') {
                return adaptLoopbackUrlForBrowser(explicit);
            }
            console.warn('[ChatWS] Invalid ws protocol in CHAT_WS_URL, falling back:', explicit);
        } catch {
            console.warn('[ChatWS] Invalid CHAT_WS_URL, falling back:', explicit);
        }
    }

    // Derive WS URL from explicit HTTP API URL when CHAT_WS_URL is not configured.
    const apiBase = getRuntimeConfigUrl('CHAT_API_URL') || getEnvUrl('VITE_CHAT_API_URL') || getRuntimeConfigUrl('API_URL') || getEnvUrl('VITE_API_URL');
    if (apiBase) {
        try {
            const parsed = new URL(adaptLoopbackUrlForBrowser(apiBase));
            const wsProto = parsed.protocol === 'https:' ? 'wss:' : parsed.protocol === 'http:' ? 'ws:' : '';
            if (wsProto) {
                return `${wsProto}//${parsed.host}`.replace(/\/+$/, '');
            }
        } catch {
            console.warn('[ChatWS] Invalid API URL fallback for WS:', apiBase);
        }
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
        const host = window.location.hostname.toLowerCase();
        if (isLocalLikeHost(host)) {
            const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            return `${proto}//${window.location.host}`;
        }
        return 'wss://api.kikoapp.app';
    }

    return viteEnv.PROD ? 'wss://api.kikoapp.app' : 'ws://localhost:3001';
}

const WS_BASE_URL = resolveWsBaseUrl();
const WS_OPEN_TIMEOUT_MS = 3000;

export type ChatEventType = 'chunk' | 'content_block' | 'task_status' | 'message_complete' | 'message_start' | 'error' | 'pong' | 'usage' | 'citations' | 'client_action' | 'sync_complete' | 'transaction_update' | 'transaction_confirmed' | 'transaction_complete' | 'latency_metrics' | 'agent_runtime';

export interface ChatEvent {
    type: ChatEventType;
    sessionId: string;
    data: any;
    payload?: any;
    requestId?: string;
    ts?: string;
    seq?: number;  // Sequence number for reliable delivery
}

export class ChatWebSocketClient {
    private socket: WebSocket | null = null;
    private token: string | null = null;
    private authenticated = false;
    private socketUrl = '';
    private connectStartedAt = 0;
    private listeners: Set<(event: ChatEvent) => void> = new Set();
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private authTimeout: NodeJS.Timeout | null = null;
    private openTimeout: NodeJS.Timeout | null = null;
    private connectionPromise: Promise<void> | null = null;
    private connectionResolver: (() => void) | null = null;

    // Sequence tracking: sessionId -> last received sequence number
    private lastReceivedSeq: Map<string, number> = new Map();
    private trackedSessions: Set<string> = new Set();

    constructor() { }

    public connect(token: string) {
        if (this.socket && this.token === token &&
            (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            const isHealthyOpen = this.socket.readyState === WebSocket.OPEN && this.authenticated;
            const isFreshConnecting =
                this.socket.readyState === WebSocket.CONNECTING &&
                this.connectStartedAt > 0 &&
                (Date.now() - this.connectStartedAt) < WS_OPEN_TIMEOUT_MS;
            if (isHealthyOpen || isFreshConnecting) {
                return;
            }

            console.warn('[ChatWS] Restarting stale socket before reconnect', {
                readyState: this.socket.readyState,
                authenticated: this.authenticated,
                connectAgeMs: this.connectStartedAt ? (Date.now() - this.connectStartedAt) : null,
                url: this.socketUrl || `${WS_BASE_URL}/api/chat/ws`,
            });
        }

        this.close();
        this.token = token;
        this.authenticated = false;

        // Create connection promise
        this.connectionPromise = new Promise<void>((resolve) => {
            this.connectionResolver = resolve;
        });

        const url = `${WS_BASE_URL}/api/chat/ws`;
        this.socketUrl = url;
        this.connectStartedAt = Date.now();
        console.log(`[ChatWS] Connecting to user WebSocket: ${url}`);

        this.socket = new WebSocket(url);
        this.openTimeout = setTimeout(() => {
            if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
                console.warn('[ChatWS] Socket open timeout, closing stale connection', {
                    url: this.socketUrl,
                    waitedMs: Date.now() - this.connectStartedAt,
                });
                this.socket.close();
            }
        }, WS_OPEN_TIMEOUT_MS);

        this.socket.onopen = () => {
            if (this.openTimeout) {
                clearTimeout(this.openTimeout);
                this.openTimeout = null;
            }
            console.log(`[ChatWS] Socket opened, sending auth`);
            this.socket?.send(JSON.stringify({
                type: 'auth',
                token,
            }));
            this.authTimeout = setTimeout(() => {
                console.warn('[ChatWS] Auth timeout, closing socket');
                this.socket?.close(1008, 'WS auth timeout');
            }, 8000);
        };

        this.socket.onmessage = (event) => {
            try {
                const raw = JSON.parse(event.data);
                if (raw?.type === 'auth_ok') {
                    this.authenticated = true;
                    if (this.authTimeout) {
                        clearTimeout(this.authTimeout);
                        this.authTimeout = null;
                    }
                    console.log('[ChatWS] Authenticated');
                    this.startHeartbeat();
                    this.requestSyncForAllSessions();
                    if (this.connectionResolver) {
                        this.connectionResolver();
                        this.connectionResolver = null;
                    }
                    return;
                }
                const data = this.normalizeIncomingEvent(raw);
                if (!data) return;
                if (data.sessionId) {
                    this.trackSession(data.sessionId);
                }

                // Track sequence number and send ACK
                if (data.seq !== undefined && data.sessionId) {
                    this.lastReceivedSeq.set(data.sessionId, data.seq);
                    this.sendAck(data.sessionId, data.seq);
                }

                // Handle sync_complete
                if (data.type === 'sync_complete') {
                    console.log(`[ChatWS] Sync complete for session ${data.sessionId}`);
                    return; // Don't forward to listeners
                }

                // console.log('[ChatWS] Message received:', data.type, 'sessionId:', data.sessionId, 'seq:', data.seq);
                this.listeners.forEach(listener => listener(data));
            } catch (e) {
                console.error('[ChatWS] Error parsing message:', e);
            }
        };

        this.socket.onclose = (event) => {
            this.authenticated = false;
            if (this.openTimeout) {
                clearTimeout(this.openTimeout);
                this.openTimeout = null;
            }
            console.log(`[ChatWS] Disconnected (code: ${event.code}, reason: ${event.reason})`);
            this.stopHeartbeat();
            if (this.authTimeout) {
                clearTimeout(this.authTimeout);
                this.authTimeout = null;
            }
            if (this.token === token) {
                this.reconnectTimeout = setTimeout(async () => {
                    // Always attempt to refresh token on reconnect to avoid loops on expired JWT.
                    if (event.code === 1008 || event.code === 1006) {
                        clearAuthTokenCache();
                    }
                    const fresh = await getAuthToken();
                    const nextToken = fresh || token;
                    this.connect(nextToken);
                }, 3000);
            }
        };

        this.socket.onerror = (error) => {
            console.error('[ChatWS] WebSocket error:', {
                error,
                url: this.socketUrl,
                readyState: this.socket?.readyState ?? null,
                authenticated: this.authenticated,
            });
        };
    }

    private normalizeIncomingEvent(raw: any): ChatEvent | null {
        const withEnvelope = (event: ChatEvent): ChatEvent => ({
            ...event,
            payload: event.payload ?? event.data,
            requestId: event.requestId || raw?.requestId || '',
            ts: event.ts || raw?.ts || new Date().toISOString(),
        });

        // Legacy format passthrough
        if (raw?.type && raw?.data && raw?.sessionId) return withEnvelope(raw as ChatEvent);

        // New unified format from chat-v2
        if (!raw?.type || !raw?.session_id) return null;
        const t = raw.type as string;
        const sessionId = raw.session_id as string;
        const messageId = raw.message_id as string | undefined;
        const payload = raw.payload || {};
        const seq = raw.seq as number | undefined;
        const normalizeCitations = (value: any): any[] => {
            if (!value) return [];
            const list = Array.isArray(value) ? value : [value];
            return list.filter((item) => {
                if (item === null || item === undefined) return false;
                if (typeof item === 'string') return item.trim().length > 0;
                if (typeof item === 'object') return true;
                return false;
            });
        };

        if (t === 'message_start') {
            return withEnvelope({
                type: 'message_start',
                sessionId,
                seq,
                data: {
                    message_id: payload.message_id || messageId,
                    messageId: payload.message_id || messageId,
                    task_id: payload.task_id,
                    taskId: payload.taskId || payload.task_id,
                }
            });
        }
        if (t === 'status') {
            const normalizedStatus =
                payload.status === 'completed' ? 'done'
                    : payload.status === 'stopped' ? 'done'
                        : payload.status;
            return withEnvelope({
                type: 'task_status',
                sessionId,
                seq,
                data: {
                    status: normalizedStatus,
                    message: payload.message,
                    error: payload.error,
                    task_id: payload.task_id,
                    taskId: payload.taskId || payload.task_id,
                    taskType: payload.taskType,
                    iteration: payload.iteration,
                    maxIterations: payload.maxIterations,
                }
            });
        }
        if (t === 'delta_text') {
            const txt = payload.text || '';
            return withEnvelope({ type: 'chunk', sessionId, seq, data: { message_id: messageId, messageId, type: 'content', content: txt, delta: txt } });
        }
        if (t === 'delta_reasoning') {
            const txt = payload.text || '';
            return withEnvelope({ type: 'chunk', sessionId, seq, data: { message_id: messageId, messageId, type: 'reasoning', reasoning_content: txt } });
        }
        if (t === 'tool_call') {
            return withEnvelope({ type: 'client_action', sessionId, seq, data: { message_id: messageId, action: { type: 'tool_call', payload } } });
        }
        if (t === 'tool_result') {
            return withEnvelope({ type: 'client_action', sessionId, seq, data: { message_id: messageId, action: { type: 'tool_result', payload } } });
        }
        if (t === 'client_action') {
            const actionPayload = payload.action || payload;
            return withEnvelope({
                type: 'client_action',
                sessionId,
                seq,
                data: {
                    message_id: payload.message_id || payload.messageId || messageId,
                    messageId: payload.message_id || payload.messageId || messageId,
                    targetMessageId: payload.targetMessageId || payload.target_message_id,
                    action: actionPayload,
                }
            });
        }
        if (t === 'agent_runtime') {
            return withEnvelope({
                type: 'agent_runtime',
                sessionId,
                seq,
                data: {
                    message_id: payload.message_id || payload.messageId || messageId,
                    messageId: payload.message_id || payload.messageId || messageId,
                    snapshot: payload.snapshot,
                    event: payload.event,
                    planId: payload.planId || payload.plan_id,
                    kind: payload.kind || 'agent_runtime',
                    scope: payload.scope || 'chat_task',
                }
            });
        }
        if (t === 'usage') {
            return withEnvelope({ type: 'usage', sessionId, seq, data: { message_id: messageId, messageId, usage: payload.usage || payload } });
        }
        if (t === 'citation') {
            return withEnvelope({
                type: 'citations',
                sessionId,
                seq,
                data: {
                    message_id: messageId,
                    messageId,
                    citations: normalizeCitations(payload.citations ?? payload.citation),
                }
            });
        }
        if (t === 'citations') {
            return withEnvelope({
                type: 'citations',
                sessionId,
                seq,
                data: {
                    message_id: payload.message_id || messageId,
                    messageId: payload.message_id || messageId,
                    citations: normalizeCitations(payload.citations ?? payload.citation),
                }
            });
        }
        if (t === 'message_complete') {
            return withEnvelope({
                type: 'message_complete',
                sessionId,
                seq,
                data: {
                    message_id: payload.message_id || messageId,
                    messageId: payload.message_id || messageId,
                    usage: payload.usage,
                    citations: normalizeCitations(payload.citations ?? payload.citation),
                }
            });
        }
        if (t === 'error') {
            return withEnvelope({
                type: 'error',
                sessionId,
                seq,
                data: {
                    message_id: payload.message_id || messageId,
                    messageId: payload.message_id || messageId,
                    task_id: payload.task_id,
                    taskId: payload.taskId || payload.task_id,
                    error: payload.message || payload.error || 'Unknown error',
                    usage: payload.usage,
                    citations: normalizeCitations(payload.citations ?? payload.citation),
                    raw: payload.raw,
                    request_tail: payload.request_tail,
                }
            });
        }
        if (t === 'latency_metrics') {
            return withEnvelope({ type: 'latency_metrics', sessionId, seq, data: payload });
        }
        return null;
    }

    // Wait for connection to be established
    public async waitForConnection(timeout = 5000): Promise<boolean> {
        if (this.socket?.readyState === WebSocket.OPEN && this.authenticated) {
            return true;
        }

        if (!this.connectionPromise) {
            return false;
        }

        try {
            await Promise.race([
                this.connectionPromise,
                new Promise<void>((_, reject) =>
                    setTimeout(() => reject(new Error('Connection timeout')), timeout)
                )
            ]);
            return true;
        } catch {
            console.warn('[ChatWS] Connection wait timed out', {
                url: this.socketUrl,
                readyState: this.socket?.readyState ?? null,
                authenticated: this.authenticated,
                waitedMs: timeout,
            });
            return false;
        }
    }

    public subscribe(listener: (event: ChatEvent) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    public trackSession(sessionId: string) {
        const normalized = String(sessionId || '').trim();
        if (!normalized) return;
        this.trackedSessions.add(normalized);
        if (!this.lastReceivedSeq.has(normalized)) {
            this.lastReceivedSeq.set(normalized, 0);
        }
    }

    /**
     * Clear all listeners
     */
    public clearListeners() {
        this.listeners.clear();
    }

    public close() {
        this.token = null;
        this.authenticated = false;
        this.socketUrl = '';
        this.connectStartedAt = 0;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.openTimeout) {
            clearTimeout(this.openTimeout);
            this.openTimeout = null;
        }
        if (this.authTimeout) {
            clearTimeout(this.authTimeout);
            this.authTimeout = null;
        }
        if (this.socket) {
            // Unset onclose to avoid reconnection loop during intentional close
            this.socket.onclose = null;
            this.socket.close();
            this.socket = null;
        }
        this.stopHeartbeat();
    }

    /**
     * Send ACK for a received message
     */
    private sendAck(sessionId: string, seq: number) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'ack',
                sessionId,
                seq
            }));
        }
    }

    /**
     * Request sync for a specific session
     */
    public requestSync(sessionId: string) {
        this.trackSession(sessionId);
        const lastSeq = this.lastReceivedSeq.get(sessionId) || 0;
        if (this.socket?.readyState === WebSocket.OPEN) {
            console.log(`[ChatWS] Requesting sync for session ${sessionId} from seq ${lastSeq}`);
            this.socket.send(JSON.stringify({
                type: 'sync',
                sessionId,
                lastSeq
            }));
        }
    }

    /**
     * Request sync for all tracked sessions after reconnection
     */
    private requestSyncForAllSessions() {
        this.trackedSessions.forEach((sessionId) => {
            this.requestSync(sessionId);
        });
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        this.pingInterval = setInterval(() => {
            if (this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    }

    private stopHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}

export const chatWSClient = new ChatWebSocketClient();
