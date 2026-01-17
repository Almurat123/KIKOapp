# Skills Audit


## SwapSkill

### Tools tested

Command:
```
(npx -C kiko-api tsx src/scripts/testSwapSkill.ts)
```

Raw output:
```json
{
  "simulate_swap": {
    "error": "request to http://localhost:3001/api/swap/quote failed, reason: "
  },
  "prepare_swap_transaction": {
    "__client_action": {
      "type": "show_swap_card",
      "payload": {
        "tokenIn": "USDC",
        "tokenOut": "ETH",
        "amountIn": "10",
        "chainId": 8453,
        "slippage": 0.5
      }
    },
    "mode": "prepared",
    "requires_user_confirmation": true,
    "summary": "Prepared swap for 10 USDC to ETH on chain 8453. Please confirm the transaction details in the card."
  }
}
```

Notes:
- simulate_swap failed because API_BASE defaulted to `http://localhost:3001` with no running backend in this run.
- prepare_swap_transaction returned `mode=prepared` with `show_swap_card` action (swapMethod=confirm).


## TokenSkill

### Tools tested

Command:
```
(npx -C kiko-api tsx src/scripts/testTokenSkill.ts)
```

Raw output:
```json
{
  "get_token_info": {
    "source": "DexScreener",
    "address": "0x1a5F9d77CA46646cD4937fD8d093F460B66F4444",
    "name": "老子",
    "symbol": "老子",
    "chainId": 56,
    "network": "bsc",
    "price": 0.004912,
    "priceChange24h": 17.36,
    "volume24h": 3360976.29,
    "liquidity": 493602.83,
    "fdv": 4912873,
    "poolAddress": "0xc784375E30C1f14E5ba6Ba0507186dC7EA6b784E",
    "pairCreatedAt": 1767975710000,
    "imageUrl": "https://cdn.dexscreener.com/cms/images/7ce719453c76e3b0b27ad79ca498e923abef787a0ad3e27660b7796a5db56ef8?width=800&height=800&quality=90",
    "socials": [],
    "websites": [],
    "launchpad": {
      "provider": "fourmeme",
      "data": {
        "id": 101507151,
        "address": "0x1a5f9d77ca46646cd4937fd8d093f460b66f4444",
        "image": "https://static.four.meme/market/fe47b9ee-956a-495d-98f7-42057f045d3c1999795004319806753.png",
        "name": "老子",
        "shortName": "老子",
        "symbol": "BNB",
        "descr": "老子",
        "twitterUrl": "https://x.com/i/status/2009661769921577371",
        "totalAmount": "1000000000",
        "saleAmount": "800000000",
        "b0": "6.164383561643835616438356164384",
        "t0": "1073972602.739726027397168628310578654491",
        "launchTime": 1767975684000,
        "minBuy": "0",
        "maxBuy": "0",
        "userId": 107736031,
        "userAddress": "0x3ef8f695054010a27a9d72fbb6320ddf73038766",
        "userName": "0x3ef8f695054010a27a9d72fbb6320ddf73038766",
        "status": "TRADE",
        "showStatus": "SHOW",
        "tradeUrl": "https://pancakeswap.finance/swap?chain=BSC&outputCurrency=BNB&inputCurrency=0x1a5f9d77ca46646cd4937fd8d093f460b66f4444",
        "tokenPrice": {
          "price": "0.00494674548080491008",
          "increase": "861831.9904335666",
          "amount": "800000000",
          "marketCap": "4946745.48080491008",
          "trading": "108369.998498695383215328",
          "dayIncrease": "16.73",
          "dayTrading": "16618596.280741145440746948",
          "bnbAmount": "0",
          "progress": "1",
          "bamount": "6.164383561643835616438356164384",
          "tamount": "1073972602.739726027397260273972602739727"
        },
        "oscarStatus": "Hide",
        "version": "V3",
        "createDate": "1767975684000",
        "lastInnerTradeDate": "1768633433000",
        "dexType": "PANCAKE_SWAP",
        "createdAt": 1767975684000
      },
      "chainId": 56
    },
    "isLaunchpad": true,
    "launchpadProvider": "fourmeme",
    "tokenAddress": "0x1a5F9d77CA46646cD4937fD8d093F460B66F4444",
    "tokenSymbol": "老子",
    "tokenName": "老子",
    "priceUsd": 0.004912,
    "liquidityUsd": 493602.83,
    "fdvUsd": 4912873,
    "volume24hUsd": 3360976.29,
    "priceChange24hPct": 17.36
  },
  "get_trending_tokens": [
    {
      "rank": 1,
      "name": "Coinbase Wrapped BTC",
      "symbol": "cbBTC",
      "address": "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
      "price": "95,138.35",
      "volume5m": "$94K",
      "change5m": "-0.16%",
      "liquidity": "$24.15M"
    },
    {
      "rank": 2,
      "name": "Virtual Protocol",
      "symbol": "VIRTUAL",
      "address": "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
      "price": "0.980700",
      "volume5m": "$33K",
      "change5m": "-0.60%",
      "liquidity": "$1.15M"
    },
    {
      "rank": 3,
      "name": "Horizen",
      "symbol": "ZEN",
      "address": "0xf43eB8De897Fbc7F2502483B2Bef7Bb9EA179229",
      "price": "12.0360",
      "volume5m": "$16K",
      "change5m": "-0.63%",
      "liquidity": "$3.54M"
    },
    {
      "rank": 4,
      "name": "Thoughtcoin",
      "symbol": "THINK",
      "address": "0xe6eE5bc3f420d1f9eCA60656eF6b307c04E42B07",
      "price": "0.000009",
      "volume5m": "$12K",
      "change5m": "10.43%",
      "liquidity": "$323K"
    },
    {
      "rank": 5,
      "name": "Zora",
      "symbol": "ZORA",
      "address": "0x1111111111166b7FE7bd91427724B487980aFc69",
      "price": "0.036540",
      "volume5m": "$7K",
      "change5m": "-0.02%",
      "liquidity": "$10.48M"
    }
  ],
  "get_token_price": {
    "symbol": "ETH",
    "price": "$3,287.035",
    "priceRaw": 3287.035,
    "source": "Coinbase",
    "timestamp": "2026-01-17T07:03:57.105Z"
  },
  "get_historical_price": {
    "symbol": "BTC",
    "date": "2024-01-01",
    "price": "$42,288.58",
    "priceRaw": 42288.58,
    "currency": "USD",
    "source": "Coinbase",
    "timestamp": "2026-01-17T07:03:57.445Z"
  },
  "get_early_buyers": {
    "success": true,
    "token": "0x1a5F9d77CA46646cD4937fD8d093F460B66F4444",
    "chain": "bsc",
    "buyerCount": 5,
    "earlyBuyers": [
      {
        "rank": 1,
        "address": "0x757eba15a64468e6535532fcf093cef90e226f85",
        "timestamp": "2026-01-17T07:03:58.910Z",
        "amount": "1000000000",
        "txHash": "0x3dce2024397878c7a4ff06f739af8733248647692e6acab0930484d2c17ef605",
        "isSmart": false
      }
    ]
  },
  "analyze_creator": {
    "success": true,
    "creatorAddress": "0x3ef8f695054010a27a9d72fbb6320ddf73038766",
    "chain": "bsc",
    "riskLevel": "Safe",
    "riskScore": 10,
    "tags": [
      "❓ Unknown Reputation"
    ],
    "details": {
      "transactionCount": -1,
      "isMixerFunded": false
    }
  }
}
```

