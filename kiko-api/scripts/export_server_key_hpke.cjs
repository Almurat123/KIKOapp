const { PrivyClient } = require('@privy-io/server-auth');
const { CipherSuite, DhkemP256HkdfSha256, HkdfSha256, Aes256Gcm, Aes128Gcm } = require('hpke-js');
require('dotenv').config();

// Initialize Privy Client
const privy = new PrivyClient(
    process.env.VITE_PRIVY_APP_ID,
    process.env.PRIVY_APP_SECRET,
    { walletApi: { authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_KEY } }
);

async function exportWallet() {
    const walletId = 't6w1v8c9bewzlwtunhzf9zq3'; // Server Wallet ID
    console.log('🔐 Starting HPKE Export for Wallet:', walletId);

    try {
        // 1. Setup HPKE Suite (Matching Privy Defaults)
        // Usually P-256 + SHA256 + AES-128-GCM or AES-256-GCM. 
        // Docs usually specify. I will try AES-256-GCM first, fall back or check docs if fail.
        // Actually typical Privy/Coinbase usage is Aes256Gcm.
        const suite = new CipherSuite({
            kem: new DhkemP256HkdfSha256(),
            kdf: new HkdfSha256(),
            aead: new Aes256Gcm(),
        });

        // 2. Generate Key Pair
        const rkp = await suite.kem.generateKeyPair();
        const publicKeyBytes = await rkp.publicKey.extract();
        // Convert to Base64
        const publicKeyBase64 = Buffer.from(publicKeyBytes).toString('base64');

        console.log('📤 Sending Public Key to Privy...');

        // 3. Call Export API
        // Accessing the internal API client from walletApi (might differ based on SDK version, 
        // traversing to find valid axios client).
        const apiClient = privy.walletApi.api || privy.api;

        if (!apiClient) {
            throw new Error('Could not find API client on Privy instance');
        }

        const response = await apiClient.post(`/v1/wallets/${walletId}/export`, {
            encryptionType: 'HPKE',
            recipientPublicKey: publicKeyBase64
        });

        const data = response.data;
        console.log('📥 Received Encrypted Response');
        console.log('   Ciphertext Length:', data.ciphertext.length);

        // 4. Decrypt
        // Expect: ciphertext (base64), encapsulatedKey (base64)
        const recipient = await suite.createRecipientContext({
            recipientKey: rkp,
            enc: Buffer.from(data.encapsulatedKey, 'base64'),
        });

        const decryptedBytes = await recipient.open(
            Buffer.from(data.ciphertext, 'base64')
        );

        const privateKey = new TextDecoder().decode(decryptedBytes);
        console.log('\n✅ Private Key Exported Successfully!');
        console.log('--------------------------------------------------');
        console.log(privateKey);
        console.log('--------------------------------------------------');
        console.log('⚠️  KEEP THIS KEY SAFE. IT GIVES FULL CONTROL.');

    } catch (e) {
        console.error('❌ Export Error:', e.message);
        if (e.response) {
            console.error('   Status:', e.response.status);
            console.error('   Data:', JSON.stringify(e.response.data));
            // Feedback for debugging suite mismatch (e.g. "Encryption error")
        }
    }
}

exportWallet();
