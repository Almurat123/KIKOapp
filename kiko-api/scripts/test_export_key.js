const { PrivyClient } = require('@privy-io/server-auth');
require('dotenv').config();

const privy = new PrivyClient(
    process.env.VITE_PRIVY_APP_ID,
    process.env.PRIVY_APP_SECRET,
    { walletApi: { authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_KEY } }
);

async function test() {
    const walletId = 't6w1v8c9bewzlwtunhzf9zq3';
    console.log('Testing export for wallet:', walletId);
    try {
        if (!privy.walletApi.export) {
            console.log('X export method not found on walletApi');
            console.log('Available methods:', Object.keys(privy.walletApi));
            // Try to find it in prototype?
            return;
        }
        const result = await privy.walletApi.export({ walletId });
        console.log('SUCCESS Export Success!');
        console.log('Key:', result.privateKey ? 'Present' : 'Missing');
    } catch (e) {
        console.log('X Export Failed:', e.message);
        if (e.response) {
            console.log('Status:', e.response.status);
            console.log('Data:', JSON.stringify(e.response.data));
        }
    }
}
test();
