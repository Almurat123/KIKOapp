import { PublicKey } from '@solana/web3.js';

const PUMP_SWAP_PROGRAM_ID = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const WSOL = new PublicKey('So11111111111111111111111111111111111111112');

const creatorCandidates = [
  'ERrKbS1CLFyLYjSeytJ8zXn1scUwrs1C8BjCRHC5kaVa', // offset 11
  '5kDzt9YZKaPsQwLT1CH6kmg9TMkan5nP4vo5oDzqMGe2', // offset 203
  '3sxjkMFUdqsGpCnrER4nHGc5JKszpRM1okTJAqXuNMe7', // offset 235
  '9rPYyANsfQZw3DnDmKE3YCQF5E8oD89UXoHn9JFEhJUz', // account from ix list
  'GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR',
];

for (const c of creatorCandidates) {
  const creator = new PublicKey(c);
  const [auth] = PublicKey.findProgramAddressSync([Buffer.from('creator_vault'), creator.toBuffer()], PUMP_SWAP_PROGRAM_ID);
  const [ata] = PublicKey.findProgramAddressSync([auth.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), WSOL.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID);
  console.log(c, '=> auth', auth.toBase58(), 'ata', ata.toBase58());
}
