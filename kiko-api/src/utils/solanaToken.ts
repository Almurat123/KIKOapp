import { Connection, PublicKey, type ParsedAccountData } from '@solana/web3.js';
import { fetchJson } from '../config/unifiedApiService.js';

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
  return amountStr ? BigInt(amountStr) : BigInt(0);
}

export interface SolanaTokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

/**
 * Get token metadata from Jupiter Token List
 */
export async function getSolanaTokenMetadata(
  tokenAddress: string
): Promise<SolanaTokenMetadata | null> {
  const TOKENLIST_URLS = [
    process.env.SOLANA_TOKENLIST_URL, // optional override
    'https://tokens.jup.ag/tokens?tags=verified', // official
    'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json', // CDN fallback
    'https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json', // raw fallback
  ].filter(Boolean) as string[];

  for (const url of TOKENLIST_URLS) {
    try {
      const payload = await fetchJson({
        url,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
      });

      const tokens = Array.isArray(payload) ? payload : (payload as any)?.tokens || [];
      if (!Array.isArray(tokens)) {
        console.warn(`[Solana Token Metadata] Unexpected token list shape from ${url}`);
        continue;
      }

      const token = tokens.find((t: any) => t?.address?.toLowerCase() === tokenAddress.toLowerCase());
      if (!token) {
        console.warn(`[Solana Token Metadata] Token not in list ${url}: ${tokenAddress}`);
        continue;
      }

      const decimals = typeof token.decimals === 'number' ? token.decimals : 6;

      console.log(`[Solana Token Metadata] ✓ Found token ${token.symbol} via ${url}`);
      return {
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals,
        logoURI: token.logoURI,
      };
    } catch (error) {
      console.warn('[Solana Token Metadata] Source failed, trying next:', url, error);
      continue;
    }
  }

  console.error(`[Solana Token Metadata] No metadata found for token: ${tokenAddress}`);
  // Fallback minimal metadata to keep flows working even without token list
  return {
    address: tokenAddress,
    symbol: 'UNKNOWN',
    name: 'Unknown Token',
    decimals: 6,
    logoURI: undefined,
  };
}