Notes:
- `get_early_buyers` includes only 1 buyer in the report to keep the audit short; full output is in `/tmp/token_skill_output.json`.
- Historical/price timestamps are derived from runtime clock and may not match real time if system clock is skewed.


## RiskSkill

### Tools tested

Command:
```
(npx -C kiko-api tsx src/scripts/testRiskSkill.ts)
```

Raw output:
```json
{
  "check_token_risk": {
    "status": "Safe",
    "riskScore": 10,
    "isHoneypot": false,
    "buyTax": 0,
    "sellTax": 0,
    "warnings": [],
    "positives": [
      "✅ Contract is open source and verified",
      "✅ Not a proxy contract",
      "✅ Listed on DEX with liquidity",
      "✅ Ownership renounced"
    ],
    "recommendation": "✅ SAFE - No significant security issues detected. Standard precautions still apply.",
    "details": {
      "isOpenSource": true,
      "hasRenouncedOwner": true,
      "isMintable": false,
      "canDisableTrade": false,
      "isBlacklisted": false
    },
    "source": "GoPlus + KiKo Hybrid Scanner",
    "offlineSignals": {
      "alerts": [],
      "flows": [],
      "fingerprints": []
    },
    "creator": {
      "address": "0x3ef8f695054010a27a9d72fbb6320ddf73038766",
      "riskLevel": "Safe",
      "tags": [
        "❓ Unknown Reputation"
      ]
    }
  }
}
```

