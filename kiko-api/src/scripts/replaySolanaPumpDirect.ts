import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { getSolanaConnection } from '../config/solanaConfig.js';
import { TOKEN_PROGRAM_ID } from '../utils/solanaToken.js';
import { __pumpSwapExecutorTest } from '../services/solana/direct/pumpswapExecutor.js';

const DEFAULT_MINT = '8NkzfmreM4TnoD9aoMpBXbutvTUzaSqHD2fv3TeHpump';
const DEFAULT_USER = 'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvV';
const DEFAULT_SOL_IN_LAMPORTS = '1000000';

const PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMP_FEE_PROGRAM_ID = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

function derivePumpGlobalPda(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('global')], PUMP_FUN_PROGRAM_ID)[0];
}

function derivePumpFeeConfigPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('fee_config'), PUMP_FUN_PROGRAM_ID.toBuffer()],
    PUMP_FEE_PROGRAM_ID,
  )[0];
}

function deriveBondingCurvePda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    PUMP_FUN_PROGRAM_ID,
  )[0];
}

async function main() {
  const PumpSdkModule = await import('@pump-fun/pump-sdk');
  const mint = new PublicKey(process.env.SOL_PUMP_REPLAY_MINT || DEFAULT_MINT);
  const user = new PublicKey(process.env.SOL_PUMP_REPLAY_USER || DEFAULT_USER);
  const solIn = new BN(process.env.SOL_PUMP_REPLAY_SOL_IN_LAMPORTS || DEFAULT_SOL_IN_LAMPORTS);
  const connection = getSolanaConnection('cheap', 'normal');

  const mintInfo = await connection.getAccountInfo(mint, 'confirmed');
  if (!mintInfo) {
    throw new Error(`Mint not found: ${mint.toBase58()}`);
  }

  const tokenProgram = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;

  const userAta = PublicKey.findProgramAddressSync(
    [user.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
  )[0];

  const [globalAccountInfo, feeConfigAccountInfo, bondingCurveAccountInfo, associatedUserAccountInfo, mintSupply, resolvedPool] = await Promise.all([
    connection.getAccountInfo(derivePumpGlobalPda(), 'confirmed'),
    connection.getAccountInfo(derivePumpFeeConfigPda(), 'confirmed'),
    connection.getAccountInfo(deriveBondingCurvePda(mint), 'confirmed'),
    connection.getAccountInfo(userAta, 'confirmed'),
    connection.getTokenSupply(mint, 'confirmed'),
    __pumpSwapExecutorTest.resolvePumpSwapPoolForMint(connection, mint, null),
  ]);
  if (!globalAccountInfo) {
    throw new Error('Pump global account unavailable');
  }
  if (!bondingCurveAccountInfo) {
    throw new Error(`Bonding curve account not found for mint: ${mint.toBase58()}`);
  }

  const global = PumpSdkModule.PUMP_SDK.decodeGlobal(globalAccountInfo);
  const feeConfig = feeConfigAccountInfo ? PumpSdkModule.PUMP_SDK.decodeFeeConfig(feeConfigAccountInfo) : null;
  const bondingCurve = PumpSdkModule.PUMP_SDK.decodeBondingCurve(bondingCurveAccountInfo);

  const tokenAmountOut = PumpSdkModule.getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: new BN(mintSupply.value.amount),
    bondingCurve,
    amount: solIn,
  });

  const buyInstructions = await PumpSdkModule.PUMP_SDK.buyInstructions({
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    associatedUserAccountInfo,
    mint,
    user,
    amount: tokenAmountOut,
    solAmount: solIn,
    slippage: 1,
    tokenProgram,
  });

  const result = {
    mint: mint.toBase58(),
    user: user.toBase58(),
    tokenProgram: tokenProgram.toBase58(),
    mintSupply: mintSupply.value.amount,
    bondingCurveComplete: bondingCurve.complete,
    bondingCurveMayhemMode: bondingCurve.isMayhemMode,
    bondingCurveCashback: bondingCurve.isCashbackCoin,
    buyInputLamports: solIn.toString(),
    buyTokenAmountOut: tokenAmountOut.toString(),
    buyInstructionCount: buyInstructions.length,
    buyInstructionPrograms: buyInstructions.map((ix) => ix.programId.toBase58()),
    pumpswapPool: resolvedPool
      ? {
          pool: resolvedPool.pool.toBase58(),
          layoutVersion: resolvedPool.layout.layoutVersion,
          baseMint: resolvedPool.layout.baseMint.toBase58(),
          quoteMint: resolvedPool.layout.quoteMint.toBase58(),
        }
      : null,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
