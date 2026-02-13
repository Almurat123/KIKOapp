import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { verifyPrivyToken } from '../middleware/auth.js';
import { decodeJwt } from 'jose';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import * as chatRepo from '../repositories/chatRepository.js';

export interface ChatEvent {
    type: 'chunk' | 'task_status' | 'message_complete' | 'message_start' | 'error' | 'usage' | 'citations' | 'content_block' | 'client_action' | 'transaction_update' | 'transaction_confirmed' | 'transaction_complete' | 'latency_metrics';
    sessionId?: string; // Optional because some events are user-level
    messageId?: string;
    status?: string;
    txHash?: string;
    error?: string;
    data: any;
}

// Sequenced event with sequence number for reliable delivery
export interface SequencedChatEvent extends ChatEvent {
    seq: number;  // Per-session sequence number
}

// Client message types
interface ClientMessage {
    type: 'ping' | 'ack' | 'sync';
    sessionId?: string;
    seq?: number;      // For ack: the sequence number being acknowledged
    lastSeq?: number;  // For sync: the last received sequence number
}

// Buffer entry for unacknowledged messages
interface BufferedMessage {
    event: SequencedChatEvent;
    timestamp: number;
}

export class ChatWebSocketService {
    private static instance: ChatWebSocketService;
    private clients: Map<string, Set<WebSocket>> = new Map(); // userId -> WebSockets

    // Sequence tracking: sessionId -> current sequence number
    private sessionSequences: Map<string, number> = new Map();

    // Message buffer for reliable delivery: sessionId -> buffered messages
    private messageBuffer: Map<string, BufferedMessage[]> = new Map();
    private readonly MAX_BUFFER_SIZE = 100;  // Max messages per session
    private readonly BUFFER_TTL_MS = 60000;  // 60 seconds TTL for buffered messages

    private constructor() {
        // Periodically clean up old buffered messages
        setInterval(() => this.cleanupBuffers(), 30000);

        // Fix 5: Cleanup session sequences (Memory Leak)
        setInterval(() => {
            // Check usage timestamp if we had one, for now just clear very old ones or rely on connection status?
            // Since we don't track last access time for sequences, let's at least cap the map size
            if (this.sessionSequences.size > 10000) {
                logger.warn(LogCode.WS_ERROR, 'Session sequence map too large, purging old entries...');
                this.sessionSequences.clear(); // Hard reset if too big to prevent OOM
            }
        }, 3600000); // Check every hour
    }

    public static getInstance(): ChatWebSocketService {
        if (!ChatWebSocketService.instance) {
            ChatWebSocketService.instance = new ChatWebSocketService();
        }
        return ChatWebSocketService.instance;
    }

    /**
     * Get next sequence number for a session
     */
    private getNextSequence(sessionId: string): number {
        const current = this.sessionSequences.get(sessionId) || 0;
        const next = current + 1;
        this.sessionSequences.set(sessionId, next);
        return next;
    }

    /**
     * Buffer a message for potential retransmission
     */
    private bufferMessage(sessionId: string, event: SequencedChatEvent) {
        if (!this.messageBuffer.has(sessionId)) {
            this.messageBuffer.set(sessionId, []);
        }
        const buffer = this.messageBuffer.get(sessionId)!;
        buffer.push({ event, timestamp: Date.now() });

        // Enforce max buffer size (FIFO)
        while (buffer.length > this.MAX_BUFFER_SIZE) {
            buffer.shift();
        }
    }

    /**
     * Get buffered messages after a specific sequence
     */
    public getBufferedMessagesAfter(sessionId: string, afterSeq: number): SequencedChatEvent[] {
        const buffer = this.messageBuffer.get(sessionId) || [];
        return buffer
            .filter(b => b.event.seq > afterSeq)
            .map(b => b.event);
    }

    /**
     * Clean up old buffered messages
     */
    private cleanupBuffers() {
        const now = Date.now();
        this.messageBuffer.forEach((buffer, sessionId) => {
            const filtered = buffer.filter(b => now - b.timestamp < this.BUFFER_TTL_MS);
            if (filtered.length === 0) {
                this.messageBuffer.delete(sessionId);
            } else {
                this.messageBuffer.set(sessionId, filtered);
            }
        });
    }

    /**
     * Register a new client connection for a user
     */
    public registerClient(userId: string, socket: WebSocket) {
        if (!this.clients.has(userId)) {
            this.clients.set(userId, new Set());
        }
        this.clients.get(userId)!.add(socket);

        socket.on('close', () => {
            this.unregisterClient(userId, socket);
        });

        logger.info(LogCode.WS_CONNECTION_OPENED, 'ChatWS Client connected', { userId, totalConnections: this.clients.get(userId)!.size });
    }

    /**
     * Unregister a client connection
     */
    private unregisterClient(userId: string, socket: WebSocket) {
        const userClients = this.clients.get(userId);
        if (userClients) {
            userClients.delete(socket);
            if (userClients.size === 0) {
                this.clients.delete(userId);
            }
        }
    }