Notes:
- This run used a cached result (faster). If you want a cold scan, clear Redis key `tool:token_risk:<address>:<chain>`.


## MarketSkill

### Tools tested

Command:
```
(npx -C kiko-api tsx src/scripts/testMarketSkill.ts)
```

Raw output:
```json
{
  "get_market_overview": {
    "indicators": [
      {
        "id": "VIX",
        "name": "VIX",
        "fullName": "CBOE Volatility Index",
        "value": 15.86,
        "change": -0.8900000000000006,
        "changePercent": -5.313432835820899,
        "previousClose": 16.75,
        "timestamp": "2026-01-16T21:15:01.000Z",
        "source": "Yahoo Finance",
        "category": "volatility"
      },
      {
        "id": "DXY",
        "name": "DXY",
        "fullName": "US Dollar Index",
        "value": 99.375,
        "change": 0.05500000000000682,
        "changePercent": 0.055376560612169584,
        "previousClose": 99.32,
        "timestamp": "2026-01-16T21:59:59.000Z",
        "source": "Yahoo Finance",
        "category": "currency"
      }
    ],
    "marketSentiment": {
      "score": 69,
      "label": "Greed",
      "analysis": "Market sentiment is Greed (69/100). VIX is at 15.86."
    }
  },
  "get_economic_calendar": [
    {
      "event": "Initial Jobless Claims",
      "date": "2026-01-22T00:30:00.000Z",
      "impact": "medium",
      "forecast": "221K",
      "previous": "218K",
      "country": "US"
    }
  ],
  "get_gas_price": {
    "source": "Etherscan/Blockscan",
    "chain": "eth",
    "safe": "0.038277972 Gwei",
    "standard": "0.038277982 Gwei",
    "fast": "0.042325769 Gwei",
    "baseFee": "0.038277972 Gwei"
  },
  "web_search": {
    "results": "[1] The Ethereum ETF green light: Bob's deep dive into the SEC's ...\n...",
    "citations": [
      "https://www.bobsguide.com/the-ethereum-etf-green-light-the-secs-pivotal-approval/",
      "https://www.foley.com/insights/publications/2024/07/next-ethereum-etfs-sec-approval/",
      "https://digitalassetsus.wbresearch.com/blog/what-the-approval-of-the-ethereum-etf-means-for-the-digital-assets-ecosystem"
    ]
  }
}
```

Notes:
- Economic calendar is schedule-based (not live from a paid feed).
- Web search uses Tavily; results are summarized as a text block with citations.


## SocialSkill

### Tools tested

Command:
```
(npx -C kiko-api tsx src/scripts/testSocialSkill.ts)
```

Raw output:
```json
{
  "get_trending_casts": {
    "count": 5,
    "casts": [
      {
        "hash": "0x893590ad98cfd3",
        "author": {
          "username": "jesse.base.eth",
          "displayName": "Jesse Pollak",
          "fid": 99
        },
        "text": "We build in the open because that's the only way to build a global economy that reaches a billion people.",
        "stats": {
          "likes": 2000,
          "recasts": 308,
          "replies": 540
        },
        "heatScore": 999.99
      }
    ]
  },
  "search_farcaster_casts": {
    "success": true,
    "query": "Base",
    "count": 0,
    "casts": [],
    "note": "No casts found matching your search. Try different keywords."
  },
  "get_farcaster_user": {
    "error": "timeout_after_10000ms"
  }
}
```

Notes:
- Search hit a DB schema error earlier (`search_vector` missing) and Neynar API returned 402 (paid plan) in the run logs.
- `get_farcaster_user` timed out at 10s in this test (Snapchain/DB fallback slow).


