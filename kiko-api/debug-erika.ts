import { fetch } from 'undici';

async function checkSpecificBonkToken() {
    const mint = '8n1KRuB9WX6VRhpBo9SGxe1EWKQzudtrcC8ePATnbonk';

    const url = `https://api-v3.raydium.io/mint/ids?mints=${mint}`;
    console.log(`Fetching: ${url}`);

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        console.log('Mint Metadata (V3):', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }

    // Also check standard V2 mainnet pairs to see if it shows up there with info
    try {
        const v2Url = `https://api-v2.raydium.io/pairs?input_mint=${mint}`;
        console.log(`Fetching V2 Pairs: ${v2Url}`);
        const resp2 = await fetch(v2Url);
        // V2 might return a list
        const text = await resp2.text();
        console.log('V2 Pairs Response Length:', text.length);
        if (text.length < 2000) console.log('V2 Pairs:', text);
    } catch (e) {
        console.error(e);
    }
}

checkSpecificBonkToken();
