import dns from 'node:dns/promises';
import net, { BlockList } from 'node:net';

type AddressFamily = 4 | 6;

export type HostResolution = {
    address: string;
    family: AddressFamily;
};

export type ResolveHostname = (hostname: string) => Promise<HostResolution[]>;

type ValidateOutboundUrlOptions = {
    resolveHostname?: ResolveHostname;
};

type FetchWithUrlSafetyOptions = ValidateOutboundUrlOptions & {
    fetchImpl?: typeof fetch;
    maxRedirects?: number;
};

const blockedAddresses = new BlockList();

// Non-public IPv4 ranges.
blockedAddresses.addSubnet('0.0.0.0', 8, 'ipv4');
blockedAddresses.addSubnet('10.0.0.0', 8, 'ipv4');
blockedAddresses.addSubnet('100.64.0.0', 10, 'ipv4');
blockedAddresses.addSubnet('127.0.0.0', 8, 'ipv4');
blockedAddresses.addSubnet('169.254.0.0', 16, 'ipv4');
blockedAddresses.addSubnet('172.16.0.0', 12, 'ipv4');
blockedAddresses.addSubnet('192.0.0.0', 24, 'ipv4');
blockedAddresses.addSubnet('192.0.2.0', 24, 'ipv4');
blockedAddresses.addSubnet('192.168.0.0', 16, 'ipv4');
blockedAddresses.addSubnet('198.18.0.0', 15, 'ipv4');
blockedAddresses.addSubnet('198.51.100.0', 24, 'ipv4');
blockedAddresses.addSubnet('203.0.113.0', 24, 'ipv4');
blockedAddresses.addSubnet('224.0.0.0', 4, 'ipv4');
blockedAddresses.addSubnet('240.0.0.0', 4, 'ipv4');

// Non-public IPv6 ranges.
blockedAddresses.addSubnet('::', 128, 'ipv6');
blockedAddresses.addSubnet('::1', 128, 'ipv6');
blockedAddresses.addSubnet('fc00::', 7, 'ipv6');
blockedAddresses.addSubnet('fe80::', 10, 'ipv6');
blockedAddresses.addSubnet('ff00::', 8, 'ipv6');

const blockedHostnames = new Set([
    'localhost',
    'metadata',
    'metadata.google.internal',
]);

const blockedHostnameSuffixes = [
    '.localhost',
    '.local',
];

const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);

export class OutboundUrlSafetyError extends Error {
    public readonly code = 'OUTBOUND_URL_UNSAFE';

    constructor(message: string) {
        super(message);
        this.name = 'OutboundUrlSafetyError';
        Object.setPrototypeOf(this, OutboundUrlSafetyError.prototype);
    }
}

async function defaultResolveHostname(hostname: string): Promise<HostResolution[]> {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    return addresses
        .map((entry) => ({ address: entry.address, family: entry.family as AddressFamily }))
        .filter((entry) => entry.family === 4 || entry.family === 6);
}

function normalizeIpAddress(address: string): string {
    const normalized = address.replace(/^\[|\]$/g, '').trim().toLowerCase();
    if (normalized.startsWith('::ffff:')) {
        const embedded = normalized.slice('::ffff:'.length);
        if (net.isIP(embedded) === 4) {
            return embedded;
        }
    }
    return normalized;
}

function assertPublicIpAddress(address: string): void {
    const normalized = normalizeIpAddress(address);
    const family = net.isIP(normalized);
    if (family !== 4 && family !== 6) {
        throw new OutboundUrlSafetyError(`Resolved hostname to invalid IP address: ${address}`);
    }
    if (blockedAddresses.check(normalized, family === 4 ? 'ipv4' : 'ipv6')) {
        throw new OutboundUrlSafetyError(`Resolved hostname to disallowed IP address: ${address}`);
    }
}

function cloneInitForRedirect(init: RequestInit, status: number): RequestInit {
    const method = (init.method || 'GET').toUpperCase();
    if (status === 303 || ((status === 301 || status === 302) && method !== 'GET' && method !== 'HEAD')) {
        return {
            ...init,
            method: 'GET',
            body: undefined,
        };
    }
    return { ...init };
}

export async function assertSafeOutboundUrl(
    input: string | URL,
    options: ValidateOutboundUrlOptions = {},
): Promise<URL> {
    let parsed: URL;
    try {
        parsed = input instanceof URL ? new URL(input.toString()) : new URL(String(input).trim());
    } catch {
        throw new OutboundUrlSafetyError('Invalid outbound URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new OutboundUrlSafetyError('Only http and https outbound URLs are allowed');
    }

    if (parsed.username || parsed.password) {
        throw new OutboundUrlSafetyError('Embedded URL credentials are not allowed');
    }

    const hostname = parsed.hostname.trim().toLowerCase();
    if (!hostname) {
        throw new OutboundUrlSafetyError('Outbound URL hostname is required');
    }

    if (net.isIP(hostname)) {
        throw new OutboundUrlSafetyError('Direct IP outbound URLs are not allowed');
    }

    if (blockedHostnames.has(hostname) || blockedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix))) {
        throw new OutboundUrlSafetyError(`Outbound hostname is not allowed: ${hostname}`);
    }

    const resolveHostname = options.resolveHostname || defaultResolveHostname;
    const addresses = await resolveHostname(hostname);
    if (!addresses.length) {
        throw new OutboundUrlSafetyError(`Unable to resolve outbound hostname: ${hostname}`);
    }

    for (const entry of addresses) {
        assertPublicIpAddress(entry.address);
    }

    return parsed;
}

export async function fetchWithUrlSafety(
    input: string | URL,
    init: RequestInit = {},
    options: FetchWithUrlSafetyOptions = {},
): Promise<Response> {
    const fetchImpl = options.fetchImpl || fetch;
    let currentUrl = await assertSafeOutboundUrl(input, options);
    let requestInit: RequestInit = {
        ...init,
        redirect: 'manual',
    };
    let remainingRedirects = options.maxRedirects ?? 3;

    while (true) {
        const response = await fetchImpl(currentUrl.toString(), requestInit);
        if (!redirectStatusCodes.has(response.status)) {
            return response;
        }

        if (remainingRedirects <= 0) {
            throw new OutboundUrlSafetyError('Too many outbound redirects');
        }

        const location = response.headers.get('location');
        if (!location) {
            throw new OutboundUrlSafetyError('Redirect response is missing a location header');
        }

        currentUrl = await assertSafeOutboundUrl(new URL(location, currentUrl), options);
        requestInit = cloneInitForRedirect(requestInit, response.status);
        remainingRedirects -= 1;
    }
}
