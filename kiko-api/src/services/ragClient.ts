import { fetchJson } from '../config/unifiedApiService.js';
import * as dotenv from 'dotenv';

dotenv.config();
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8002';

interface RAGResult {
    content: string;
    metadata: {
        source: string;
        title: string;
        [key: string]: any;
    };
    score: number;
}

interface RAGResponse {
    results: RAGResult[];
}

export class RAGClient {
    private static instance: RAGClient;
    private baseUrl: string;

    private constructor() {
        this.baseUrl = RAG_SERVICE_URL;
    }

    public static getInstance(): RAGClient {
        if (!RAGClient.instance) {
            RAGClient.instance = new RAGClient();
        }
        return RAGClient.instance;
    }

    /**
     * Retrieve relevant context for a query.
     */
    public async query(text: string, k: number = 3): Promise<string> {
        try {
            logger.debug(LogCode.SYS_INFO, 'RAGClient: Querying', { text, k });

            const response = await fetchJson<RAGResponse>({
                url: `${this.baseUrl}/query`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: text,
                    k: k
                }),
                timeout: 3000 // Fast timeout, don't block chat too long
            });

            const results = response.results;

            if (!results || results.length === 0) {
                return '';
            }

            // Format context string
            const contextParts = results.map((r, i) => {
                const title = r.metadata.title || 'Document';
                const source = r.metadata.source || 'Unknown Source';
                return `[Source ${i + 1}: ${title} (${source})]\n${r.content}`;
            });

            return contextParts.join('\n\n');

        } catch (error: any) {
            logger.warn(LogCode.API_FETCH_FAILED, 'RAGClient: Query failed (skipping RAG)', { error: error.message });
            return '';
        }
    }

    /**
     * Trigger ingestion (admin/background task).
     */
    public async ingest(url: string): Promise<boolean> {
        try {
            await fetchJson({
                url: `${this.baseUrl}/ingest`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            return true;
        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'RAGClient: Ingest failed', { url, error: error.message });
            return false;
        }
    }
}

export const ragClient = RAGClient.getInstance();
