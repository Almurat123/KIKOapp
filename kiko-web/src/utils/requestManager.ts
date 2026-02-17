/**
 * Request Manager
 * Manages API requests with:
 * - Request queue (limits concurrent requests)
 * - Request deduplication
 * - Request cancellation
 * - Request throttling/delays
 */

interface PendingRequest {
  id: string;
  promise: Promise<any>;
  abortController: AbortController;
  timestamp: number;
}

interface RequestOptions {
  delay?: number; // Delay before executing request
  priority?: number; // Higher priority = executed first
  timeout?: number; // Request timeout in ms
}

class RequestManager {
  private maxConcurrent: number;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestQueue: Array<{
    id: string;
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    options: RequestOptions;
  }> = [];
  private activeRequests: Set<string> = new Set();
  private requestCache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL: number = 5000; // 5 seconds default cache

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Execute a request with queue management
   */
  async execute<T>(
    id: string,
    requestFn: (signal: AbortSignal) => Promise<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    // Check cache first
    const cached = this.requestCache.get(id);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    // Check if request is already pending
    const existing = this.pendingRequests.get(id);
    if (existing) {
      return existing.promise;
    }

    // Create abort controller
    const abortController = new AbortController();

    // Create promise
    const promise = new Promise<T>((resolve, reject) => {
      // Add to queue
      this.requestQueue.push({
        id,
        fn: async () => {
          try {
            // Apply delay if specified
            if (options.delay) {
              await this.delay(options.delay);
            }

            // Check if cancelled
            if (abortController.signal.aborted) {
              throw new Error('Request cancelled');
            }

            // Execute request with timeout
            const result = await this.withTimeout(
              requestFn(abortController.signal),
              options.timeout || 30000
            );

            // Cache result
            this.requestCache.set(id, {
              data: result,
              timestamp: Date.now(),
            });

            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            // Clean up
            this.pendingRequests.delete(id);
            this.activeRequests.delete(id);
            this.processQueue();
          }
        },
        resolve,
        reject,
        options,
      });

    });

    // Store pending request
    this.pendingRequests.set(id, {
      id,
      promise: promise as Promise<any>,
      abortController,
      timestamp: Date.now(),
    });

    // Process queue
    this.processQueue();

    return promise;
  }

  /**
   * Process the request queue
   */
  private processQueue() {
    // Sort queue by priority (higher priority first)
    this.requestQueue.sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));

    // Execute requests up to maxConcurrent limit
    while (
      this.activeRequests.size < this.maxConcurrent &&
      this.requestQueue.length > 0
    ) {
      const item = this.requestQueue.shift();
      if (!item) break;

      // Check if already cancelled
      const pending = this.pendingRequests.get(item.id);
      if (!pending || pending.abortController.signal.aborted) {
        item.reject(new Error('Request cancelled'));
        continue;
      }

      this.activeRequests.add(item.id);

      item
        .fn()
        .then(item.resolve)
        .catch(item.reject);
    }
  }

  /**
   * Cancel a specific request
   */
  cancel(id: string) {
    const pending = this.pendingRequests.get(id);
    if (pending) {
      pending.abortController.abort();
      this.pendingRequests.delete(id);
      this.activeRequests.delete(id);

      // Remove from queue if present
      const queueIndex = this.requestQueue.findIndex((item) => item.id === id);
      if (queueIndex !== -1) {
        const item = this.requestQueue[queueIndex];
        this.requestQueue.splice(queueIndex, 1);
        item.reject(new Error('Request cancelled'));
      }
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAll() {
    const ids = Array.from(this.pendingRequests.keys());
    ids.forEach((id) => this.cancel(id));
  }

  /**
   * Clear request cache
   */
  clearCache() {
    this.requestCache.clear();
  }

  /**
   * Set cache TTL
   */
  setCacheTTL(ttl: number) {
    this.cacheTTL = ttl;
  }

  /**
   * Get active request count
   */
  getActiveCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.requestQueue.length;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Timeout wrapper
   */
  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Request timeout')), timeout);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  }
}

// Export singleton instance
export const requestManager = new RequestManager(3);

// Export class for custom instances
export { RequestManager };
