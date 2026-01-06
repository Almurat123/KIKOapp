import { getTokenInfo } from './src/services/ai/tokenDetector.js';

async function test() {
    // MADURO address
    const address = '9oKUn9hQLzQvtdj9oU3DN4SNANgBDBkLXNqDd79abonk';
    // Solana chainId = 900
    const info = await getTokenInfo(address, 900);
    console.log(JSON.stringify(info, null, 2));
}

test();
