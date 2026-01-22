
import { ogpService } from '../services/ogpService.js';

async function testOGP() {
    const urls = [
        'https://www.deepfunding.org/',
        'https://vitalik.eth.limo/general/2020/11/08/concave.html',
        'https://pol.is',
        'https://google.com' // Control
    ];

    for (const url of urls) {
        console.log(`Fetching OGP for: ${url}`);
        try {
            const data = await ogpService.fetchOGP(url);
            console.log('Result:', data ? 'Success' : 'Failed');
            if (data) {
                console.log(JSON.stringify(data, null, 2));
            }
        } catch (e) {
            console.error('Error:', e);
        }
        console.log('-------------------');
    }
}

testOGP();
