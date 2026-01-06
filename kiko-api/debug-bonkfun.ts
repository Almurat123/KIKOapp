import { fetch } from 'undici';

async function checkBonkFun() {
    // Guessing the address from search snippet + standard suffix pattern
    // If this fails, I'll try another or the other snippet
    const mint = '2TfJnBeEjTFvE865V2pQc1M6qP147565bonk';
    // Wait, solana addresses are base58, 32-44 chars. 
    // "2TfJnBeEjTFvE865V2pQc1M6qP147565bonk" is 36 chars. Plausible.

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

checkBonkFun();
