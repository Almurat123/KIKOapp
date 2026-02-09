/**
 * Chat WebSocket Client
 * Manages connection to backend chat WebSocket
 */

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export type ChatEventType = 'chunk' | 'content_block' | 'task_status' | 'message_complete' | 'message_start' | 'error' | 'pong' | 'usage' | 'citations' | 'client_action' | 'sync_complete' | 'transaction_update' | 'transaction_confirmed' | 'transaction_complete';

export interface ChatEvent {
    type: ChatEventType;
    sessionId: string;
    data: any;
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
        // Don't reconnect if already connecting or connected with the same token
        if (this.socket && this.token === token &&
            (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            console.log(`[ChatWS] Already connecting/connected to user WebSocket`);
            return;
        }

        this.close();
        this.token = token;

        // Create connection promise
        this.connectionPromise = new Promise<void>((resolve) => {
            this.connectionResolver = resolve;
        });

        // Use query param for token as standard WebSocket API doesn't support headers during handshake
        const url = `${WS_BASE_URL}/api/chat/ws?token=${encodeURIComponent(token)}`;
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
                const data = JSON.parse(event.data) as ChatEvent;

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
            // Auto-reconnect if token is still valid
            if (this.token === token && event.code !== 1008) { // 1008 is policy violation (usually auth failure)
                this.reconnectTimeout = setTimeout(() => this.connect(token), 3000);
            }
        };

        this.socket.onerror = (error) => {
            console.error('[ChatWS] WebSocket error:', error);
        };
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
