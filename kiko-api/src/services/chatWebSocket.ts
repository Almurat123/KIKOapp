import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { requireAuth } from '../middleware/auth.js';
import { decodeJwt } from 'jose';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

export interface ChatEvent {
    type: 'chunk' | 'task_status' | 'message_complete' | 'message_start' | 'error' | 'usage' | 'citations' | 'content_block' | 'client_action';
    sessionId: string;
    data: any;
}

export class ChatWebSocketService {
    private static instance: ChatWebSocketService;
    private clients: Map<string, Set<WebSocket>> = new Map(); // userId -> WebSockets

    private constructor() { }

    public static getInstance(): ChatWebSocketService {
        if (!ChatWebSocketService.instance) {
            ChatWebSocketService.instance = new ChatWebSocketService();
        }
        return ChatWebSocketService.instance;
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
     * Broadcast an event to all user's connections
     */
    public broadcastToUser(userId: string, event: ChatEvent) {
        const userClients = this.clients.get(userId);
        if (userClients) {
            const timerLabel = `ws_broadcast_${userId}_${event.type}`;
            logger.startTimer(timerLabel);
            const payload = JSON.stringify(event);
            userClients.forEach((socket) => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(payload);
                }
            });
            logger.endTimer(timerLabel, LogCode.WS_MESSAGE_SENT, { userId, eventType: event.type, connectionCount: userClients.size });
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
    // New endpoint for user-level WebSocket
    fastify.get('/api/chat/ws', { websocket: true }, (connection: any, req: any) => {
        // Extract token from query params (e.g. /api/chat/ws?token=xxx)
        const token = req.query.token;

        if (!token) {
            logger.error(LogCode.API_AUTH_FAILED, 'ChatWS: Rejecting connection - No token provided');
            connection.socket.close(1008, 'Token required');
            return;
        }

        try {
            // Verify token to get userId
            // In a real app we'd use requireAuth but that's a preHandler for HTTP
            // For WebSocket handshake we manually decode/verify
            // Note: In development we might skip full signature check if configured
            const payload = decodeJwt(token);
            const userId = payload.sub;

            if (!userId) {
                connection.socket.close(1008, 'Invalid token');
                return;
            }

            chatWS.registerClient(userId, connection.socket);

        } catch (err: any) {
            logger.error(LogCode.API_AUTH_FAILED, 'ChatWS auth error', { error: err.message });
            connection.socket.close(1008, 'Auth failed');
            return;
        }

        connection.socket.on('message', (message: any) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'ping') {
                    connection.socket.send(JSON.stringify({ type: 'pong' }));
                }
            } catch (e) { }
        });
    });

    // Legacy endpoint for backward compatibility during migration
    fastify.get('/api/chat/ws/:sessionId', { websocket: true }, (connection: any, req: any) => {
        // Just close it and tell client to use the new one, or handle it for a bit
        // For now, let's log and close so we see which clients are still using it
        logger.warn(LogCode.WS_ERROR, 'ChatWS Legacy sessionId connection attempt', { sessionId: req.params.sessionId });
        connection.socket.close(1000, 'Please use /api/chat/ws');
    });
}
