[Debug] [vite] connected. (client, line 827)
[Log] [FetchInterceptor] Initialized with App Key: – "present" – "| Signing:" – "enabled" (fetchInterceptor.ts, line 55)
[Debug] Embedded1193Provider.request() called with args – {method: "eth_accounts"} (chunk-WSF2IQ52.js, line 29908)
[Debug] eth_accounts for privy: – ["0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E"] (1) (chunk-W3TCNXMT.js, line 1707)
[Debug] Embedded1193Provider.request() called with args – {method: "wallet_switchEthereumChain", params: [{chainId: "0x2105"}]} (chunk-WSF2IQ52.js, line 29908)
[Warning] [CopyTradeApi] No token available, skipping fetch. (copyTradeApi.ts, line 24)
[Log] [ChatWS] Connecting to user WebSocket... (chatWebSocket.ts, line 32)
[Error] [CopyTradeApi] Error fetching positions: – Error: No authentication token available — copyTradeApi.ts:43
Error: No authentication token available — copyTradeApi.ts:43
	（匿名函数） (copyTradeApi.ts:93)
[Log] [ChatWS] Connected to user WebSocket (chatWebSocket.ts, line 35)
[Error] Failed to load resource: the server responded with a status of 403 (Forbidden) (sessions, line 0)
[Error] [chatApi] Error /api/chat/sessions?limit=50&offset=0: – {message: "Request origin not allowed", name: "Error", stack: "chatFetch@http://localhost:5173/src/services/api.ts:351:22"}
	error (logger.ts:57)
	chatFetch (api.ts:355)
[Error] [useConversations] Failed to load sessions: – Error: Request origin not allowed — api.ts:642
Error: Request origin not allowed — api.ts:642chatFetch — api.ts:642
	（匿名函数） (useConversations.ts:42)
[Error] Failed to load resource: the server responded with a status of 403 (Forbidden) (balance, line 0)
[Error] [WalletApi] Balance API error: – "{\"success\":false,\"error\":\"Request origin not allowed\",\"code\":\"ORIGIN_NOT_ALLOWED\",\"requestId\":\"req-l\",\"timestamp\":\"2026-01-29T04:27:00.327Z\"…"
"{\"success\":false,\"error\":\"Request origin not allowed\",\"code\":\"ORIGIN_NOT_ALLOWED\",\"requestId\":\"req-l\",\"timestamp\":\"2026-01-29T04:27:00.327Z\"}"
	getWalletBalance (walletApi.ts:37)
[Error] Failed to load resource: the server responded with a status of 403 (Forbidden) (balance, line 0)
[Error] [SwapService] Portfolio API error: – 403
	（匿名函数） (swapService.ts:342)
[Debug] Detected injected providers: – [] (0) (chunk-W3TCNXMT.js, line 1589)