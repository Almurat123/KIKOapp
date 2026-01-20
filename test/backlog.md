[Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_s52a7nwxasddbmy7","createdAt":"2026-01-20T17:09:10.092Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed","toAddress":"0x4409921ae43a39a11d90f7b7f96cfd0b8093d9fc","blockNum":"0x272ace9","hash":"0x5c998ed077ee00cb4061ecc7820a10d0bfbc74f2e8e923668aeb0cb9fc36518c","value":0.0005,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x1c6bf52634000","decimals":18},"blockTimestamp":"0x696fb6b5"}],"source":"chainlake-kafka"}}
[Webhook] Processing as EVM activity (1 items)
request completed
[Webhook] 🎯 Found 1 tracked wallets for tx 0x5c998e
incoming request
[Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_6w23ccspvl0z2b5c","createdAt":"2026-01-20T17:09:10.158Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x5e4efb192dfd5a267e5bedac155fd9b79df82496","toAddress":"0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed","blockNum":"0x272ace9","hash":"0x5c998ed077ee00cb4061ecc7820a10d0bfbc74f2e8e923668aeb0cb9fc36518c","value":10.4607988686143,"asset":"ELSA","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000000000000912c3925b6903b1e","address":"0x29cc30f9d113b356ce408667aa6433589cecbdca","decimals":18},"log":{"address":"0x29cc30f9d113b356ce408667aa6433589cecbdca","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000005e4efb192dfd5a267e5bedac155fd9b79df82496","0x0000000000000000000000002cd32fb42748774fafde72d8607f16ccc5f5c0ed"],"data":"0x000000000000000000000000000000000000000000000000912c3925b6903b1e","blockHash":"0xc5b6326488b18f8d960b5dd408ad7c46f4234c62e05eae89bdbaece54b107fb6","blockNumber":"0x272ace9","blockTimestamp":"0x696fb6b5","transactionHash":"0x5c998ed077ee00cb4061ecc7820a10d0bfbc74f2e8e923668aeb0cb9fc36518c","transactionIndex":"0x5c","logIndex":"0x1df","removed":false},"blockTimestamp":"0x696fb6b5"}],"source":"chainlake-kafka"}}
[Webhook] Processing as EVM activity (1 items)
[Webhook] Tx already in processedTxs cache: 0x5c998ed077ee00
request completed
Swap successfully decoded from logs
[Webhook] ✅ Swap detected for tracked wallet 0x2cd32fb4: {
  tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  tokenOut: '0x29cc30f9d113b356ce408667aa6433589cecbdca',
  dex: 'Unknown DEX'
}
Swap detected on target wallet
Target is buying - triggering copy trade
LaunchpadDetector: Failed to load Paragraph SDK
Timer finished: launchpad_det_0x29cc30f9d113b356ce408667aa6433589cecbdca
⏭️ Skipping ELSA: [HONEYPOT/FAST] Liquidity $0 < $500
