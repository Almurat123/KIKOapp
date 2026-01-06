import { Connection, PublicKey, type ParsedAccountData } from '@solana/web3.js';

// SPL Token program IDs
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/**
 * Derive the associated token account (ATA) for a given mint and owner.
 */
export function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey, allowOwnerOffCurve: boolean = false): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

/**
 * Fetch the token account amount (lamports of the SPL token) from a parsed account.
 * Returns 0n if the account does not exist or is not parsed.
 */
export async function getTokenAccountAmount(connection: Connection, ata: PublicKey): Promise<bigint> {
  const info = await connection.getParsedAccountInfo(ata, 'confirmed');
  const parsed = info.value?.data as ParsedAccountData | null | undefined;
  const amountStr = parsed?.parsed?.info?.tokenAmount?.amount;
  return amountStr ? BigInt(amountStr) : 0n;
}

export async function getSolanaTokenMetadata(mint: string): Promise<any> {
  // Placeholder implementation
  return {
    address: mint,
    symbol: 'UNKNOWN',
    name: 'Unknown Token',
    decimals: 9
  };
}
