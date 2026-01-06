import { fetch } from 'undici';

async function checkMaduroToken() {
    const mint = '9oKUn9hQLzQvtdj9oU3DN4SNANgBDBkLXNqDd79abonk';

    const url = `https://api-v3.raydium.io/mint/ids?mints=${mint}`;
    console.log(`Fetching: ${url}`);

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        console.log('Mint Metadata (V3):', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkMaduroToken();
