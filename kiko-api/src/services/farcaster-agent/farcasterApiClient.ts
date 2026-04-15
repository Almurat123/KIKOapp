// CONTEXT MEMORY
// Updated: 2026-04-15
// Author: Linh Tran
// Reason: Farcaster mention ingress now prefers the dedicated Neynar webhook
//         route when enabled, while this module still owns polling fallback,
//         Hub fallback, and reply publication semantics.
// Goal: keep mention retrieval, cast parsing, and reply publication
//       centralized while preserving deterministic source selection,
//       transient-error recovery, and a webhook-first ingress split.
// Owns: Neynar notification polling fallback, Hub RPC connectivity, endpoint
//       rotation, mention page parsing, cast hydration, and reply cast
//       publication for the Farcaster agent.
// Does Not Own: polling cadence, linked-user policy, conversation mapping, or
//               AI execution.
// Design Language:
// - Prefer webhook-fed ingress when enabled; keep notifications polling only as
//   the fallback path when the webhook is not configured.
// - Hub RPC access must stay centralized, with left-to-right fallback across
//   configured endpoints and then known public peers.
// - Transient RPC cancellation must invalidate the current endpoint so the
//   next request can advance to a different Hub.
// - Mention events should be normalized before the worker sees them.
// - Reply publication must keep parent-cast semantics explicit.
// - Avoid leaking provider-specific payload shapes into the worker.
// Document Provenance:
// - Source: Neynar webhook documentation and notifications API
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: webhook-first mention ingress and polling fallback behavior
// - Verification: verified in code
// - Source: Neynar cast lookup API `lookupCastByHashOrUrl`
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: cast hydration before Hub fallback
// - Verification: verified in code
// - Source: @farcaster/hub-nodejs README and dist typings
// - Kind: local SDK source
// - Retrieved: 2026-04-15
// - Applied To: getCastsByMention, getCast, makeCastAdd, and submitMessage usage
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/kiko-api/src/services/snapchainService.ts
// - Kind: repo doc
// - Retrieved: 2026-04-15
// - Applied To: public Hub RPC fallback ordering for reachability recovery
// - Verification: verified in code
// - Source: /Users/almurat/Downloads/logs.1776233864338.json and
//   /Users/almurat/Downloads/logs.1776233683014.json
// - Kind: runtime observation
// - Retrieved: 2026-04-15
// - Applied To: request-level failover after repeated `Call cancelled` mention
//   polls on the same replica
// - Verification: verified in runtime
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-notifications-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-mention-hub-fallback.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-mention-hub-request-failover.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import {
  CastId,
  CastType,
  FarcasterNetwork,
  FidRequest,
  MessageType,
  NobleEd25519Signer,
  bytesToHexString,
  getInsecureHubRpcClient,
  getSSLHubRpcClient,
  hexStringToBytes,
  makeCastAdd,
  type HubRpcClient,
  type Message,
} from '@farcaster/hub-nodejs';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { FarcasterCastContext, FarcasterMentionEvent, FarcasterSendResult } from './types.js';
import {
  fetchNeynarCastContextByHash,
  fetchNeynarMentionPage,
  hasNeynarNotificationsConfigured,
} from '../neynarService.js';

const DEFAULT_HUB_RPC_URL = 'hub.merv.fun:3381';
const PUBLIC_HUB_FALLBACK_URLS = [
  'http://54.236.164.51:3381',
  'http://54.87.204.167:3381',
  'http://44.197.255.20:3381',
  'http://54.157.62.17:3381',
  'http://34.195.157.114:3381',
  'http://107.20.169.236:3381',
];
const FARCASTER_EPOCH_MS = 1609459200000;
const MAX_PAGE_SIZE = 50;
const HUB_READY_TIMEOUT_MS = 5000;
const HUB_RECEIVE_LIMIT_BYTES = 50 * 1024 * 1024;

interface HubEndpoint {
  address: string;
  useSsl: boolean;
}

interface HubMentionPage {
  messages: Message[];
  events?: FarcasterMentionEvent[] | undefined;
  nextPageToken?: Uint8Array | undefined;
}

let hubClientPromise: Promise<HubRpcClient> | null = null;
let hubClientInstance: HubRpcClient | null = null;
let hubClientEndpointIndex: number | null = null;
let signerCache: NobleEd25519Signer | null = null;

