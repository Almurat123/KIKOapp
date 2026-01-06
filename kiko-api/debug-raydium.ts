import { fetch } from 'undici';

async function checkRaydiumRaw() {
    // A8C3...pump is a Pump.fun token that Raydium apparently indexes
    const mint = 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump';

    const url = `https://api-v3.raydium.io/mint/ids?mints=${mint}`;
    console.log(`Fetching: ${url}`);

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        console.log('Raw Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkRaydiumRaw();