## WalletSkill

### Tools tested

Command:
```
(npx -C kiko-api tsx src/scripts/testWalletSkill.ts)
```

Raw output:
```json
{
  "get_wallet_info": {
    "address": "0x00000000219ab540356cBB839Cbe05303d7705Fa",
    "chain": "eth",
    "ethBalance": "77854586.2399 ETH",
    "tokens": []
  },
  "analyze_wallet_pnl": {
    "address": "0x00000000219ab540356cBB839Cbe05303d7705Fa",
    "chain": "ethereum",
    "timeRange": "30 days",
    "summary": {
      "totalRealizedPnlUsd": 0,
      "totalRealizedProfitUsd": 0,
      "totalRealizedLossUsd": 0,
      "tradingPnlUsd": 0,
      "totalBoughtUsd": 0,
      "totalSoldUsd": 0,
      "winRate": 0,
      "tradingWinRate": 0,
      "totalTrades": 0,
      "profitableTrades": 0
    },
    "topTokens": []
  },
  "get_user_favorites": {
    "message": "User has no favorite tokens yet.",
    "favorites": [],
    "count": 0
  }
}
```

Notes:
- PNL query returned zero trades for this wallet (expected for deposit contract).
- `get_wallet_info` tokens list empty in this run; only native balance returned.


## CopyTradeSkill

### Tools tested

Command:
```
(npx -C kiko-api tsx src/scripts/testCopyTradeSkill.ts)
```

Raw output:
```json
{
  "create_copy_trade_config": {
    "summary": "✅ Copy trade config created successfully!\n\nTarget: `0x1111111111111111111111111111111111111111`\nBuy Amount: $5\n\nI will now automatically copy trades from this wallet.",
    "config_id": "cmkhz0y0m0002jkrzor1ajdj7",
    "__client_action": {
      "type": "show_strategy_card",
      "data": {
        "id": "cmkhz0y0m0002jkrzor1ajdj7",
        "name": "Follow 0x1111...1111",
        "type": "copy_trade",
        "tokenIn": "ETH",
        "tokenOut": "ANY",
        "chain": "base",
        "chainId": 8453,
        "triggerCondition": "Target buys token",
        "executionAmount": "5",
        "amountAsset": "USD",
        "status": "active",
        "createdAt": 1768634012470,
        "updatedAt": 1768634012470,
        "trigger": {
          "type": "wallet_action",
          "wallet_address": "0x1111111111111111111111111111111111111111"
        }
      }
    }
  },
  "list_copy_trade_configs": [
    {
      "id": "cmkhz0y0m0002jkrzor1ajdj7",
      "target": "0x1111111111111111111111111111111111111111",
      "buy_amount": "$5",
      "status": "active"
    }
  ],
  "pause_copy_trade_config": {
    "summary": "✅ Configuration for `0x1111111111111111111111111111111111111111` has been paused."
  },
  "delete_copy_trade_config": {
    "summary": "✅ Stopped copy trading for target `EVM Wallet 0x1111111111111111111111111111111111111111`."
  }
}
```

Notes:
- This test created and deleted a demo config for `demo-user-copy`.


## PolymarketSkill

### Tools tested

Command:
```
(npx -C kiko-api tsx src/scripts/testPolymarketSkill.ts)
```

