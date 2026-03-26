import assert from 'node:assert/strict';
import test from 'node:test';

import {
    assertSafeOutboundUrl,
    fetchWithUrlSafety,
    OutboundUrlSafetyError,
    type ResolveHostname,
} from './outboundUrlSafety.js';

test('assertSafeOutboundUrl rejects localhost-style hostnames before DNS resolution', async () => {
    await assert.rejects(
        () => assertSafeOutboundUrl('http://localhost:3001/admin'),
        (error: unknown) => error instanceof OutboundUrlSafetyError
            && error.message.includes('Outbound hostname is not allowed'),
    );
});

test('assertSafeOutboundUrl rejects direct IP hosts', async () => {
    await assert.rejects(
        () => assertSafeOutboundUrl('http://169.254.169.254/latest/meta-data'),
        (error: unknown) => error instanceof OutboundUrlSafetyError
            && error.message.includes('Direct IP outbound URLs are not allowed'),
    );
});

test('assertSafeOutboundUrl rejects hostnames resolving to private IP space', async () => {
    const resolveHostname: ResolveHostname = async () => [{ address: '10.0.12.4', family: 4 }];

    await assert.rejects(
        () => assertSafeOutboundUrl('https://example.com/', { resolveHostname }),
        (error: unknown) => error instanceof OutboundUrlSafetyError
            && error.message.includes('Resolved hostname to disallowed IP address'),
    );
});

test('assertSafeOutboundUrl allows public https destinations', async () => {
    const resolveHostname: ResolveHostname = async () => [{ address: '93.184.216.34', family: 4 }];

    const parsed = await assertSafeOutboundUrl('https://example.com/path?q=1', { resolveHostname });
    assert.equal(parsed.hostname, 'example.com');
});

test('fetchWithUrlSafety blocks redirects to unsafe destinations', async () => {
    const resolveHostname: ResolveHostname = async (hostname) => {
        if (hostname === 'safe.example') {
            return [{ address: '93.184.216.34', family: 4 }];
        }
        if (hostname === 'internal.example') {
            return [{ address: '127.0.0.1', family: 4 }];
        }
        return [];
    };

    const fetchImpl: typeof fetch = async (input) => {
        const url = String(input);
        if (url === 'https://safe.example/start') {
            return new Response(null, {
                status: 302,
                headers: { location: 'http://internal.example/secret' },
            });
        }
        throw new Error(`Unexpected fetch for ${url}`);
    };

    await assert.rejects(
        () => fetchWithUrlSafety('https://safe.example/start', {}, { resolveHostname, fetchImpl }),
        (error: unknown) => error instanceof OutboundUrlSafetyError
            && error.message.includes('Resolved hostname to disallowed IP address'),
    );
});

test('fetchWithUrlSafety follows safe redirects and returns the final response', async () => {
    const resolveHostname: ResolveHostname = async () => [{ address: '93.184.216.34', family: 4 }];
    const seen: string[] = [];

    const fetchImpl: typeof fetch = async (input) => {
        const url = String(input);
        seen.push(url);
        if (url === 'https://safe.example/start') {
            return new Response(null, {
                status: 302,
                headers: { location: 'https://safe.example/final' },
            });
        }
        if (url === 'https://safe.example/final') {
            return new Response('ok', { status: 200 });
        }
        throw new Error(`Unexpected fetch for ${url}`);
    };

    const response = await fetchWithUrlSafety('https://safe.example/start', {}, { resolveHostname, fetchImpl });
    assert.equal(await response.text(), 'ok');
    assert.deepEqual(seen, ['https://safe.example/start', 'https://safe.example/final']);
});
