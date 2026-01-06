import { Tool } from './registry.js';
import { getEconomicCalendar } from '../services/economicCalendar.js';

export const GetEconomicCalendarTool: Tool = {
    definition: {
        name: 'get_economic_calendar',
        description: 'Get upcoming key economic events (CPI, FOMC, GDP, etc.) that impact the crypto market.',
        parameters: {
            type: 'object',
            properties: {
                limit: {
                    type: 'number',
                    description: 'Number of upcoming events to return (default 5)',
                    default: 5
                }
            }
        }
    },
    handler: async (args) => {
        try {
            const limit = Math.min(args.limit || 5, 10);

            console.log(`[GetEconomicCalendar] Fetching calendar events...`);

            const { upcoming } = await getEconomicCalendar();

            if (!upcoming || upcoming.length === 0) {
                return { message: "No major upcoming economic events found nearby." };
            }

            const filtered = upcoming.slice(0, limit);

            return filtered.map(e => ({
                event: e.name,
                date: e.date,
                impact: e.impact,
                forecast: e.forecast || 'N/A',
                previous: e.previous || 'N/A',
                country: e.country
            }));
        } catch (error: any) {
            console.error('[GetEconomicCalendar] Error:', error);
            return { error: 'Failed to fetch economic calendar' };
        }
    }
};