Raw output:
```json
{
  "get_polymarket_trending": {
    "source": "Polymarket",
    "type": "Trending Events",
    "count": 3,
    "events": [
      {
        "id": "45883",
        "title": "Fed decision in January?",
        "vol24h": "$385,302,711",
        "liquidity": "$18,502,281",
        "endDate": "2026-01-28"
      }
    ],
    "note": "Use get_polymarket_event with an event ID to see specific market odds."
  },
  "get_polymarket_trending_markets": {
    "source": "Polymarket",
    "type": "Trending Questions",
    "count": 3,
    "questions": [
      {
        "question": "Fed decreases interest rates by 50+ bps after January 2026 meeting?",
        "yes": "0.4%",
        "no": "99.7%",
        "vol24h": "$8,236,160",
        "liquidity": "$6,414,405.432",
        "endDate": "2026-01-28"
      }
    ]
  },
  "search_polymarket": {
    "source": "Polymarket",
    "query": "Bitcoin",
    "count": 0,
    "events": [],
    "note": "Use get_polymarket_event with an ID to see detailed odds."
  },
  "get_polymarket_event": {
    "source": "Polymarket",
    "title": "Fed decision in January?",
    "totalVolume": "$385,283,046",
    "liquidity": "$18,503,382",
    "endDate": "2026-01-28",
    "markets": [
      {
        "id": "601697",
        "question": "Fed decreases interest rates by 50+ bps after January 2026 meeting?",
        "yes": "0.4%",
        "no": "99.7%",
        "vol24h": "$8,236,160"
      }
    ]
  },
  "get_new_markets": {
    "source": "Polymarket",
    "type": "Newest Events",
    "count": 3,
    "events": [
      {
        "id": "169632",
        "title": "Ethereum Up or Down - January 18, 2:05AM-2:10AM ET",
        "createdAt": "1/17/2026",
        "liquidity": "$0"
      }
    ]
  },
  "get_market_activity": {
    "message": "No recent trades found for this token ID within the limit."
  },
  "get_whale_watch": {
    "source": "Polymarket/Goldsky",
    "type": "Abnormal/Whale Activity",
    "min_threshold": "$1000",
    "count": 5,
    "trades": [
      {
        "type": "SELL",
        "usdc_volume": "$1,999",
        "price": "0.918",
        "time": "2026-01-17T07:14:42.000Z",
        "market_maker": "0xf691...",
        "tx": "0xd006da81cc9c12537972ad4d2510303e8ff03844c2f9469fe1f81cd8086445a2"
      }
    ]
  },
  "check_polymarket_readiness": {
    "ready": false,
    "credentials": false,
    "approvals": {
      "usdc": "❌",
      "ctf": "❌"
    },
    "wallet_address": null,
    "usdc_balance": "0",
    "message": "⚠️ Setup needed before trading.",
    "missing_steps": [
      "Generate Polymarket API credentials"
    ],
    "next_step": "Generate Polymarket API credentials"
  },
  "setup_polymarket_credentials": {
    "success": false,
    "error": "Failed to get user wallet",
    "message": "❌ Failed to generate API credentials."
  },
  "check_polymarket_approvals": {
    "approved": false,
    "error": "Failed to get user wallet"
  },
  "place_polymarket_order": {
    "error": "User authentication required"
  },
  "create_polymarket_copy_config": {
    "error": "Invalid prisma.user.create: walletAddress unique constraint"
  },
  "list_polymarket_positions": {
    "message": "User not found within system."
  },
  "get_polymarket_trader_stats": {
    "wallet": "0x11111111...",
    "open_positions": 0,
    "total_value": "$0",
    "total_pnl": "$0",
    "top_positions": []
  }
}
```

Notes:
- Trading tools require a real Privy user + wallet; demo user fails credential setup and approvals.
- `create_polymarket_copy_config` hit a DB uniqueness constraint (walletAddress). Use a unique demo wallet if you want a full create/list cycle.


## ZoraSkill

### Tools tested

Command:
```
(npx -C kiko-api tsx src/scripts/testZoraSkill.ts)
```

Raw output:
```json
{
  "get_zora_trending": {
    "success": true,
    "category": "new",
    "count": 5,
    "coins": [
      {
        "name": "DAY 5",
        "symbol": "DAY 5",
        "address": "0x3ba25dd9f56170bbcaf14da08d77291248f5ca9c",
        "priceUsdc": null,
        "marketCapUsdc": "0"
      }
    ]
  },
  "get_zora_profile": {
    "success": true,
    "profile": {
      "displayName": "Jesse Pollak",
      "bio": "@base builder #001",
      "avatar": "https://...",
      "socialAccounts": {
        "twitter": {
          "username": "jessepollak",
          "displayName": "jesse.base.eth",
          "followerCount": 338411
        },
        "farcaster": {
          "username": "jessepollak",
          "displayName": "jesse.base.eth 🔵",
          "followerCount": 363819,
          "id": "99"
        }
      },
      "creatorCoin": {
        "address": "0x50f88fe97f72cd3e75b9eb4f747f59bceba80d59",
        "marketCap": "4666080.84"
      }
    }
  }
}
```

