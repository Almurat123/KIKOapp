import { Connection, PublicKey } from '@solana/web3.js';

const LAUNCHPAD_PROGRAM_ID = new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');
const MINT_A = new PublicKey('8n1KRuB9WX6VRhpBo9SGxe1EWKQzudtrcC8ePATnbonk'); // ERIKA
const MINT_B = new PublicKey('So11111111111111111111111111111111111111112'); // WSOL
const CONNECTION = new Connection('https://api.mainnet-beta.solana.com');

async function checkSeed(seedString: string) {
    console.log(`Checking seed: "${seedString}"`);
    const seed = Buffer.from(seedString);

    // Try order A, B
    const [pda1] = PublicKey.findProgramAddressSync([seed, MINT_A.toBuffer(), MINT_B.toBuffer()], LAUNCHPAD_PROGRAM_ID);
    // Try order B, A
    const [pda2] = PublicKey.findProgramAddressSync([seed, MINT_B.toBuffer(), MINT_A.toBuffer()], LAUNCHPAD_PROGRAM_ID);

    console.log(`  Order A-B: ${pda1.toBase58()}`);
    console.log(`  Order B-A: ${pda2.toBase58()}`);

    const [info1, info2] = await Promise.all([
        CONNECTION.getAccountInfo(pda1),
        CONNECTION.getAccountInfo(pda2)
    ]);

    if (info1) {
        console.log(`  ✅ FOUND Account for A-B! Owner: ${info1.owner.toBase58()}`);
        if (info1.owner.equals(LAUNCHPAD_PROGRAM_ID)) console.log('    ✅ Owner MATCHES Launchpad Program!');
    }
    if (info2) {
        console.log(`  ✅ FOUND Account for B-A! Owner: ${info2.owner.toBase58()}`);
        if (info2.owner.equals(LAUNCHPAD_PROGRAM_ID)) console.log('    ✅ Owner MATCHES Launchpad Program!');
    }
}

async function main() {
    // 1. Check Launchpad Auth PDA
    const AUTH_SEED = Buffer.from("vault_auth_seed", "utf8");
    const [authPda] = PublicKey.findProgramAddressSync([AUTH_SEED], LAUNCHPAD_PROGRAM_ID);
    console.log(`Launchpad Auth PDA: ${authPda.toBase58()}`);

    // WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh is the update authority of the ERIKA token
    if (authPda.toBase58() === 'WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh') {
        console.log('✅ BINGO! The Update Authority matches the Launchpad Auth PDA!');
    } else {
        console.log('❌ Launchpad Auth PDA does NOT match Update Authority (WLHv...).');
        console.log(`   (Calculated Auth PDA: ${authPda.toBase58()})`);
    }

    // 2. Check Pool Seeds (just in case)
    await checkSeed('pool');
}

main();
