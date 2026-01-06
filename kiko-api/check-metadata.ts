import { Connection, PublicKey } from '@solana/web3.js';

const MINT = new PublicKey('8n1KRuB9WX6VRhpBo9SGxe1EWKQzudtrcC8ePATnbonk');
const LAUNCHPAD_PROGRAM_ID = new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const CONNECTION = new Connection('https://api.mainnet-beta.solana.com');

async function checkMetadata() {
    console.log(`Checking metadata for ${MINT.toBase58()}...`);

    const [pda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('metadata'),
            METADATA_PROGRAM_ID.toBuffer(),
            MINT.toBuffer()
        ],
        METADATA_PROGRAM_ID
    );
    console.log(`Metadata PDA: ${pda.toBase58()}`);

    const info = await CONNECTION.getAccountInfo(pda);
    if (!info) {
        console.log('Metadata account not found.');
        return;
    }

    const data = info.data;
    // Metadata layout:
    // key: u8 (0)
    // update_authority: PublicKey (1-33)
    // mint: PublicKey (33-65)
    // ...

    // Check Key (should be 4 for MetadataV1/V2/V3)
    const key = data[0];
    console.log(`Metadata Key: ${key}`);

    const updateAuth = new PublicKey(data.subarray(1, 33));
    console.log(`Update Authority: ${updateAuth.toBase58()}`);

    // Simplified unsafe parsing (just searching for the Pubkey in bytes)
    // The LaunchLab ID `LanMV9...` might be in the creators list.
    // Also check for `WLHv...` (Update Auth)

    // Convert buffer to hex string for easy search?
    // Or just scan for the pubkey bytes.
    const launchpadIdBytes = LAUNCHPAD_PROGRAM_ID.toBuffer();

    if (data.includes(launchpadIdBytes)) {
        console.log('✅ Found Launchpad Program ID inside Metadata! It is likely a creator.');
    } else {
        console.log('❌ Launchpad Program ID NOT found in Metadata bytes.');
    }

    // Check for string "Bonk" or "LaunchLab" in URI?
    const textData = data.toString('utf8');
    if (textData.includes('bonk') || textData.includes('Bonk')) {
        console.log('ℹ️ Found "bonk" string in metadata text.');
    }
}

checkMetadata();