function clampPageSize(value: number): number {
  if (!Number.isFinite(value)) return 15;
  return Math.min(Math.max(Math.trunc(value), 1), MAX_PAGE_SIZE);
}

function normalizeHubEndpoint(raw: string): HubEndpoint {
  const value = String(raw || '').trim() || DEFAULT_HUB_RPC_URL;
  if (/^https?:\/\//i.test(value) || /^grpcs?:\/\//i.test(value)) {
    const url = new URL(value.replace(/^grpc:/i, 'http:').replace(/^grpcs:/i, 'https:'));
    return {
      address: `${url.hostname}${url.port ? `:${url.port}` : ''}`,
      useSsl: url.protocol === 'https:',
    };
  }

  return {
    address: value.replace(/^grpc:\/\//i, '').replace(/^grpcs:\/\//i, ''),
    useSsl: false,
  };
}

function resolveHubEndpoints(rawUrls: string[]): HubEndpoint[] {
  const seen = new Set<string>();
  const endpoints: HubEndpoint[] = [];
  const orderedUrls = [
    ...rawUrls,
    DEFAULT_HUB_RPC_URL,
    ...PUBLIC_HUB_FALLBACK_URLS,
  ];

  for (const raw of orderedUrls) {
    const value = String(raw || '').trim();
    if (!value) continue;
    const endpoint = normalizeHubEndpoint(value);
    const key = `${endpoint.useSsl ? 'ssl' : 'insecure'}:${endpoint.address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    endpoints.push(endpoint);
  }

  if (endpoints.length === 0) {
    endpoints.push(normalizeHubEndpoint(DEFAULT_HUB_RPC_URL));
  }

  return endpoints;
}

function getHubEndpointLabel(endpoint?: HubEndpoint | null): string {
  if (!endpoint) return DEFAULT_HUB_RPC_URL;
  return `${endpoint.useSsl ? 'grpcs' : 'grpc'}://${endpoint.address}`;
}

function isTransientHubRpcError(error: unknown): boolean {
  const message = String((error as any)?.message || error || '').toLowerCase();
  const code = Number((error as any)?.code ?? (error as any)?.status ?? NaN);
  return (
    message.includes('call cancelled')
    || message.includes('cancelled')
    || message.includes('deadline exceeded')
    || message.includes('no connection established')
    || message.includes('unavailable')
    || code === 1
    || code === 4
    || code === 14
  );
}

function closeCurrentHubClient(): void {
  if (hubClientInstance) {
    hubClientInstance.close();
  }
  hubClientInstance = null;
  hubClientPromise = null;
}

function advanceHubEndpointCursor(): void {
  const endpoints = resolveHubEndpoints(env.farcasterAgent.hubRpcUrls);
  if (endpoints.length === 0) {
    hubClientEndpointIndex = null;
    return;
  }

  const nextIndex = hubClientEndpointIndex === null
    ? 0
    : (hubClientEndpointIndex + 1) % endpoints.length;
  hubClientEndpointIndex = nextIndex;
}

function waitForHubReady(client: HubRpcClient): Promise<void> {
  return new Promise((resolve, reject) => {
    client.$.waitForReady(Date.now() + HUB_READY_TIMEOUT_MS, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function getHubClient(): Promise<HubRpcClient> {
  if (!hubClientPromise) {
    hubClientPromise = (async () => {
      const endpoints = resolveHubEndpoints(env.farcasterAgent.hubRpcUrls);
      const startIndex = endpoints.length === 0 || hubClientEndpointIndex === null
        ? 0
        : Math.max(0, Math.min(hubClientEndpointIndex, endpoints.length - 1));
      const orderedEndpoints = [
        ...endpoints.slice(startIndex),
        ...endpoints.slice(0, startIndex),
      ];

      for (let offset = 0; offset < orderedEndpoints.length; offset += 1) {
        const endpoint = orderedEndpoints[offset];
        const client = endpoint.useSsl
          ? getSSLHubRpcClient(endpoint.address, { 'grpc.max_receive_message_length': HUB_RECEIVE_LIMIT_BYTES })
          : getInsecureHubRpcClient(endpoint.address, { 'grpc.max_receive_message_length': HUB_RECEIVE_LIMIT_BYTES });

        try {
          await waitForHubReady(client);
          hubClientInstance = client;
          hubClientEndpointIndex = (startIndex + offset) % endpoints.length;
          logger.info(LogCode.SYS_INFO, '[Farcaster] Snapchain Hub RPC ready', {
            hubRpcUrl: getHubEndpointLabel(endpoint),
            useSsl: endpoint.useSsl,
          });
          return client;
        } catch (error) {
          client.close();
          logger.warn(LogCode.API_FETCH_FAILED, '[Farcaster] Hub RPC endpoint unavailable, trying next fallback', {
            hubRpcUrl: getHubEndpointLabel(endpoint),
            useSsl: endpoint.useSsl,
            error: String((error as any)?.message || error || 'unknown_error'),
          });
        }
      }

      throw new Error('No configured Farcaster Hub RPC endpoints are available');
    })().catch((error) => {
      hubClientPromise = null;
      throw error;
    });
  }

  return hubClientPromise;
}

export function closeHubClient(): void {
  closeCurrentHubClient();
  hubClientEndpointIndex = null;
  signerCache = null;
}

async function runHubRequestWithFailover<T>(
  operationName: string,
  operation: (client: HubRpcClient) => Promise<T>,
): Promise<T> {
  const endpoints = resolveHubEndpoints(env.farcasterAgent.hubRpcUrls);
  if (endpoints.length === 0) {
    throw new Error('No configured Farcaster Hub RPC endpoints are available');
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < endpoints.length; attempt += 1) {
    const client = await getHubClient();
    try {
      return await operation(client);
    } catch (error) {
      lastError = error;
      if (!isTransientHubRpcError(error) || attempt === endpoints.length - 1) {
        throw error;
      }

      logger.warn(LogCode.API_FETCH_FAILED, `[Farcaster] ${operationName} failed on active Hub, rotating fallback`, {
        hubRpcUrl: getHubEndpointLabel(resolveHubEndpoints(env.farcasterAgent.hubRpcUrls)[hubClientEndpointIndex ?? 0] || null),
        error: String((error as any)?.message || error || 'unknown_error'),
      });

      closeCurrentHubClient();
      advanceHubEndpointCursor();
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'unknown_error'));
}

function getSigner(): NobleEd25519Signer {
  if (!signerCache) {
    const privateKeyResult = hexStringToBytes(String(env.farcasterAgent.signerPrivateKey || '').trim());
    if (privateKeyResult.isErr()) {
      throw new Error('Invalid FARCASTER_SIGNER_PRIVATE_KEY value');
    }
    signerCache = new NobleEd25519Signer(privateKeyResult.value);
  }
  return signerCache;
}

function asHexString(bytes?: Uint8Array | null): string | null {
  if (!bytes || bytes.length === 0) return null;
  const result = bytesToHexString(bytes);
  return result.isOk() ? result.value : null;
}

function asBytes(hex: string): Uint8Array | null {
  const normalized = String(hex || '').trim();
  if (!normalized) return null;
  const result = hexStringToBytes(normalized.startsWith('0x') ? normalized : `0x${normalized}`);
  return result.isOk() ? result.value : null;
}

function currentFarcasterTimestamp(): number {
  return Math.max(1, Math.floor((Date.now() - FARCASTER_EPOCH_MS) / 1000));
}

function timestampToIso(timestamp?: number | null): string | null {
  if (!Number.isFinite(Number(timestamp))) return null;
  return new Date(FARCASTER_EPOCH_MS + Number(timestamp) * 1000).toISOString();
}

function messageToCastContext(message: Message): FarcasterCastContext | null {
  const data = message.data;
  const castAddBody = data?.castAddBody;
  const castHash = asHexString(message.hash);
  const text = String(castAddBody?.text || '').trim();
  const authorFid = Number(data?.fid || 0);

  if (!data || data.type !== MessageType.CAST_ADD || !castAddBody || !castHash || !text || !Number.isFinite(authorFid) || authorFid <= 0) {
    return null;
  }

  const parentCastId = castAddBody.parentCastId || undefined;
  const parentHash = parentCastId ? asHexString(parentCastId.hash) : null;

  return {
    hash: castHash,
    text,
    authorFid,
    authorUsername: null,
    parentHash,
    parentAuthorFid: parentCastId?.fid || null,
    timestamp: timestampToIso(data.timestamp),
  };
}

export function parseHubMentionEvents(payload: HubMentionPage): FarcasterMentionEvent[] {
  if (payload.events && payload.events.length > 0) {
    return payload.events;
  }

  const events: FarcasterMentionEvent[] = [];

  for (const message of payload.messages || []) {
    const context = messageToCastContext(message);
    if (!context) continue;
    const authorFid = Number(context.authorFid || 0);
    if (!Number.isFinite(authorFid) || authorFid <= 0) continue;
    events.push({
      eventId: `farcaster:mention:${context.hash}`,
      notificationType: 'mentions',
      castHash: context.hash,
      text: context.text,
      authorFid,
      authorUsername: context.authorUsername || null,
      parentHash: context.parentHash || null,
      parentAuthorFid: context.parentAuthorFid || null,
      rootCastHash: context.parentHash || context.hash,
      occurredAt: context.timestamp || null,
    });
  }

  return events;
}

export class FarcasterApiClient {
  isConfigured(): boolean {
    return Boolean(
      env.farcasterAgent.enabled
      && Number(env.farcasterAgent.botFid) > 0
      && String(env.farcasterAgent.signerPrivateKey || '').trim()
      && env.farcasterAgent.hubRpcUrls.length > 0,
    );
  }

  async fetchMentionPage(params?: { pageToken?: Uint8Array | null; pageSize?: number }): Promise<HubMentionPage> {
    const neynarPage = await fetchNeynarMentionPage({
      fid: env.farcasterAgent.botFid,
      cursor: params?.pageToken ? Buffer.from(params.pageToken).toString('utf8') : null,
      limit: clampPageSize(params?.pageSize ?? env.farcasterAgent.pollPageSize),
    });

    if (neynarPage) {
      return {
        events: neynarPage.events,
        nextPageToken: neynarPage.nextCursor ? Buffer.from(neynarPage.nextCursor, 'utf8') : undefined,
        messages: [],
      };
    }

    return runHubRequestWithFailover('mention fetch', async (client) => {
      const response = await client.getCastsByMention(
        FidRequest.create({
          fid: env.farcasterAgent.botFid,
          pageSize: clampPageSize(params?.pageSize ?? env.farcasterAgent.pollPageSize),
          pageToken: params?.pageToken || undefined,
          reverse: true,
        }),
      );

      if (response.isErr()) {
        throw response.error;
      }

      return response.value;
    });
  }

  async fetchCastByHash(params: { fid: number; hash: string }): Promise<FarcasterCastContext | null> {
    const neynarCast = await fetchNeynarCastContextByHash({
      hash: params.hash,
      viewerFid: params.fid,
    });
    if (neynarCast) {
      return neynarCast;
    }

    return runHubRequestWithFailover('cast fetch', async (client) => {
      const castHash = asBytes(params.hash);
      if (!castHash || !Number.isFinite(params.fid) || params.fid <= 0) return null;

      const response = await client.getCast(
        CastId.create({
          fid: params.fid,
          hash: castHash,
        }),
      );

      if (response.isErr()) {
        return null;
      }

      return messageToCastContext(response.value);
    });
  }

  async publishCastReply(params: {
    text: string;
    parentHash: string;
    parentAuthorFid: number;
    idem: string;
  }): Promise<FarcasterSendResult> {
    return runHubRequestWithFailover('cast reply publish', async (client) => {
      const parentHash = asBytes(params.parentHash);
      if (!parentHash) {
        throw new Error('Invalid parent hash for Farcaster reply');
      }

      const signer = getSigner();
      const reply = await makeCastAdd(
        {
          text: params.text,
          embedsDeprecated: [],
          mentions: [],
          parentCastId: {
            fid: params.parentAuthorFid,
            hash: parentHash,
          },
          parentUrl: undefined,
          mentionsPositions: [],
          embeds: [],
          type: CastType.CAST,
        },
        {
          fid: env.farcasterAgent.botFid,
          network: FarcasterNetwork.MAINNET,
          timestamp: currentFarcasterTimestamp(),
        },
        signer,
      );

      if (reply.isErr()) {
        throw reply.error;
      }

      const submitted = await client.submitMessage(reply.value);
      if (submitted.isErr()) {
        throw submitted.error;
      }

      return {
        hash: asHexString(submitted.value.hash),
        raw: submitted.value,
      };
    });
  }
}

export const farcasterApiClient = new FarcasterApiClient();