Notes:
- `priceUsdc` can be null for very new coins.

### Tools tested (re-run with backend running)

Command:
```
(npx -C kiko-api tsx src/scripts/testSwapSkill.ts)
```

Raw output:
```json
{
  "simulate_swap": {
    "expected_out": "0",
    "expected_out_human": "0",
    "price_impact": "0%",
    "price_impact_pct": 0,
    "is_safe": false,
    "path": "direct",
    "fee": "0",
    "fee_human": "0",
    "warning": null,
    "quote_ok": true
  },
  "prepare_swap_transaction": {
    "__client_action": {
      "type": "show_swap_card",
      "payload": {
        "tokenIn": "USDC",
        "tokenOut": "ETH",
        "amountIn": "10",
        "chainId": 8453,
        "slippage": 0.5
      }
    },
    "mode": "prepared",
    "requires_user_confirmation": true,
    "summary": "Prepared swap for 10 USDC to ETH on chain 8453. Please confirm the transaction details in the card."
  }
}
```

Notes:
- Backend responded but returned zero expected_out for this quote; treat as non-actionable and ask the user to retry or adjust amount.

### Tools tested (re-run with backend running)

Command:
```
(npx -C kiko-api tsx src/scripts/testTokenSkill.ts)
```

Raw output:
```json
{
  "get_token_info": {
    "source": "DexScreener",
    "address": "0x1a5F9d77CA46646cD4937fD8d093F460B66F4444",
    "symbol": "老子",
    "chainId": 56,
    "price": 0.005055,
    "volume24h": 3367481.02,
    "liquidity": 500792.66,
    "fdv": 5055799,
    "isLaunchpad": true,
    "launchpadProvider": "fourmeme",
    "priceUsd": 0.005055,
    "liquidityUsd": 500792.66,
    "fdvUsd": 5055799,
    "volume24hUsd": 3367481.02,
    "priceChange24hPct": 19.64
  },
  "get_trending_tokens": [
    {
      "rank": 1,
      "name": "Coinbase Wrapped BTC",
      "symbol": "cbBTC",
      "price": "95,165",
      "volume5m": "$44K",
      "change5m": "0.01%",
      "liquidity": "$27.98M"
    }
  ],
  "get_token_price": {
    "symbol": "ETH",
    "price": "$3,289.205",
    "priceRaw": 3289.205,
    "source": "Coinbase"
  },
  "get_historical_price": {
    "symbol": "BTC",
    "date": "2024-01-01",
    "price": "$42,288.58",
    "priceRaw": 42288.58,
    "currency": "USD",
    "source": "Coinbase"
  },
  "get_early_buyers": {
    "success": true,
    "buyerCount": 5
  },
  "analyze_creator": {
    "success": true,
    "riskLevel": "Safe",
    "riskScore": 10
  }
}
```

### Tools tested (re-run with backend running)

Command:
```
(npx -C kiko-api tsx src/scripts/testMarketSkill.ts)
```

Raw output:
```json
{
  "get_market_overview": {
    "indicators": [
      {
        "id": "VIX",
        "value": 15.86,
        "changePercent": -5.31
      },
      {
        "id": "DXY",
        "value": 99.375,
        "changePercent": 0.055
      }
    ],
    "marketSentiment": {
      "score": 69,
      "label": "Greed"
    }
  },
  "get_economic_calendar": [
    {
      "event": "Initial Jobless Claims",
      "impact": "medium",
      "forecast": "225K",
      "previous": "217K"
    }
  ],
  "get_gas_price": {
    "source": "Etherscan/Blockscan",
    "chain": "eth",
    "safe": "0.029506439 Gwei",
    "standard": "0.029506449 Gwei",
    "fast": "0.032457093 Gwei"
  },
  "web_search": {
    "results": "[1] The Ethereum ETF green light...",
    "citations": [
      "https://www.bobsguide.com/the-ethereum-etf-green-light-the-secs-pivotal-approval/"
    ]
  }
}
```

### Tools tested (re-run with backend running)

Command:
```
(npx -C kiko-api tsx src/scripts/testSocialSkill.ts)
```

