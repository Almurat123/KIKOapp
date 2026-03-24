import { Tool } from '../../../tooling/registry.js';

interface TimeSnapshot {
    timezone: string;
    date: string;
    time: string;
    iso_like: string;
}

function formatTimeSnapshot(now: Date, timeZone: string): TimeSnapshot {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '00';
    const year = read('year');
    const month = read('month');
    const day = read('day');
    const hour = read('hour');
    const minute = read('minute');
    const second = read('second');

    return {
        timezone: timeZone,
        date: `${year}-${month}-${day}`,
        time: `${hour}:${minute}:${second}`,
        iso_like: `${year}-${month}-${day}T${hour}:${minute}:${second}`,
    };
}

export const GetCurrentTimeTool: Tool = {
    definition: {
        name: 'get_current_time',
        description: 'Get the current absolute time in UTC, the user timezone when available, and America/New_York. Use this before answering time-sensitive questions such as "today", "now", or short-window prediction markets.',
        parameters: {
            type: 'object',
            properties: {
                timezone: {
                    type: 'string',
                    description: 'Optional IANA timezone to include, such as Asia/Shanghai or America/Los_Angeles.'
                }
            },
            required: []
        }
    },
    handler: async (args: { timezone?: string }, context) => {
        const now = new Date();
        const requestedTimeZone = String(args?.timezone || context?.client_timezone || '').trim() || 'Asia/Shanghai';

        return {
            source: 'system-clock',
            unix_ms: now.getTime(),
            unix_s: Math.floor(now.getTime() / 1000),
            utc: {
                timezone: 'UTC',
                iso: now.toISOString(),
            },
            local: formatTimeSnapshot(now, requestedTimeZone),
            market_time: formatTimeSnapshot(now, 'America/New_York'),
            note: 'Use absolute timestamps and the America/New_York market clock for short-window Polymarket markets.',
        };
    },
    permissions: 'public'
};
