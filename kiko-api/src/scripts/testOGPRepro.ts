import { ogpService } from '../services/ogpService.js';

// Mock logger to see output
import { logger } from '../utils/logger.js';
logger.info = console.log;
logger.warn = console.warn;
logger.error = console.error;

const TEST_URLS = [
    'https://fightchatcontrol.eu/',
    'https://www.theregister.com/2026/01/11/eu_open_source_consultation',
    'https://github.com',
];

async function run() {
    console.log('--- Starting OGP Reproduction Test ---');

    for (const url of TEST_URLS) {
        console.log(`\nTesting URL: ${url}`);
        try {
            const result = await ogpService.fetchOGP(url);
            if (result) {
                console.log('✅ Success:', {
                    title: result.title,
                    image: result.image?.substring(0, 50) + '...',
                    siteName: result.siteName
                });
            } else {
                console.log('❌ Failed: No metadata returned');
            }
        } catch (error: any) {
            console.log('❌ Error Exception:', error.message);
        }
    }
}

run().catch(console.error);