Raw output:
```json
{
  "get_trending_casts": {
    "count": 5,
    "casts": [
      {
        "hash": "0x893590ad98cfd3",
        "author": {
          "username": "jesse.base.eth",
          "displayName": "Jesse Pollak",
          "fid": 99
        },
        "text": "We build in the open because that's the only way to build a global economy that reaches a billion people.",
        "stats": {
          "likes": 2000,
          "recasts": 308,
          "replies": 540
        },
        "heatScore": 999.99
      }
    ]
  },
  "search_farcaster_casts": {
    "success": true,
    "query": "Base",
    "count": 0,
    "casts": [],
    "note": "No casts found matching your search. Try different keywords."
  },
  "get_farcaster_user": {
    "error": "timeout_after_10000ms"
  }
}
```

Notes:
- Search still depends on DB `search_vector` and paid Neynar; zero results returned.
- `get_farcaster_user` timed out at 10s in this run.

### Tools tested (re-run with backend running)

Command:
```
(npx -C kiko-api tsx src/scripts/testWalletSkill.ts)
```

Raw output:
```json
{
  "get_wallet_info": {
    "address": "0x00000000219ab540356cBB839Cbe05303d7705Fa",
    "chain": "eth",
    "ethBalance": "77854650.2399 ETH",
    "tokens": []
  },
  "analyze_wallet_pnl": {
    "address": "0x00000000219ab540356cBB839Cbe05303d7705Fa",
    "chain": "ethereum",
    "timeRange": "30 days",
    "summary": {
      "totalRealizedPnlUsd": 0,
      "totalRealizedProfitUsd": 0,
      "totalRealizedLossUsd": 0,
      "tradingPnlUsd": 0,
      "totalBoughtUsd": 0,
      "totalSoldUsd": 0,
      "winRate": 0,
      "tradingWinRate": 0,
      "totalTrades": 0,
      "profitableTrades": 0
    },
    "topTokens": []
  },
  "get_user_favorites": {
    "message": "User has no favorite tokens yet.",
    "favorites": [],
    "count": 0
  }
}
```

### Tools tested (re-run with backend running)

Command:
```
(npx -C kiko-api tsx src/scripts/testCopyTradeSkill.ts)
```

Raw output:
```json
{
  "create_copy_trade_config": {
    "summary": "✅ Copy trade config created successfully!\n\nTarget: `0x1111111111111111111111111111111111111111`\nBuy Amount: $5\n\nI will now automatically copy trades from this wallet.",
    "config_id": "cmkhzgkyh0001oz5ppxazmwxc",
    "__client_action": {
      "type": "show_strategy_card",
      "data": {
        "id": "cmkhzgkyh0001oz5ppxazmwxc",
        "name": "Follow 0x1111...1111",
        "type": "copy_trade",
        "tokenIn": "ETH",
        "tokenOut": "ANY",
        "chain": "base",
        "chainId": 8453
      }
    }
  },
  "list_copy_trade_configs": [
    {
      "id": "cmkhzgkyh0001oz5ppxazmwxc",
      "target": "0x1111111111111111111111111111111111111111",
      "buy_amount": "$5",
      "status": "active"
    }
  ],
  "pause_copy_trade_config": {
    "summary": "✅ Configuration for `0x1111111111111111111111111111111111111111` has been paused."
  },
  "delete_copy_trade_config": {
    "summary": "✅ Stopped copy trading for target `EVM Wallet 0x1111111111111111111111111111111111111111`."
  }
}
```

### Tools tested (re-run with backend running)

Command:
```
(npx -C kiko-api tsx src/scripts/testPolymarketSkill.ts)
```

