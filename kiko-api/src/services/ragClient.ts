import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

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
            console.log(`[RAGClient] Querying: "${text}"`);

            const response = await axios.post<RAGResponse>(`${this.baseUrl}/query`, {
                query: text,
                k: k
            }, { timeout: 3000 }); // Fast timeout, don't block chat too long

            const results = response.data.results;

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
            console.warn(`[RAGClient] Query failed (skipping RAG): ${error.message}`);
            return '';
        }
    }

    /**
     * Trigger ingestion (admin/background task).
     */
    public async ingest(url: string): Promise<boolean> {
        try {
            await axios.post(`${this.baseUrl}/ingest`, { url });
            return true;
        } catch (error) {
            console.error('[RAGClient] Ingest failed:', error);
            return false;
        }
    }
}

export const ragClient = RAGClient.getInstance();
