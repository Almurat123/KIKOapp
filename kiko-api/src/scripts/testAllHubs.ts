/**
 * Test all 3 Hub APIs directly to get cast data
 */

const HUBS = [
    { name: 'Pinata', url: 'https://hub.pinata.cloud' },
    { name: 'Merv.fun', url: 'https://snapchain.farcaster.merv.fun' },
    { name: 'Hoyt', url: 'https://snapchain.hoyt.fyi' },
];

async function testHubs() {
    const fid = 11244;
    const hash = '0xc4b8ca8b3d3e590683b4239bc006ac5dfea50289';

    console.log(`=== 直接测试三个 Hub API ===`);
    console.log(`fid: ${fid}, hash: ${hash}\n`);

    for (const hub of HUBS) {
        const url = `${hub.url}/v1/castById?fid=${fid}&hash=${hash}`;
        console.log(`\n${hub.name}: ${url}`);

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' }
            });
            clearTimeout(timeout);

            console.log(`   Status: ${response.status}`);

            if (response.ok) {
                const data = await response.json();
                if (data.data?.castAddBody) {
                    console.log(`   ✅ SUCCESS: "${data.data.castAddBody.text?.slice(0, 40)}..."`);
                } else {
                    console.log(`   ❌ No castAddBody in response:`, JSON.stringify(data).slice(0, 100));
                }
            } else {
                const errorText = await response.text();
                console.log(`   ❌ Error: ${errorText.slice(0, 100)}`);
            }
        } catch (e: any) {
            console.log(`   ❌ Fetch failed: ${e.message}`);
        }
    }
}

testHubs();