Raw output:
```json
{
  "get_polymarket_trending": {
    "source": "Polymarket",
    "type": "Trending Events",
    "count": 3,
    "events": [
      {
        "id": "45883",
        "title": "Fed decision in January?",
        "vol24h": "$385,376,355",
        "liquidity": "$18,595,345",
        "endDate": "2026-01-28"
      }
    ]
  },
  "get_polymarket_trending_markets": {
    "source": "Polymarket",
    "type": "Trending Questions",
    "count": 3,
    "questions": [
      {
        "question": "Fed decreases interest rates by 50+ bps after January 2026 meeting?",
        "yes": "0.4%",
        "no": "99.7%",
        "vol24h": "$8,236,160",
        "liquidity": "$6,538,030.205",
        "endDate": "2026-01-28"
      }
    ]
  },
  "search_polymarket": {
    "source": "Polymarket",
    "query": "Bitcoin",
    "count": 0,
    "events": []
  },
  "get_polymarket_event": {
    "source": "Polymarket",
    "title": "Fed decision in January?",
    "totalVolume": "$385,317,714",
    "liquidity": "$18,483,572",
    "endDate": "2026-01-28",
    "markets": [
      {
        "id": "601697",
        "question": "Fed decreases interest rates by 50+ bps after January 2026 meeting?",
        "yes": "0.4%",
        "no": "99.7%",
        "vol24h": "$8,236,160"
      }
    ]
  },
  "get_new_markets": {
    "source": "Polymarket",
    "type": "Newest Events",
    "count": 3,
    "events": [
      {
        "id": "169644",
        "title": "Bitcoin Up or Down - January 18, 2:15AM-2:30AM ET",
        "createdAt": "1/17/2026",
        "liquidity": "$13,724"
      }
    ]
  },
  "get_market_activity": {
    "message": "No recent trades found for this token ID within the limit."
  },
  "get_whale_watch": {
    "source": "Polymarket/Goldsky",
    "type": "Abnormal/Whale Activity",
    "min_threshold": "$1000",
    "count": 5
  },
  "check_polymarket_readiness": {
    "ready": false,
    "credentials": false,
    "approvals": {
      "usdc": "❌",
      "ctf": "❌"
    },
    "wallet_address": null,
    "usdc_balance": "0",
    "message": "⚠️ Setup needed before trading.",
    "missing_steps": [
      "Generate Polymarket API credentials"
    ],
    "next_step": "Generate Polymarket API credentials"
  },
  "setup_polymarket_credentials": {
    "success": false,
    "error": "Failed to get user wallet"
  },
  "check_polymarket_approvals": {
    "approved": false,
    "error": "Failed to get user wallet"
  },
  "place_polymarket_order": {
    "error": "User authentication required"
  },
  "create_polymarket_copy_config": {
    "error": "Invalid prisma.user.create: walletAddress unique constraint"
  },
  "list_polymarket_positions": {
    "message": "User not found within system."
  },
  "get_polymarket_trader_stats": {
    "wallet": "0x11111111...",
    "open_positions": 0,
    "total_value": "$0",
    "total_pnl": "$0",
    "top_positions": []
  }
}
```

Notes:
- Polymarket trading tools require a real Privy user + wallet; demo user fails credential setup and approvals.

### Tools tested (re-run with backend running)

Command:
```
(npx -C kiko-api tsx src/scripts/testZoraSkill.ts)
```

Raw output:
```json
{
  "get_zora_trending": {
    "success": true,
    "category": "new",
    "count": 5,
    "coins": [
      {
        "name": "WE GO AGAIN TODAY GM",
        "symbol": "WE GO AGAIN TODAY GM",
        "address": "0x32d7def501593f6d5a3b82e56fa472c2c98e75fe",
        "priceUsdc": "0.000000051043553457912149590585205208941776855",
        "marketCapUsdc": "51.04"
      }
    ]
  },
  "get_zora_profile": {
    "success": true,
    "profile": {
      "displayName": "Jesse Pollak",
      "bio": "@base builder #001",
      "socialAccounts": {
        "twitter": { "username": "jessepollak" },
        "farcaster": { "username": "jessepollak", "id": "99" }
      },
      "creatorCoin": {
        "address": "0x50f88fe97f72cd3e75b9eb4f747f59bceba80d59",
        "marketCap": "4666054.24"
      }
    }
  }
}
```

### Tools tested (time-range enabled)

Command:
```
(npx -C kiko-api tsx src/scripts/testTokenSkill.ts)
```

Raw output:
```json
{
  "get_early_buyers": {
    "success": false,
    "message": "No early buyers found for 0x1a5F9d77CA46646cD4937fD8d093F460B66F4444 on bsc. Token may be too new or not have trading activity yet."
  }
}
```

Notes:
- In this run we used a 7-day time window; the filter can return zero even when historical buyers exist.

