2026-01-08T05:32:28.665Z	Initializing build environment...
2026-01-08T05:32:59.693Z	Success: Finished initializing build environment
2026-01-08T05:32:59.962Z	Cloning repository...
2026-01-08T05:33:01.379Z	Detected the following tools from environment: npm@10.9.2, nodejs@22.16.0
2026-01-08T05:33:01.381Z	Restoring from dependencies cache
2026-01-08T05:33:01.383Z	Restoring from build output cache
2026-01-08T05:33:01.573Z	Installing project dependencies: npm clean-install --progress=false
2026-01-08T05:33:09.631Z	npm warn deprecated @paulmillr/qr@0.2.1: The package is now available as "qr": npm install qr
2026-01-08T05:33:15.789Z	npm warn deprecated @walletconnect/sign-client@2.21.0: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T05:33:15.890Z	npm warn deprecated @walletconnect/sign-client@2.21.0: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T05:33:15.917Z	npm warn deprecated @walletconnect/sign-client@2.21.0: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T05:33:15.952Z	npm warn deprecated @walletconnect/sign-client@2.21.1: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T05:33:16.280Z	npm warn deprecated @walletconnect/universal-provider@2.21.1: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T05:33:16.299Z	npm warn deprecated @walletconnect/universal-provider@2.21.0: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T05:33:16.343Z	npm warn deprecated @walletconnect/universal-provider@2.21.0: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T05:33:16.344Z	npm warn deprecated @walletconnect/universal-provider@2.21.0: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T05:33:17.746Z	npm warn deprecated @walletconnect/ethereum-provider@2.21.1: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T05:34:01.109Z	
2026-01-08T05:34:01.109Z	added 1272 packages, and audited 1273 packages in 59s
2026-01-08T05:34:01.110Z	
2026-01-08T05:34:01.110Z	258 packages are looking for funding
2026-01-08T05:34:01.110Z	  run `npm fund` for details
2026-01-08T05:34:01.111Z	
2026-01-08T05:34:01.112Z	5 vulnerabilities (1 moderate, 4 high)
2026-01-08T05:34:01.112Z	
2026-01-08T05:34:01.112Z	To address issues that do not require attention, run:
2026-01-08T05:34:01.112Z	  npm audit fix
2026-01-08T05:34:01.112Z	
2026-01-08T05:34:01.112Z	To address all issues (including breaking changes), run:
2026-01-08T05:34:01.112Z	  npm audit fix --force
2026-01-08T05:34:01.112Z	
2026-01-08T05:34:01.112Z	Run `npm audit` for details.
2026-01-08T05:34:01.339Z	Executing user build command: npm run build
2026-01-08T05:34:01.555Z	
2026-01-08T05:34:01.555Z	> kiko-web@0.0.0 build
2026-01-08T05:34:01.555Z	> tsc -b && vite build
2026-01-08T05:34:01.555Z	
2026-01-08T05:34:11.655Z	src/components/Chat/ChatInputSuggestions.tsx(2,29): error TS6133: 'Wallet' is declared but its value is never read.
2026-01-08T05:34:11.657Z	src/components/Chat/ChatInputSuggestions.tsx(2,37): error TS6133: 'Search' is declared but its value is never read.
2026-01-08T05:34:11.658Z	src/components/Chat/ChatInputSuggestions.tsx(2,57): error TS6133: 'Zap' is declared but its value is never read.
2026-01-08T05:34:11.658Z	src/components/Chat/ChatInterface.tsx(12,1): error TS6133: 'useSmartSuggestions' is declared but its value is never read.
2026-01-08T05:34:11.658Z	src/components/Chat/ChatInterface.tsx(83,5): error TS6133: 'conversationTitle' is declared but its value is never read.
2026-01-08T05:34:11.658Z	src/components/Chat/ChatInterface.tsx(84,5): error TS6133: 'onNewChat' is declared but its value is never read.
2026-01-08T05:34:11.658Z	src/components/Chat/ChatInterface.tsx(156,11): error TS6133: 'chainName' is declared but its value is never read.
2026-01-08T05:34:11.658Z	src/components/Chat/ChatInterface.tsx(176,12): error TS6133: 'stoppedMessageId' is declared but its value is never read.
2026-01-08T05:34:11.658Z	src/components/Chat/ChatInterface.tsx(176,30): error TS6133: 'setStoppedMessageId' is declared but its value is never read.
2026-01-08T05:34:11.662Z	src/components/Chat/ChatInterface.tsx(177,12): error TS6133: 'stoppedMessageContent' is declared but its value is never read.
2026-01-08T05:34:11.662Z	src/components/Chat/ChatInterface.tsx(177,35): error TS6133: 'setStoppedMessageContent' is declared but its value is never read.
2026-01-08T05:34:11.662Z	src/components/Chat/ChatInterface.tsx(395,31): error TS6133: 'hasContent' is declared but its value is never read.
2026-01-08T05:34:11.662Z	src/components/Chat/ChatInterface.tsx(927,11): error TS6133: 'initialMessagesKey' is declared but its value is never read.
2026-01-08T05:34:11.663Z	src/components/Chat/ManualTradingConfirmationCard.tsx(33,18): error TS6133: 'setStep' is declared but its value is never read.
2026-01-08T05:34:11.663Z	src/components/Chat/StrategyCard.tsx(1,17): error TS6133: 'useState' is declared but its value is never read.
2026-01-08T05:34:11.663Z	src/components/Chat/StrategyCard.tsx(2,71): error TS6133: 'RefreshCw' is declared but its value is never read.
2026-01-08T05:34:11.663Z	src/components/Chat/StrategyCard.tsx(18,3): error TS6133: 'onEdit' is declared but its value is never read.
2026-01-08T05:34:11.663Z	src/components/Chat/StrategyCard.tsx(19,3): error TS6133: 'onDelete' is declared but its value is never read.
2026-01-08T05:34:11.663Z	src/components/Chat/StrategyCard.tsx(21,3): error TS6133: 'onViewDetails' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Chat/StrategyCard.tsx(142,17): error TS17001: JSX elements cannot have multiple attributes with the same name.
2026-01-08T05:34:11.664Z	src/components/Chat/SwapCardChat.tsx(105,10): error TS6133: 'validateTokenResolvability' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Chat/WelcomeScreen.tsx(3,3): error TS6133: 'Sparkles' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Chat/WelcomeScreen.tsx(11,1): error TS6133: 'chatApi' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Chat/WelcomeScreen.tsx(12,1): error TS6133: 'getAuthToken' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Common/ImageViewer.tsx(136,41): error TS6133: 'e' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Launchpad/LaunchpadCard.tsx(16,1): error TS6133: 'raydiumLogo' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Launchpad/LaunchpadCard.tsx(178,9): error TS6133: 'nativeToken' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Launchpad/LaunchpadCard.tsx(225,9): error TS6133: 'safeCreator' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Launchpad/LaunchpadCard.tsx(283,11): error TS6133: 'scanToken' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Layout/Layout.tsx(57,5): error TS6133: 'onAIAnalyzeComplete' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Layout/Sidebar.tsx(43,3): error TS6133: 'onProfileClick' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Layout/Sidebar.tsx(53,32): error TS6133: 'login' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Privy/DelegatedActionRequest.tsx(1,8): error TS6133: 'React' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Privy/PreLoginWarningModal.tsx(2,1): error TS6133: 'ShieldAlert' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Social/CastCard3D.tsx(5,56): error TS6133: 'ExternalLink' is declared but its value is never read.
2026-01-08T05:34:11.664Z	src/components/Social/CastCard3D.tsx(6,1): error TS6133: 'useThemeContext' is declared but its value is never read.
2026-01-08T05:34:11.665Z	src/components/Social/ContentFrame.tsx(3,1): error TS6133: 'useThemeContext' is declared but its value is never read.
2026-01-08T05:34:11.665Z	src/components/Social/EmbedPreview.tsx(3,33): error TS6133: 'ImageIcon' is declared but its value is never read.
2026-01-08T05:34:11.665Z	src/components/Swap/SwapCardIntegrated.tsx(136,9): error TS6133: 'currentChainId' is declared but its value is never read.
2026-01-08T05:34:11.665Z	src/components/Swap/SwapCardIntegrated.tsx(219,18): error TS6133: 'connectWallet' is declared but its value is never read.
2026-01-08T05:34:11.665Z	src/components/Swap/SwapCardIntegrated.tsx(374,9): error TS6133: 'isWalletConnected' is declared but its value is never read.
2026-01-08T05:34:11.665Z	src/components/Trade/StrategyCard.tsx(2,42): error TS6133: 'Zap' is declared but its value is never read.
2026-01-08T05:34:11.665Z	src/components/Trade/StrategyCard.tsx(2,47): error TS6133: 'Activity' is declared but its value is never read.
2026-01-08T05:34:11.665Z	src/components/Trade/StrategyCard.tsx(23,3): error TS6133: 'onViewDetails' is declared but its value is never read.
2026-01-08T05:34:11.666Z	src/components/Wallet/ReceiveModal.tsx(3,26): error TS6133: 'QrCode' is declared but its value is never read.
2026-01-08T05:34:11.667Z	src/components/Wallet/SendModal.tsx(3,25): error TS6133: 'Wallet' is declared but its value is never read.
2026-01-08T05:34:11.667Z	src/components/Wallet/SendModal.tsx(39,24): error TS6133: 'isConfirming' is declared but its value is never read.
2026-01-08T05:34:11.667Z	src/components/index.ts(8,24): error TS2307: Cannot find module './Select' or its corresponding type declarations.
2026-01-08T05:34:11.667Z	src/components/index.ts(9,48): error TS2307: Cannot find module './Select' or its corresponding type declarations.
2026-01-08T05:34:11.667Z	src/contexts/ChainContext.tsx(90,9): error TS6133: 'wallets' is declared but its value is never read.
2026-01-08T05:34:11.667Z	src/contexts/ChainContext.tsx(91,41): error TS6133: 'user' is declared but its value is never read.
2026-01-08T05:34:11.668Z	src/hooks/useSolanaSwap.ts(68,9): error TS6133: 'signTransaction' is declared but its value is never read.
2026-01-08T05:34:11.671Z	src/hooks/useStrategies.ts(51,7): error TS6133: 'MAX_STRATEGIES' is declared but its value is never read.
2026-01-08T05:34:11.671Z	src/hooks/useStrategies.ts(54,7): error TS6133: 'createDemoStrategies' is declared but its value is never read.
2026-01-08T05:34:11.671Z	src/hooks/useStrategies.ts(271,43): error TS6133: 'id' is declared but its value is never read.
2026-01-08T05:34:11.671Z	src/hooks/useStrategies.ts(271,55): error TS6133: 'record' is declared but its value is never read.
2026-01-08T05:34:11.671Z	src/hooks/useSwap.ts(9,33): error TS6133: 'maxUint256' is declared but its value is never read.
2026-01-08T05:34:11.671Z	src/hooks/useSwap.ts(23,10): error TS6133: 'getTokenData' is declared but its value is never read.
2026-01-08T05:34:11.672Z	src/hooks/useSwap.ts(25,34): error TS6133: 'getMEVProtectedRPC' is declared but its value is never read.
2026-01-08T05:34:11.672Z	src/hooks/useSwap.ts(31,8): error TS6133: 'SlippageMode' is declared but its value is never read.
2026-01-08T05:34:11.674Z	src/hooks/useSwap.ts(36,3): error TS6133: 'getDegenSlippage' is declared but its value is never read.
2026-01-08T05:34:11.674Z	src/hooks/useSwap.ts(37,3): error TS6133: 'shouldAutoRetry' is declared but its value is never read.
2026-01-08T05:34:11.674Z	src/hooks/useSwap.ts(38,3): error TS6133: 'getRetryDelay' is declared but its value is never read.
2026-01-08T05:34:11.674Z	src/hooks/useSwap.ts(39,3): error TS6133: 'DEFAULT_DEGEN_CONFIG' is declared but its value is never read.
2026-01-08T05:34:11.674Z	src/hooks/useSwap.ts(40,8): error TS6133: 'DegenModeConfig' is declared but its value is never read.
2026-01-08T05:34:11.674Z	src/hooks/useSwap.ts(50,7): error TS6133: 'POPULAR_TOKENS' is declared but its value is never read.
2026-01-08T05:34:11.674Z	src/hooks/useSwap.ts(137,10): error TS6133: 'fromBaseUnits' is declared but its value is never read.
2026-01-08T05:34:11.674Z	src/hooks/useSwap.ts(234,10): error TS6133: 'retryCount' is declared but its value is never read.
2026-01-08T05:34:11.675Z	src/hooks/useSwap.ts(234,22): error TS6133: 'setRetryCount' is declared but its value is never read.
2026-01-08T05:34:11.675Z	src/hooks/useSwap.ts(377,16): error TS2339: Property 'swap' does not exist on type '{ log: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void; debug: (...args: any[]) => void; }'.
2026-01-08T05:34:11.675Z	src/hooks/useSwap.ts(430,16): error TS2339: Property 'swap' does not exist on type '{ log: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void; debug: (...args: any[]) => void; }'.
2026-01-08T05:34:11.675Z	src/hooks/useSwap.ts(549,9): error TS6133: 'fetchingPriceRef' is declared but its value is never read.
2026-01-08T05:34:11.675Z	src/hooks/useSwap.ts(551,9): error TS6133: 'lastPriceKeyRef' is declared but its value is never read.
2026-01-08T05:34:11.675Z	src/hooks/useSwap.ts(703,14): error TS2339: Property 'swap' does not exist on type '{ log: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void; debug: (...args: any[]) => void; }'.
2026-01-08T05:34:11.675Z	src/hooks/useSwap.ts(733,12): error TS2339: Property 'swap' does not exist on type '{ log: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void; debug: (...args: any[]) => void; }'.
2026-01-08T05:34:11.678Z	src/hooks/useSwap.ts(800,19): error TS6133: 'message' is declared but its value is never read.
2026-01-08T05:34:11.678Z	src/hooks/useSwap.ts(832,14): error TS2339: Property 'swap' does not exist on type '{ log: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void; debug: (...args: any[]) => void; }'.
2026-01-08T05:34:11.678Z	src/hooks/useSwap.ts(848,14): error TS2339: Property 'swap' does not exist on type '{ log: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void; debug: (...args: any[]) => void; }'.
2026-01-08T05:34:11.679Z	src/pages/ArticleDetailPage.tsx(1,8): error TS6133: 'React' is declared but its value is never read.
2026-01-08T05:34:11.679Z	src/pages/RiskPage.tsx(16,52): error TS6133: 'reason' is declared but its value is never read.
2026-01-08T05:34:11.679Z	src/pages/SocialPage.tsx(7,3): error TS6133: 'ArrowUpRight' is declared but its value is never read.
2026-01-08T05:34:11.679Z	src/pages/SocialPage.tsx(8,3): error TS6133: 'RefreshCw' is declared but its value is never read.
2026-01-08T05:34:11.679Z	src/pages/SocialPage.tsx(12,3): error TS6133: 'Filter' is declared but its value is never read.
2026-01-08T05:34:11.679Z	src/pages/SocialPage.tsx(43,7): error TS6133: 'TRENDING_FEED' is declared but its value is never read.
2026-01-08T05:34:11.679Z	src/pages/SocialPage.tsx(205,24): error TS6133: 'setSelectedCast' is declared but its value is never read.
2026-01-08T05:34:11.679Z	src/pages/SocialPage.tsx(212,9): error TS6133: 'displayContent' is declared but its value is never read.
2026-01-08T05:34:11.679Z	src/pages/SocialPage.tsx(217,9): error TS6133: 'twitterLinks' is declared but its value is never read.
2026-01-08T05:34:11.679Z	src/pages/SocialPage.tsx(232,9): error TS6133: 'handleClick' is declared but its value is never read.
2026-01-08T05:34:11.679Z	src/pages/SocialPage.tsx(236,9): error TS6133: 'handleExpandClick' is declared but its value is never read.
2026-01-08T05:34:11.679Z	src/pages/SuperDefiPage.tsx(12,3): error TS6133: 'FileText' is declared but its value is never read.
2026-01-08T05:34:11.680Z	src/pages/SuperDefiPage.tsx(604,9): error TS6133: 'isChain' is declared but its value is never read.
2026-01-08T05:34:11.680Z	src/pages/SuperDefiPage.tsx(1337,9): error TS6133: 'isTablet' is declared but its value is never read.
2026-01-08T05:34:11.680Z	src/pages/SwapTestPage.tsx(12,56): error TS6133: 'isWalletStateBroken' is declared but its value is never read.
2026-01-08T05:34:11.680Z	src/pages/SwapTestPage.tsx(15,26): error TS6133: 'logout' is declared but its value is never read.
2026-01-08T05:34:11.680Z	src/pages/TestCardsPage.tsx(4,4): error TS6133: 'Eye' is declared but its value is never read.
2026-01-08T05:34:11.680Z	src/pages/TestCardsPage.tsx(5,4): error TS6133: 'Clock' is declared but its value is never read.
2026-01-08T05:34:11.680Z	src/pages/TestCardsPage.tsx(6,4): error TS6133: 'Activity' is declared but its value is never read.
2026-01-08T05:34:11.680Z	src/pages/TestCardsPage.tsx(7,4): error TS6133: 'MousePointerClick' is declared but its value is never read.
2026-01-08T05:34:11.680Z	src/pages/TestCardsPage.tsx(8,4): error TS6133: 'Target' is declared but its value is never read.
2026-01-08T05:34:11.680Z	src/pages/TestCardsPage.tsx(17,7): error TS6133: 'CardWrapper' is declared but its value is never read.
2026-01-08T05:34:11.680Z	src/pages/TestCardsPage.tsx(26,25): error TS6133: 'setIsGenerating' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/TestCardsPage.tsx(116,13): error TS2739: Type '{ id: string; status: "active"; type: "auto_buy"; createdAt: number; executionAmount: string; tokenIn: string; tokenOut: string; triggerCondition: string; copyTradeConfig: { targetWallet: string; ... 4 more ...; mirrorSell: boolean; }; executionHistory: never[]; }' is missing the following properties from type 'TradingStrategy': name, chain, amountAsset, limits, updatedAt
2026-01-08T05:34:11.681Z	src/pages/TestCardsPage.tsx(130,33): error TS6133: 'setIsGeneratingStrategy' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/TokenDetailPage.tsx(1,27): error TS6133: 'useMemo' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/TokenDetailPage.tsx(6,3): error TS6133: 'TrendingDown' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/TokenDetailPage.tsx(7,3): error TS6133: 'Share2' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/TokenDetailPage.tsx(16,1): error TS6133: 'tokenApi' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/TokenDetailPage.tsx(127,9): error TS6133: 'isDark' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/TokenDetailPage.tsx(131,24): error TS6133: 'setSecurityData' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/TokenDetailPage.tsx(132,27): error TS6133: 'setLoadingSecurity' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/TokensPage.tsx(10,1): error TS6133: 'TrendingMetrics' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/TokensPage.tsx(403,15): error TS6133: 'parseLiquidity' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/TokensPage.tsx(513,13): error TS6133: 'parseLiquidity' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/TokensPage.tsx(915,10): error TS6133: 'loadingDetail' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/WalletPage.tsx(3,3): error TS6133: 'ArrowUpRight' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/WalletPage.tsx(4,3): error TS6133: 'TrendingUp' is declared but its value is never read.
2026-01-08T05:34:11.681Z	src/pages/WalletPage.tsx(5,3): error TS6133: 'TrendingDown' is declared but its value is never read.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(7,3): error TS6133: 'Loader2' is declared but its value is never read.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(8,3): error TS6133: 'Search' is declared but its value is never read.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(12,3): error TS6133: 'MoreHorizontal' is declared but its value is never read.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(34,7): error TS6133: 'COMMON_TOKENS' is declared but its value is never read.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(145,9): error TS6133: 'wallets' is declared but its value is never read.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(146,45): error TS6133: 'wagmiIsConnected' is declared but its value is never read.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(148,25): error TS6133: 'switchChain' is declared but its value is never read.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(154,9): error TS6133: 'settingsRef' is declared but its value is never read.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(616,58): error TS7006: Parameter 't' implicitly has an 'any' type.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(626,21): error TS7006: Parameter 't' implicitly has an 'any' type.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(627,18): error TS7006: Parameter 't' implicitly has an 'any' type.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(681,58): error TS7006: Parameter 't' implicitly has an 'any' type.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(747,39): error TS7006: Parameter 'token' implicitly has an 'any' type.
2026-01-08T05:34:11.682Z	src/pages/WalletPage.tsx(1249,78): error TS2322: Type '{ variant: "rectangular"; width: string; height: number; borderRadius: number; }' is not assignable to type 'IntrinsicAttributes & SkeletonProps'.
2026-01-08T05:34:11.684Z	  Property 'borderRadius' does not exist on type 'IntrinsicAttributes & SkeletonProps'.
2026-01-08T05:34:11.684Z	src/pages/WalletPage.tsx(1274,78): error TS2322: Type '{ variant: "rectangular"; width: string; height: number; borderRadius: number; }' is not assignable to type 'IntrinsicAttributes & SkeletonProps'.
2026-01-08T05:34:11.684Z	  Property 'borderRadius' does not exist on type 'IntrinsicAttributes & SkeletonProps'.
2026-01-08T05:34:11.684Z	src/pages/WalletPage.tsx(1480,43): error TS6133: 'getTokenLogoUrl' is declared but its value is never read.
2026-01-08T05:34:11.684Z	src/pages/WalletPage.tsx(1480,60): error TS6133: 'chainId' is declared but its value is never read.
2026-01-08T05:34:11.684Z	src/services/aiApiService.ts(30,17): error TS2339: Property 'apiEndpoint' does not exist on type 'Intent'.
2026-01-08T05:34:11.684Z	src/services/aiApiService.ts(30,70): error TS2339: Property 'type' does not exist on type 'Intent'.
2026-01-08T05:34:11.684Z	src/services/aiApiService.ts(38,22): error TS2339: Property 'type' does not exist on type 'Intent'.
2026-01-08T05:34:11.684Z	src/services/aiApiService.ts(65,16): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.684Z	src/services/aiApiService.ts(69,43): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(92,16): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(96,37): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(97,21): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(121,16): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(125,29): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(129,16): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(133,29): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(145,55): error TS2339: Property 'type' does not exist on type 'Intent'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(243,17): error TS2339: Property 'tradeIntent' does not exist on type 'Intent'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(251,66): error TS2339: Property 'tradeIntent' does not exist on type 'Intent'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(288,25): error TS2339: Property 'tradeIntent' does not exist on type 'Intent'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(289,26): error TS2339: Property 'tradeIntent' does not exist on type 'Intent'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(290,24): error TS2339: Property 'tradeIntent' does not exist on type 'Intent'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(291,25): error TS2339: Property 'tradeIntent' does not exist on type 'Intent'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(292,29): error TS2339: Property 'tradeIntent' does not exist on type 'Intent'.
2026-01-08T05:34:11.685Z	src/services/aiApiService.ts(301,20): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.686Z	src/services/aiApiService.ts(302,22): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.686Z	src/services/aiApiService.ts(336,20): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.686Z	src/services/aiApiService.ts(337,22): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.686Z	src/services/aiApiService.ts(338,24): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.686Z	src/services/aiApiService.ts(374,21): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.686Z	src/services/aiApiService.ts(375,20): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.686Z	src/services/aiApiService.ts(376,18): error TS18048: 'intent.parameters' is possibly 'undefined'.
2026-01-08T05:34:11.686Z	src/services/aiExtendedIntentParser.ts(4,34): error TS6133: 'input' is declared but its value is never read.
2026-01-08T05:34:11.686Z	src/services/aiService.ts(9,10): error TS6133: 'FULL_SYSTEM_PROMPT' is declared but its value is never read.
2026-01-08T05:34:11.686Z	src/services/aiService.ts(9,50): error TS6133: 'SAFETY_PROMPT' is declared but its value is never read.
2026-01-08T05:34:11.686Z	src/services/aiService.ts(56,12): error TS2339: Property 'intent' does not exist on type '{ log: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void; debug: (...args: any[]) => void; }'.
2026-01-08T05:34:11.686Z	src/services/aiService.ts(58,12): error TS2339: Property 'intent' does not exist on type '{ log: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void; debug: (...args: any[]) => void; }'.
2026-01-08T05:34:11.686Z	src/services/aiService.ts(88,12): error TS2339: Property 'ai' does not exist on type '{ log: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void; debug: (...args: any[]) => void; }'.
2026-01-08T05:34:11.686Z	src/services/aiService.ts(97,12): error TS2339: Property 'ai' does not exist on type '{ log: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void; debug: (...args: any[]) => void; }'.
2026-01-08T05:34:11.686Z	src/services/aiService.ts(428,45): error TS2339: Property 'type' does not exist on type 'Intent'.
2026-01-08T05:34:11.686Z	src/services/aiService.ts(430,75): error TS2339: Property 'apiEndpoint' does not exist on type 'Intent'.
2026-01-08T05:34:11.691Z	src/services/aiService.ts(430,90): error TS2304: Cannot find name 'typesWithOwnHandlersInApi'.
2026-01-08T05:34:11.691Z	src/services/geckoTerminal.ts(204,13): error TS6133: 'quoteToken' is declared but its value is never read.
2026-01-08T05:34:11.691Z	src/services/geckoTerminal.ts(433,11): error TS6133: 'duration' is declared but its value is never read.
2026-01-08T05:34:11.691Z	src/services/geckoTerminal.ts(452,11): error TS6133: 'duration' is declared but its value is never read.
2026-01-08T05:34:11.691Z	src/services/launchpadDetector.ts(16,5): error TS6133: 'chainId' is declared but its value is never read.
2026-01-08T05:34:11.691Z	src/services/launchpadDetector.ts(17,5): error TS6133: 'userMessage' is declared but its value is never read.
2026-01-08T05:34:11.691Z	src/services/moderation.ts(1,10): error TS6133: 'pipeline' is declared but its value is never read.
2026-01-08T05:34:11.691Z	src/services/moderation.ts(1,30): error TS6133: 'TextClassificationPipeline' is declared but its value is never read.
2026-01-08T05:34:11.691Z	src/services/swapService.ts(6,28): error TS6133: 'quoteRateLimiter' is declared but its value is never read.
2026-01-08T05:34:11.692Z	src/services/zoraApi.ts(9,7): error TS6133: 'getApiKey' is declared but its value is never read.
2026-01-08T05:34:11.692Z	src/utils/swapDataFetcher.ts(124,62): error TS6133: 'symbol' is declared but its value is never read.
2026-01-08T05:34:13.821Z	Failed: error occurred while running build command