import test from 'node:test';
import assert from 'node:assert/strict';

import { rateLimiterMiddleware } from './rateLimiter.js';

test('public generated-image proxy fetches bypass the global API rate limiter in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSkipRateLimit = process.env.SKIP_RATE_LIMIT;
    process.env.NODE_ENV = 'production';
    process.env.SKIP_RATE_LIMIT = 'false';

    const calls: string[] = [];
    const reply = {
        status() {
            calls.push('status');
            return this;
        },
        code() {
            calls.push('code');
            return this;
        },
        header() {
            calls.push('header');
            return this;
        },
        send() {
            calls.push('send');
            return this;
        },
    };

    try {
        await rateLimiterMiddleware(
            {
                method: 'GET',
                url: '/api/chat/generated-images/public/chat-uploads/generated-public/farcaster/did_privy_test/2026-04-20/message.png',
                ip: '203.0.113.10',
                headers: {},
            } as any,
            reply as any,
        );
    } finally {
        if (previousNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = previousNodeEnv;
        }
        if (previousSkipRateLimit === undefined) {
            delete process.env.SKIP_RATE_LIMIT;
        } else {
            process.env.SKIP_RATE_LIMIT = previousSkipRateLimit;
        }
    }

    assert.deepEqual(calls, []);
});

test('hotlink-ok public generated-image proxy fetches also bypass the global API rate limiter in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSkipRateLimit = process.env.SKIP_RATE_LIMIT;
    process.env.NODE_ENV = 'production';
    process.env.SKIP_RATE_LIMIT = 'false';

    const calls: string[] = [];
    const reply = {
        status() {
            calls.push('status');
            return this;
        },
        code() {
            calls.push('code');
            return this;
        },
        header() {
            calls.push('header');
            return this;
        },
        send() {
            calls.push('send');
            return this;
        },
    };

    try {
        await rateLimiterMiddleware(
            {
                method: 'GET',
                url: '/api/chat/generated-images/public/hotlink-ok/chat-uploads/generated-public/farcaster/did_privy_test/2026-04-20/message.png',
                ip: '203.0.113.11',
                headers: {},
            } as any,
            reply as any,
        );
    } finally {
        if (previousNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = previousNodeEnv;
        }
        if (previousSkipRateLimit === undefined) {
            delete process.env.SKIP_RATE_LIMIT;
        } else {
            process.env.SKIP_RATE_LIMIT = previousSkipRateLimit;
        }
    }

    assert.deepEqual(calls, []);
});
