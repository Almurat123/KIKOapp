
const HUB_URL = 'https://hub.merv.fun';

async function testGetCast() {
    // Use a known existing cast. 
    // From user screenshot, Farcaster (fid 1) replied to baseapp.base.eth.
    // Let's try to fetch a known cast hash if we have one, or just pick one from trending.
    // Actually, let's just use Vitalik (fid 194) and one of his casts if we can find one.
    // Or just query castsByFid for Vitalik to get a valid Hash, then query that Hash.

    console.log('1. Fetching recent cast for FID 3 (dwr)...');
    const castRes = await fetch(`${HUB_URL}/v1/castsByFid?fid=3&pageSize=1&reverse=true`);
    const castData = await castRes.json();

    if (!castData.messages || castData.messages.length === 0) {
        console.error('Failed to get a cast to test with.');
        return;
    }

    const testCast = castData.messages[0];
    const fid = testCast.data.fid;
    const hash = testCast.hash;

    console.log(`2. Testing castById for FID: ${fid}, Hash: ${hash}`);
    const url = `${HUB_URL}/v1/castById?fid=${fid}&hash=${hash}`;
    console.log(`Fetching: ${url}`);

    const res = await fetch(url);
    console.log(`Status: ${res.status}`);

    if (res.ok) {
        const json = await res.json();
        console.log('Response:', JSON.stringify(json, null, 2));
    } else {
        console.error('Error:', await res.text());
    }
}

testGetCast();
