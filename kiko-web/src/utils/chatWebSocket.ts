/**
 * Chat WebSocket Client
 * Manages connection to backend chat WebSocket
 */
import { getAuthToken, clearAuthTokenCache } from './authToken';
import { getRuntimeConfigUrl, getEnvUrl } from './runtimeConfig';

function resolveWsBaseUrl(): string {
    const explicit = getRuntimeConfigUrl('CHAT_WS_URL') || getEnvUrl('VITE_CHAT_WS_URL') || getEnvUrl('VITE_WS_URL');
    if (explicit) {
        try {
            const parsed = new URL(explicit);
            if (parsed.protocol === 'ws:' || parsed.protocol === 'wss:') {
                return explicit.replace(/\/+$/, '');
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
            const parsed = new URL(apiBase);
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
        const isLocal = host === 'localhost' || host === '127.0.0.1';
        if (isLocal) {
            const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            return `${proto}//${window.location.host}`;
        }
        return 'wss://api.kikoapp.app';
    }

    return import.meta.env.PROD ? 'wss://api.kikoapp.app' : 'ws://localhost:3001';
}

const WS_BASE_URL = resolveWsBaseUrl();

export type ChatEventType = 'chunk' | 'content_block' | 'task_status' | 'message_complete' | 'message_start' | 'error' | 'pong' | 'usage' | 'citations' | 'client_action' | 'sync_complete' | 'transaction_update' | 'transaction_confirmed' | 'transaction_complete' | 'latency_metrics';

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
    private listeners: Set<(event: ChatEvent) => void> = new Set();
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private connectionPromise: Promise<void> | null = null;
    private connectionResolver: (() => void) | null = null;

    // Sequence tracking: sessionId -> last received sequence number
    private lastReceivedSeq: Map<string, number> = new Map();

    constructor() { }

    public connect(token: string) {
        if (this.socket && this.token === token &&
            (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            // Already connected, silent return to prevent console span
            return;
        }

        this.close();
        this.token = token;

        // Create connection promise
        this.connectionPromise = new Promise<void>((resolve) => {
            this.connectionResolver = resolve;
        });

        // Use query params because browser WebSocket does not allow custom headers during handshake
        const appKey = import.meta.env.VITE_APP_KEY || '';
        const qs = new URLSearchParams({ token });
        if (appKey) qs.set('appKey', appKey);
        const url = `${WS_BASE_URL}/api/chat/ws?${qs.toString()}`;
        console.log(`[ChatWS] Connecting to user WebSocket...`);

        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            console.log(`[ChatWS] Connected to user WebSocket`);
            this.startHeartbeat();

            // Request sync for all tracked sessions
            this.requestSyncForAllSessions();

            // Resolve connection promise
            if (this.connectionResolver) {
                this.connectionResolver();
                this.connectionResolver = null;
            }
        };

        this.socket.onmessage = (event) => {
            try {
                const raw = JSON.parse(event.data);
                const data = this.normalizeIncomingEvent(raw);
                if (!data) return;

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
            console.log(`[ChatWS] Disconnected (code: ${event.code}, reason: ${event.reason})`);
            this.stopHeartbeat();
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
            console.error('[ChatWS] WebSocket error:', error);
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
            return withEnvelope({
                type: 'client_action',
                sessionId,
                seq,
                data: {
                    message_id: payload.message_id || payload.messageId || messageId,
                    messageId: payload.message_id || payload.messageId || messageId,
                    action: payload.action || payload,
                }
            });
        }
        if (t === 'usage') {
            return withEnvelope({ type: 'usage', sessionId, seq, data: { message_id: messageId, messageId, usage: payload.usage || payload } });
        }
        if (t === 'citation') {
            return withEnvelope({ type: 'citations', sessionId, seq, data: { message_id: messageId, messageId, citations: payload.citations || [] } });
        }
        if (t === 'message_complete') {
            return withEnvelope({ type: 'message_complete', sessionId, seq, data: { message_id: payload.message_id || messageId, messageId: payload.message_id || messageId } });
        }
        if (t === 'error') {
            return withEnvelope({ type: 'error', sessionId, seq, data: { error: payload.message || 'Unknown error' } });
        }
        if (t === 'latency_metrics') {
            return withEnvelope({ type: 'latency_metrics', sessionId, seq, data: payload });
        }
        return null;
    }

    // Wait for connection to be established
    public async waitForConnection(timeout = 5000): Promise<boolean> {
        if (this.socket?.readyState === WebSocket.OPEN) {
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
            console.warn('[ChatWS] Connection wait timed out');
            return false;
        }
    }

    public subscribe(listener: (event: ChatEvent) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Clear all listeners
     */
    public clearListeners() {
        this.listeners.clear();
    }

    public close() {
        this.token = null;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
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
        this.lastReceivedSeq.forEach((_lastSeq, sessionId) => {
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
