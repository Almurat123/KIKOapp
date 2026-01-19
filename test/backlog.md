Timer finished: prompt_gen_TRADING_grok
Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
[ChatWorker] Grok: Detected contract address: 0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525
TokenDetector: DexScreener search failed
[ChatWorker] Grok: Waiting for early pre-fetch to complete
Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
[Model] Original: grok-4-non-reasoning -> Normalized: grok-4-1-fast-non-reasoning
[RAG] 🔍 Informational query detected: '[CONTEXT]
- Current Time: 2026-01-19T08:05:40.014Z...'
INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[RAG] ℹ️ No results from vector store
[Tools] Dynamic tool set from Node: 6 tool(s) (5 custom)
[Chat] Creating chat with model: grok-4-1-fast-non-reasoning (original: grok-4-non-reasoning)
[Chat] Creating chat with 6 tool(s): get_token_info, , prepare_swap_transaction, check_token_risk, get_early_buyers, analyze_creator
[Chat] Chat created
[Messages] Adding 3 message(s) to chat
[Messages] [1] System prompt from Node.js (length=17870 chars)
[Messages] [2] User: [CONTEXT]
- Current Time: 2026-01-19T08:05:40.014Z...
[Messages] [3] Assistant: (skipped)
[Chat] Starting streaming response generation
[Tools] Custom tool allowlist size: 5
INFO:     10.134.177.202:46376 - "POST /grok/v1/chat/completions HTTP/1.1" 200 OK
[Generate] Starting generator
[Tool Call] Detected in chunk: 1 tool(s)
[Tool Call] get_token_info: {"address":"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","chain":"base"}...
[Tool Call] Custom tool detected - buffered content will be discarded
[Tool Call Event] Sending tool call event for get_token_info (ID: call_1768809943610077_8266930701930855180)
[Custom Tool] Executing get_token_info...
[Tool Execution] Executing tool: get_token_info with args: {'address': '0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525', 'chain': 'base'}
[Tool Execution] 🔍 KIKO_API_BASE = http://kiko-api-production.up.railway.app
[Tool Execution] 🔍 Calling unified executor at: http://kiko-api-production.up.railway.app/api/ai/tools/execute
INFO:httpx:HTTP Request: POST http://kiko-api-production.up.railway.app/api/ai/tools/execute "HTTP/1.1 301 Moved Permanently"
[Tool Execution] Unified tool executor failed (301), falling back
INFO:httpx:HTTP Request: GET http://kiko-api-production.up.railway.app/api/tokens/base/0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525 "HTTP/1.1 301 Moved Permanently"
[Custom Tool] get_token_info returned: 41 chars
[Custom Tool] Appending tool result to chat: {"error": "Token info fetch failed: 301"}...
[Custom Tool] Added tool result to chat, will call Grok again
[Tool Call] Detected in chunk: 1 tool(s)
[Tool Call] check_token_risk: {"address":"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","chain":"base"}...
[Tool Call] Custom tool detected - buffered content will be discarded
[Tool Call Event] Sending tool call event for check_token_risk (ID: call_1768809943845465_2028094822084507725)
[Custom Tool] Executing check_token_risk...
[Tool Execution] Executing tool: check_token_risk with args: {'address': '0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525', 'chain': 'base'}
[Tool Execution] 🔍 KIKO_API_BASE = http://kiko-api-production.up.railway.app
[Tool Execution] 🔍 Calling unified executor at: http://kiko-api-production.up.railway.app/api/ai/tools/execute
INFO:httpx:HTTP Request: POST http://kiko-api-production.up.railway.app/api/ai/tools/execute "HTTP/1.1 301 Moved Permanently"
[Tool Execution] Unified tool executor failed (301), falling back
INFO:httpx:HTTP Request: GET http://kiko-api-production.up.railway.app/api/security/scan?address=0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525&chain=base "HTTP/1.1 301 Moved Permanently"
[Custom Tool] check_token_risk returned: 38 chars
[Custom Tool] Appending tool result to chat: {"error": "Security scan failed: 301"}...
[Custom Tool] Added tool result to chat, will call Grok again
[Tool Call] Detected in response (fallback): 2 tool(s)
[Tool Call] Skipping duplicate: get_token_info (already processed)
[Tool Call] Skipping duplicate: check_token_risk (already processed)
[Tool Turn] Tool call detected, continuing to turn 2
[TokenJob] Fetching trending tokens for Optimism via DexScreener Premium...
Fetching premium trending tokens
Using fallback discovery (Boosts + Organic search)
No trending tokens discovered for chain
Processed DexScreener trending candidates
[TokenJob] DexScreener returned 0 tokens, trying GeckoTerminal fallback...
Repeated x3: API-5004:External API requested retry
External API requested retry
[Citations] No final response available
[Citations] Final: No citations collected
[Usage] Prompt: 6272, Completion: 110, Total: 6382
INFO:moderation.router:Moderating input: ⚠️ **Token fetch failed** (error 301) – likely inv...
[TokenJob] No tokens found for Optimism
[ChatWorker DEBUG] Stream line with valid data: data: {"id": "chatcmpl-6294074650853433098", "object": "chat.completion.chunk", "created": 1768809947, "model": "grok-4-non-reasoning", "choices": [{"index": 0, "delta": {}, "message": {"citations": []}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 6272, "completion_tokens": 110, "total_tokens": 6382}}
Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_citations
API error on trending page
Trending tokens fetch complete
INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
INFO:     10.134.177.202:47548 - "POST /moderation/input HTTP/1.1" 200 OK
Moderation Output check result
[ChatWorker] Grok task cmkkvrh7104p97jo5r1hjs47g completed, 109 chunks
Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
[ChatWorker] Task cmkkvrh7104p97jo5r1hjs47g completed successfully
incoming request
request completed
incoming request
request completed
[PositionMonitor] 🔄 Running position check...
No open positions to monitor
[TokenJob] Fetching trending tokens for Polygon via DexScreener Premium...
Fetching premium trending tokens
Using fallback discovery (Boosts + Organic search)
No trending tokens discovered for chain
Processed DexScreener trending candidates
[TokenJob] DexScreener returned 0 tokens, trying GeckoTerminal fallback...
Repeated x3: API-5004:External API requested retry
External API requested retry
API error on trending page