    /**
     * Handle client messages (ack, sync, ping)
     */
    public async handleClientMessage(userId: string, socket: WebSocket, message: ClientMessage) {
        if (message.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong' }));
        } else if (message.type === 'ack' && message.sessionId && message.seq) {
            // ACK received - currently we just log it, could be used for flow control
            // In future: remove from pending-ack queue
            logger.debug(LogCode.WS_MESSAGE_SENT, 'ACK received', {
                userId,
                sessionId: message.sessionId,
                seq: message.seq
            });
        } else if (message.type === 'sync' && message.sessionId) {
            // Client requesting sync after reconnection
            const lastSeq = message.lastSeq || 0;
            logger.info(LogCode.WS_CONNECTION_OPENED, 'Sync request', {
                userId,
                sessionId: message.sessionId,
                lastSeq
            });

            // First, send buffered messages from memory
            const buffered = this.getBufferedMessagesAfter(message.sessionId, lastSeq);
            if (buffered.length > 0) {
                logger.info(LogCode.WS_MESSAGE_SENT, 'Sending buffered messages', {
                    count: buffered.length,
                    sessionId: message.sessionId
                });
                buffered.forEach(event => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify(event));
                    }
                });
            }

            // Signal sync complete
            socket.send(JSON.stringify({
                type: 'sync_complete',
                sessionId: message.sessionId,
                bufferedCount: buffered.length
            }));
        }
    }

    /**
     * Broadcast an event to all user's connections with sequence number
     */
    public broadcastToUser(userId: string, event: ChatEvent) {
        const userClients = this.clients.get(userId);
        if (userClients) {
            // Skip logging for high-frequency 'chunk' events to prevent console flooding
            const isHighFreq = event.type === 'chunk';
            const timerLabel = `ws_broadcast_${userId}_${event.type}`;

            if (!isHighFreq) {
                logger.startTimer(timerLabel);
            }

            // Add sequence number if session-scoped
            let payload: string;
            if (event.sessionId) {
                const seq = this.getNextSequence(event.sessionId);
                const sequencedEvent: SequencedChatEvent = { ...event, seq };
                payload = JSON.stringify(sequencedEvent);

                // Buffer for potential retransmission
                this.bufferMessage(event.sessionId, sequencedEvent);
            } else {
                payload = JSON.stringify(event);
            }

            userClients.forEach((socket) => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(payload);
                }
            });

            if (!isHighFreq) {
                logger.endTimer(timerLabel, LogCode.WS_MESSAGE_SENT, { userId, eventType: event.type, connectionCount: userClients.size });
            }
        }
    }

    /**
     * @deprecated Use broadcastToUser
     */
    public broadcast(sessionId: string, event: ChatEvent) {
        // Fallback for transition period - will be removed once all workers use broadcastToUser
        this.clients.forEach((sockets, userId) => {
            const payload = JSON.stringify(event);
            sockets.forEach(socket => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(payload);
                }
            });
        });
    }
}

export const chatWS = ChatWebSocketService.getInstance();


/**
 * Fastify plugin to set up WebSocket route
 */
export async function chatWSRoutes(fastify: FastifyInstance) {
    const handleUserWs = async (connection: any, req: any) => {
        // Extract token from query params (e.g. /api/chat/ws?token=xxx)
        const token = req.query.token;

        if (!token) {
            logger.error(LogCode.API_AUTH_FAILED, 'ChatWS: Rejecting connection - No token provided');
            connection.socket.close(1008, 'Token required');
            return;
        }

        try {
            // Verify token with full signature + expiration check
            const payload = await verifyPrivyToken(token);
            const userId = payload.sub;

            if (!userId) {
                logger.error(LogCode.API_AUTH_FAILED, 'ChatWS: Token missing sub claim');
                connection.socket.close(1008, 'Invalid token');
                return;
            }

            chatWS.registerClient(userId, connection.socket);

            // Log successful connection
            logger.info(LogCode.WS_CONNECTION_OPENED, 'ChatWS: User connected', {
                userId: userId.substring(0, 25) + '...',
                tokenExp: payload.exp
            });

        } catch (err: any) {
            const errorCode = err?.code || 'AUTH_FAILED';
            const errorMsg = err?.message || 'Auth failed';
            logger.error(LogCode.API_AUTH_FAILED, 'ChatWS auth error', {
                error: errorMsg,
                code: errorCode
            });

            // Send specific error code for expired tokens
            if (errorCode === 'TOKEN_EXPIRED') {
                connection.socket.close(4001, 'Token expired - please refresh');
            } else {
                connection.socket.close(1008, 'Auth failed');
            }
            return;
        }

        connection.socket.on('message', (message: any) => {
            try {
                const data = JSON.parse(message.toString());
                // Get userId from the connection context (stored during auth)
                const payload = decodeJwt(token);
                const userId = payload.sub as string;

                // Handle all message types through the centralized handler
                chatWS.handleClientMessage(userId, connection.socket, data);
            } catch (e) {
                // Ignore parse errors
            }
        });
    };

    // New endpoint for user-level WebSocket
    fastify.get('/api/chat/ws', { websocket: true }, handleUserWs);
    // v2 compatibility path (frontend now uses /v2/chat/ws)
    fastify.get('/v2/chat/ws', { websocket: true }, handleUserWs);

    // Legacy endpoint for backward compatibility during migration
    fastify.get('/api/chat/ws/:sessionId', { websocket: true }, (connection: any, req: any) => {
        // Just close it and tell client to use the new one, or handle it for a bit
        // For now, let's log and close so we see which clients are still using it
        logger.warn(LogCode.WS_ERROR, 'ChatWS Legacy sessionId connection attempt', { sessionId: req.params.sessionId });
        connection.socket.close(1000, 'Please use /api/chat/ws');
    });
}
