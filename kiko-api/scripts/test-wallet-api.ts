import axios from 'axios';

const API_URL = 'http://localhost:3001/api/wallets'; // Assuming port 3001 based on env, adjust if needed

async function testWalletAPI() {
    try {
        console.log('Testing Wallet API...');

        // 1. Add a wallet
        console.log('\n1. Adding wallet...');
        const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
        const addRes = await axios.post(API_URL, {
            address: walletAddress,
            name: 'Test Wallet',
            tags: ['test', 'whale']
        });
        console.log('Added:', addRes.data);

        // 2. Get all wallets
        console.log('\n2. Fetching all wallets...');
        const listRes = await axios.get(API_URL);
        console.log('Wallets:', listRes.data.length);

        // 3. Get wallet details
        console.log('\n3. Fetching wallet details...');
        const detailRes = await axios.get(`${API_URL}/${walletAddress}`);
        console.log('Details:', detailRes.data);

        // 4. Get transactions
        console.log('\n4. Fetching transactions...');
        const txRes = await axios.get(`${API_URL}/${walletAddress}/transactions`);
        console.log('Transactions:', txRes.data.length);

        // 5. Remove wallet
        console.log('\n5. Removing wallet...');
        await axios.delete(`${API_URL}/${walletAddress}`);
        console.log('Removed.');

        console.log('\n✅ Wallet API Test Passed!');
    } catch (error: any) {
        console.error('❌ Test Failed:', error.response ? error.response.data : error.message);
    }
}

testWalletAPI();
