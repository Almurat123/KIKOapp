2026-01-08T06:36:11.937Z	Initializing build environment...
2026-01-08T06:36:13.357Z	Success: Finished initializing build environment
2026-01-08T06:36:13.703Z	Cloning repository...
2026-01-08T06:36:15.701Z	Detected the following tools from environment: npm@10.9.2, nodejs@22.16.0
2026-01-08T06:36:15.703Z	Restoring from dependencies cache
2026-01-08T06:36:15.704Z	Restoring from build output cache
2026-01-08T06:36:15.839Z	Installing project dependencies: npm clean-install --progress=false
2026-01-08T06:36:24.492Z	npm warn deprecated @paulmillr/qr@0.2.1: The package is now available as "qr": npm install qr
2026-01-08T06:36:30.451Z	npm warn deprecated @walletconnect/sign-client@2.21.0: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T06:36:30.470Z	npm warn deprecated @walletconnect/sign-client@2.21.1: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T06:36:30.473Z	npm warn deprecated @walletconnect/sign-client@2.21.0: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T06:36:30.489Z	npm warn deprecated @walletconnect/sign-client@2.21.0: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T06:36:30.934Z	npm warn deprecated @walletconnect/universal-provider@2.21.0: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T06:36:30.942Z	npm warn deprecated @walletconnect/universal-provider@2.21.1: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T06:36:30.967Z	npm warn deprecated @walletconnect/universal-provider@2.21.0: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T06:36:30.968Z	npm warn deprecated @walletconnect/universal-provider@2.21.0: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T06:36:33.319Z	npm warn deprecated @walletconnect/ethereum-provider@2.21.1: Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases
2026-01-08T06:37:16.548Z	
2026-01-08T06:37:16.548Z	added 1272 packages, and audited 1273 packages in 60s
2026-01-08T06:37:16.548Z	
2026-01-08T06:37:16.548Z	258 packages are looking for funding
2026-01-08T06:37:16.548Z	  run `npm fund` for details
2026-01-08T06:37:16.551Z	
2026-01-08T06:37:16.551Z	5 vulnerabilities (1 moderate, 4 high)
2026-01-08T06:37:16.551Z	
2026-01-08T06:37:16.551Z	To address issues that do not require attention, run:
2026-01-08T06:37:16.551Z	  npm audit fix
2026-01-08T06:37:16.551Z	
2026-01-08T06:37:16.551Z	To address all issues (including breaking changes), run:
2026-01-08T06:37:16.551Z	  npm audit fix --force
2026-01-08T06:37:16.551Z	
2026-01-08T06:37:16.551Z	Run `npm audit` for details.
2026-01-08T06:37:16.790Z	Executing user build command: npm run build
2026-01-08T06:37:17.025Z	
2026-01-08T06:37:17.026Z	> kiko-web@0.0.0 build
2026-01-08T06:37:17.026Z	> tsc -b && NODE_OPTIONS=--max-old-space-size=4096 vite build
2026-01-08T06:37:17.026Z	
2026-01-08T06:37:29.638Z	vite v7.2.2 building client environment for production...
2026-01-08T06:37:29.741Z	transforming...
2026-01-08T06:37:30.722Z	node_modules/@privy-io/react-auth/dist/esm/prepareFundingModalData-BVTcQcmw.mjs (1:5271): A comment
2026-01-08T06:37:30.723Z	
2026-01-08T06:37:30.724Z	"/*#__PURE__*/"
2026-01-08T06:37:30.724Z	
2026-01-08T06:37:30.724Z	in "node_modules/@privy-io/react-auth/dist/esm/prepareFundingModalData-BVTcQcmw.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:31.149Z	node_modules/@privy-io/react-auth/dist/esm/usePrivy-BWtc2XF-.mjs (1:2044): A comment
2026-01-08T06:37:31.149Z	
2026-01-08T06:37:31.149Z	"/*#__PURE__*/"
2026-01-08T06:37:31.149Z	
2026-01-08T06:37:31.149Z	in "node_modules/@privy-io/react-auth/dist/esm/usePrivy-BWtc2XF-.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:31.157Z	node_modules/@privy-io/react-auth/dist/esm/get-is-unified-wallet-gMDXpX6C.mjs (1:8185): A comment
2026-01-08T06:37:31.157Z	
2026-01-08T06:37:31.157Z	"/*#__PURE__*/"
2026-01-08T06:37:31.157Z	
2026-01-08T06:37:31.158Z	in "node_modules/@privy-io/react-auth/dist/esm/get-is-unified-wallet-gMDXpX6C.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:31.158Z	node_modules/@privy-io/react-auth/dist/esm/get-is-unified-wallet-gMDXpX6C.mjs (1:8837): A comment
2026-01-08T06:37:31.158Z	
2026-01-08T06:37:31.161Z	"/*#__PURE__*/"
2026-01-08T06:37:31.161Z	
2026-01-08T06:37:31.161Z	in "node_modules/@privy-io/react-auth/dist/esm/get-is-unified-wallet-gMDXpX6C.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:31.373Z	node_modules/@privy-io/react-auth/dist/esm/index-NL2cPmJD.mjs (1:35641): A comment
2026-01-08T06:37:31.374Z	
2026-01-08T06:37:31.374Z	"/*#__PURE__*/"
2026-01-08T06:37:31.374Z	
2026-01-08T06:37:31.374Z	in "node_modules/@privy-io/react-auth/dist/esm/index-NL2cPmJD.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:31.374Z	node_modules/@privy-io/react-auth/dist/esm/index-NL2cPmJD.mjs (3:319): A comment
2026-01-08T06:37:31.374Z	
2026-01-08T06:37:31.375Z	"/*#__PURE__*/"
2026-01-08T06:37:31.375Z	
2026-01-08T06:37:31.375Z	in "node_modules/@privy-io/react-auth/dist/esm/index-NL2cPmJD.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:31.378Z	node_modules/@privy-io/react-auth/dist/esm/index-NL2cPmJD.mjs (4:81665): A comment
2026-01-08T06:37:31.379Z	
2026-01-08T06:37:31.379Z	"/*#__PURE__*/"
2026-01-08T06:37:31.379Z	
2026-01-08T06:37:31.379Z	in "node_modules/@privy-io/react-auth/dist/esm/index-NL2cPmJD.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:31.381Z	node_modules/@privy-io/react-auth/dist/esm/index-NL2cPmJD.mjs (5:35190): A comment
2026-01-08T06:37:31.381Z	
2026-01-08T06:37:31.381Z	"/*#__PURE__*/"
2026-01-08T06:37:31.381Z	
2026-01-08T06:37:31.381Z	in "node_modules/@privy-io/react-auth/dist/esm/index-NL2cPmJD.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.052Z	node_modules/@privy-io/react-auth/dist/esm/StandardSignAndSendTransactionScreen-Ckxfv32q.mjs (1:17087): A comment
2026-01-08T06:37:32.054Z	
2026-01-08T06:37:32.054Z	"/*#__PURE__*/"
2026-01-08T06:37:32.055Z	
2026-01-08T06:37:32.055Z	in "node_modules/@privy-io/react-auth/dist/esm/StandardSignAndSendTransactionScreen-Ckxfv32q.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.055Z	node_modules/@privy-io/react-auth/dist/esm/StandardSignAndSendTransactionScreen-Ckxfv32q.mjs (1:18095): A comment
2026-01-08T06:37:32.055Z	
2026-01-08T06:37:32.055Z	"/*#__PURE__*/"
2026-01-08T06:37:32.055Z	
2026-01-08T06:37:32.055Z	in "node_modules/@privy-io/react-auth/dist/esm/StandardSignAndSendTransactionScreen-Ckxfv32q.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.582Z	node_modules/@privy-io/react-auth/dist/esm/HCaptchaWrapper-Dl2Jt_Df.mjs (1:176): A comment
2026-01-08T06:37:32.582Z	
2026-01-08T06:37:32.582Z	"/*#__PURE__*/"
2026-01-08T06:37:32.583Z	
2026-01-08T06:37:32.583Z	in "node_modules/@privy-io/react-auth/dist/esm/HCaptchaWrapper-Dl2Jt_Df.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.584Z	node_modules/@privy-io/react-auth/dist/esm/AccountNotFoundScreen-BzbvtCmu.mjs (1:1401): A comment
2026-01-08T06:37:32.584Z	
2026-01-08T06:37:32.584Z	"/*#__PURE__*/"
2026-01-08T06:37:32.584Z	
2026-01-08T06:37:32.584Z	in "node_modules/@privy-io/react-auth/dist/esm/AccountNotFoundScreen-BzbvtCmu.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.586Z	node_modules/@privy-io/react-auth/dist/esm/AffirmativeConsentScreen-CrZKQjas.mjs (1:1968): A comment
2026-01-08T06:37:32.588Z	
2026-01-08T06:37:32.588Z	"/*#__PURE__*/"
2026-01-08T06:37:32.588Z	
2026-01-08T06:37:32.588Z	in "node_modules/@privy-io/react-auth/dist/esm/AffirmativeConsentScreen-CrZKQjas.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.597Z	node_modules/@privy-io/react-auth/dist/esm/AllowlistRejectionScreen-DhhfJ6ai.mjs (1:1552): A comment
2026-01-08T06:37:32.598Z	
2026-01-08T06:37:32.598Z	"/*#__PURE__*/"
2026-01-08T06:37:32.598Z	
2026-01-08T06:37:32.598Z	in "node_modules/@privy-io/react-auth/dist/esm/AllowlistRejectionScreen-DhhfJ6ai.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.600Z	node_modules/@privy-io/react-auth/dist/esm/AuthenticateWithWalletScreen-BN0s1mtv.mjs (1:1787): A comment
2026-01-08T06:37:32.600Z	
2026-01-08T06:37:32.600Z	"/*#__PURE__*/"
2026-01-08T06:37:32.600Z	
2026-01-08T06:37:32.600Z	in "node_modules/@privy-io/react-auth/dist/esm/AuthenticateWithWalletScreen-BN0s1mtv.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.605Z	node_modules/@privy-io/react-auth/dist/esm/TurnstileWrapper-Co-t5mTh.mjs (1:217): A comment
2026-01-08T06:37:32.606Z	
2026-01-08T06:37:32.606Z	"/*#__PURE__*/"
2026-01-08T06:37:32.606Z	
2026-01-08T06:37:32.606Z	in "node_modules/@privy-io/react-auth/dist/esm/TurnstileWrapper-Co-t5mTh.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.608Z	node_modules/@privy-io/react-auth/dist/esm/AwaitingEvmToSolBridgingScreen-C7mp2-Hy.mjs (1:7521): A comment
2026-01-08T06:37:32.609Z	
2026-01-08T06:37:32.609Z	"/*#__PURE__*/"
2026-01-08T06:37:32.609Z	
2026-01-08T06:37:32.609Z	in "node_modules/@privy-io/react-auth/dist/esm/AwaitingEvmToSolBridgingScreen-C7mp2-Hy.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.613Z	node_modules/@privy-io/react-auth/dist/esm/AwaitingExternalEthereumTransferScreen-EqM4Kcsu.mjs (1:9474): A comment
2026-01-08T06:37:32.613Z	
2026-01-08T06:37:32.613Z	"/*#__PURE__*/"
2026-01-08T06:37:32.613Z	
2026-01-08T06:37:32.613Z	in "node_modules/@privy-io/react-auth/dist/esm/AwaitingExternalEthereumTransferScreen-EqM4Kcsu.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.616Z	node_modules/@privy-io/react-auth/dist/esm/AwaitingPasswordlessCodeScreen-NAVmxM9-.mjs (1:2752): A comment
2026-01-08T06:37:32.616Z	
2026-01-08T06:37:32.616Z	"/*#__PURE__*/"
2026-01-08T06:37:32.616Z	
2026-01-08T06:37:32.616Z	in "node_modules/@privy-io/react-auth/dist/esm/AwaitingPasswordlessCodeScreen-NAVmxM9-.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.616Z	node_modules/@privy-io/react-auth/dist/esm/AwaitingPasswordlessCodeScreen-NAVmxM9-.mjs (1:5760): A comment
2026-01-08T06:37:32.616Z	
2026-01-08T06:37:32.616Z	"/*#__PURE__*/"
2026-01-08T06:37:32.616Z	
2026-01-08T06:37:32.616Z	in "node_modules/@privy-io/react-auth/dist/esm/AwaitingPasswordlessCodeScreen-NAVmxM9-.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.620Z	node_modules/@privy-io/react-auth/dist/esm/CaptchaScreen-CTRyyYc9.mjs (1:2100): A comment
2026-01-08T06:37:32.620Z	
2026-01-08T06:37:32.620Z	"/*#__PURE__*/"
2026-01-08T06:37:32.620Z	
2026-01-08T06:37:32.620Z	in "node_modules/@privy-io/react-auth/dist/esm/CaptchaScreen-CTRyyYc9.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.620Z	node_modules/@privy-io/react-auth/dist/esm/CaptchaScreen-CTRyyYc9.mjs (1:3413): A comment
2026-01-08T06:37:32.620Z	
2026-01-08T06:37:32.620Z	"/*#__PURE__*/"
2026-01-08T06:37:32.620Z	
2026-01-08T06:37:32.620Z	in "node_modules/@privy-io/react-auth/dist/esm/CaptchaScreen-CTRyyYc9.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.625Z	node_modules/@privy-io/react-auth/dist/esm/CoinbaseOnrampStatusScreen-BNmvm8Bl.mjs (1:3644): A comment
2026-01-08T06:37:32.625Z	
2026-01-08T06:37:32.625Z	"/*#__PURE__*/"
2026-01-08T06:37:32.625Z	
2026-01-08T06:37:32.625Z	in "node_modules/@privy-io/react-auth/dist/esm/CoinbaseOnrampStatusScreen-BNmvm8Bl.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.625Z	node_modules/@privy-io/react-auth/dist/esm/CoinbaseOnrampStatusScreen-BNmvm8Bl.mjs (1:3967): A comment
2026-01-08T06:37:32.625Z	
2026-01-08T06:37:32.625Z	"/*#__PURE__*/"
2026-01-08T06:37:32.625Z	
2026-01-08T06:37:32.625Z	in "node_modules/@privy-io/react-auth/dist/esm/CoinbaseOnrampStatusScreen-BNmvm8Bl.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.625Z	node_modules/@privy-io/react-auth/dist/esm/CoinbaseOnrampStatusScreen-BNmvm8Bl.mjs (1:4504): A comment
2026-01-08T06:37:32.625Z	
2026-01-08T06:37:32.625Z	"/*#__PURE__*/"
2026-01-08T06:37:32.625Z	
2026-01-08T06:37:32.625Z	in "node_modules/@privy-io/react-auth/dist/esm/CoinbaseOnrampStatusScreen-BNmvm8Bl.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.630Z	node_modules/@privy-io/react-auth/dist/esm/ConnectLedgerScreen-BEhSz1FM.mjs (1:3008): A comment
2026-01-08T06:37:32.630Z	
2026-01-08T06:37:32.630Z	"/*#__PURE__*/"
2026-01-08T06:37:32.630Z	
2026-01-08T06:37:32.630Z	in "node_modules/@privy-io/react-auth/dist/esm/ConnectLedgerScreen-BEhSz1FM.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.631Z	node_modules/@privy-io/react-auth/dist/esm/ConnectOnlyLandingScreen-ZnI9ReZJ.mjs (1:1643): A comment
2026-01-08T06:37:32.631Z	
2026-01-08T06:37:32.632Z	"/*#__PURE__*/"
2026-01-08T06:37:32.632Z	
2026-01-08T06:37:32.632Z	in "node_modules/@privy-io/react-auth/dist/esm/ConnectOnlyLandingScreen-ZnI9ReZJ.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.641Z	node_modules/@privy-io/react-auth/dist/esm/ConnectionStatusScreen-CZNBQeOQ.mjs (1:3142): A comment
2026-01-08T06:37:32.641Z	
2026-01-08T06:37:32.641Z	"/*#__PURE__*/"
2026-01-08T06:37:32.641Z	
2026-01-08T06:37:32.641Z	in "node_modules/@privy-io/react-auth/dist/esm/ConnectionStatusScreen-CZNBQeOQ.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.641Z	node_modules/@privy-io/react-auth/dist/esm/ConnectionStatusScreen-CZNBQeOQ.mjs (1:9414): A comment
2026-01-08T06:37:32.641Z	
2026-01-08T06:37:32.642Z	"/*#__PURE__*/"
2026-01-08T06:37:32.642Z	
2026-01-08T06:37:32.642Z	in "node_modules/@privy-io/react-auth/dist/esm/ConnectionStatusScreen-CZNBQeOQ.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.644Z	node_modules/@privy-io/react-auth/dist/esm/CrossAppAuthScreen-Bno8NQSa.mjs (1:2035): A comment
2026-01-08T06:37:32.644Z	
2026-01-08T06:37:32.644Z	"/*#__PURE__*/"
2026-01-08T06:37:32.644Z	
2026-01-08T06:37:32.644Z	in "node_modules/@privy-io/react-auth/dist/esm/CrossAppAuthScreen-Bno8NQSa.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.653Z	node_modules/@privy-io/react-auth/dist/esm/EmbeddedWalletKeyExportScreen-Cmp2CUOa.mjs (1:3690): A comment
2026-01-08T06:37:32.653Z	
2026-01-08T06:37:32.653Z	"/*#__PURE__*/"
2026-01-08T06:37:32.653Z	
2026-01-08T06:37:32.654Z	in "node_modules/@privy-io/react-auth/dist/esm/EmbeddedWalletKeyExportScreen-Cmp2CUOa.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.655Z	node_modules/@privy-io/react-auth/dist/esm/EmbeddedWalletOnAccountCreateScreen-vxaCVWy1.mjs (1:3522): A comment
2026-01-08T06:37:32.655Z	
2026-01-08T06:37:32.655Z	"/*#__PURE__*/"
2026-01-08T06:37:32.655Z	
2026-01-08T06:37:32.655Z	in "node_modules/@privy-io/react-auth/dist/esm/EmbeddedWalletOnAccountCreateScreen-vxaCVWy1.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.657Z	node_modules/@privy-io/react-auth/dist/esm/RecoveryPasswordCreateScreen-jWT25C0X.mjs (1:3531): A comment
2026-01-08T06:37:32.657Z	
2026-01-08T06:37:32.657Z	"/*#__PURE__*/"
2026-01-08T06:37:32.657Z	
2026-01-08T06:37:32.657Z	in "node_modules/@privy-io/react-auth/dist/esm/RecoveryPasswordCreateScreen-jWT25C0X.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.665Z	node_modules/@privy-io/react-auth/dist/esm/EmbeddedWalletPasswordUpdateScreen-C4dNnXVI.mjs (1:2481): A comment
2026-01-08T06:37:32.665Z	
2026-01-08T06:37:32.665Z	"/*#__PURE__*/"
2026-01-08T06:37:32.665Z	
2026-01-08T06:37:32.665Z	in "node_modules/@privy-io/react-auth/dist/esm/EmbeddedWalletPasswordUpdateScreen-C4dNnXVI.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.672Z	node_modules/@privy-io/react-auth/dist/esm/ErrorScreen-Yi-Rhs0v.mjs (1:4225): A comment
2026-01-08T06:37:32.672Z	
2026-01-08T06:37:32.672Z	"/*#__PURE__*/"
2026-01-08T06:37:32.672Z	
2026-01-08T06:37:32.672Z	in "node_modules/@privy-io/react-auth/dist/esm/ErrorScreen-Yi-Rhs0v.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.672Z	node_modules/@privy-io/react-auth/dist/esm/ErrorScreen-Yi-Rhs0v.mjs (1:4706): A comment
2026-01-08T06:37:32.673Z	
2026-01-08T06:37:32.673Z	"/*#__PURE__*/"
2026-01-08T06:37:32.673Z	
2026-01-08T06:37:32.673Z	in "node_modules/@privy-io/react-auth/dist/esm/ErrorScreen-Yi-Rhs0v.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.676Z	node_modules/@privy-io/react-auth/dist/esm/FarcasterSignerStatusScreen-CsSFmDry.mjs (1:4675): A comment
2026-01-08T06:37:32.676Z	
2026-01-08T06:37:32.676Z	"/*#__PURE__*/"
2026-01-08T06:37:32.676Z	
2026-01-08T06:37:32.677Z	in "node_modules/@privy-io/react-auth/dist/esm/FarcasterSignerStatusScreen-CsSFmDry.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.679Z	node_modules/@privy-io/react-auth/dist/esm/FundSolWalletWithExternalSolanaWallet-BIk-6GIl.mjs (1:2531): A comment
2026-01-08T06:37:32.679Z	
2026-01-08T06:37:32.679Z	"/*#__PURE__*/"
2026-01-08T06:37:32.679Z	
2026-01-08T06:37:32.679Z	in "node_modules/@privy-io/react-auth/dist/esm/FundSolWalletWithExternalSolanaWallet-BIk-6GIl.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.685Z	node_modules/@privy-io/react-auth/dist/esm/FundingEditAmountScreen-CzbuYpdw.mjs (1:1659): A comment
2026-01-08T06:37:32.685Z	
2026-01-08T06:37:32.685Z	"/*#__PURE__*/"
2026-01-08T06:37:32.685Z	
2026-01-08T06:37:32.685Z	in "node_modules/@privy-io/react-auth/dist/esm/FundingEditAmountScreen-CzbuYpdw.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.685Z	node_modules/@privy-io/react-auth/dist/esm/FundingMethodSelectionScreen-DdZxdcVe.mjs (1:9764): A comment
2026-01-08T06:37:32.685Z	
2026-01-08T06:37:32.685Z	"/*#__PURE__*/"
2026-01-08T06:37:32.685Z	
2026-01-08T06:37:32.685Z	in "node_modules/@privy-io/react-auth/dist/esm/FundingMethodSelectionScreen-DdZxdcVe.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.686Z	node_modules/@privy-io/react-auth/dist/esm/InAppBrowserLoginNotPossible-COUNBN1W.mjs (1:1285): A comment
2026-01-08T06:37:32.687Z	
2026-01-08T06:37:32.687Z	"/*#__PURE__*/"
2026-01-08T06:37:32.687Z	
2026-01-08T06:37:32.687Z	in "node_modules/@privy-io/react-auth/dist/esm/InAppBrowserLoginNotPossible-COUNBN1W.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.688Z	node_modules/@privy-io/react-auth/dist/esm/InstallWalletScreen-BjprJkty.mjs (1:1272): A comment
2026-01-08T06:37:32.688Z	
2026-01-08T06:37:32.688Z	"/*#__PURE__*/"
2026-01-08T06:37:32.688Z	
2026-01-08T06:37:32.688Z	in "node_modules/@privy-io/react-auth/dist/esm/InstallWalletScreen-BjprJkty.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.688Z	node_modules/@privy-io/react-auth/dist/esm/InstallWalletScreen-BjprJkty.mjs (1:2152): A comment
2026-01-08T06:37:32.688Z	
2026-01-08T06:37:32.688Z	"/*#__PURE__*/"
2026-01-08T06:37:32.688Z	
2026-01-08T06:37:32.688Z	in "node_modules/@privy-io/react-auth/dist/esm/InstallWalletScreen-BjprJkty.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.699Z	node_modules/@privy-io/react-auth/dist/esm/LinkConflictScreen-DMHPhlV7.mjs (1:1847): A comment
2026-01-08T06:37:32.699Z	
2026-01-08T06:37:32.699Z	"/*#__PURE__*/"
2026-01-08T06:37:32.699Z	
2026-01-08T06:37:32.699Z	in "node_modules/@privy-io/react-auth/dist/esm/LinkConflictScreen-DMHPhlV7.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.699Z	node_modules/@privy-io/react-auth/dist/esm/LinkConflictScreen-DMHPhlV7.mjs (1:4448): A comment
2026-01-08T06:37:32.699Z	
2026-01-08T06:37:32.700Z	"/*#__PURE__*/"
2026-01-08T06:37:32.700Z	
2026-01-08T06:37:32.700Z	in "node_modules/@privy-io/react-auth/dist/esm/LinkConflictScreen-DMHPhlV7.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.700Z	node_modules/@privy-io/react-auth/dist/esm/LinkConflictScreen-DMHPhlV7.mjs (1:7163): A comment
2026-01-08T06:37:32.700Z	
2026-01-08T06:37:32.700Z	"/*#__PURE__*/"
2026-01-08T06:37:32.700Z	
2026-01-08T06:37:32.700Z	in "node_modules/@privy-io/react-auth/dist/esm/LinkConflictScreen-DMHPhlV7.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.701Z	node_modules/@privy-io/react-auth/dist/esm/LinkEmailScreen-D7VTyZrH.mjs (1:2059): A comment
2026-01-08T06:37:32.701Z	
2026-01-08T06:37:32.701Z	"/*#__PURE__*/"
2026-01-08T06:37:32.701Z	
2026-01-08T06:37:32.701Z	in "node_modules/@privy-io/react-auth/dist/esm/LinkEmailScreen-D7VTyZrH.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.704Z	node_modules/@privy-io/react-auth/dist/esm/LinkPhoneScreen-DdRe154C.mjs (1:1343): A comment
2026-01-08T06:37:32.704Z	
2026-01-08T06:37:32.704Z	"/*#__PURE__*/"
2026-01-08T06:37:32.704Z	
2026-01-08T06:37:32.704Z	in "node_modules/@privy-io/react-auth/dist/esm/LinkPhoneScreen-DdRe154C.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.705Z	node_modules/@privy-io/react-auth/dist/esm/LinkPhoneScreen-DdRe154C.mjs (1:1704): A comment
2026-01-08T06:37:32.705Z	
2026-01-08T06:37:32.705Z	"/*#__PURE__*/"
2026-01-08T06:37:32.705Z	
2026-01-08T06:37:32.705Z	in "node_modules/@privy-io/react-auth/dist/esm/LinkPhoneScreen-DdRe154C.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.706Z	node_modules/@privy-io/react-auth/dist/esm/LoginFailedScreen-CZnzwKpB.mjs (1:1411): A comment
2026-01-08T06:37:32.707Z	
2026-01-08T06:37:32.707Z	"/*#__PURE__*/"
2026-01-08T06:37:32.707Z	
2026-01-08T06:37:32.707Z	in "node_modules/@privy-io/react-auth/dist/esm/LoginFailedScreen-CZnzwKpB.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.709Z	node_modules/@privy-io/react-auth/dist/esm/ManualTransferScreen-Bn2qhDAI.mjs (1:5404): A comment
2026-01-08T06:37:32.709Z	
2026-01-08T06:37:32.709Z	"/*#__PURE__*/"
2026-01-08T06:37:32.709Z	
2026-01-08T06:37:32.709Z	in "node_modules/@privy-io/react-auth/dist/esm/ManualTransferScreen-Bn2qhDAI.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.712Z	node_modules/@privy-io/react-auth/dist/esm/MfaAuthEnrollmentFlowScreen-CWMULcQb.mjs (1:3655): A comment
2026-01-08T06:37:32.713Z	
2026-01-08T06:37:32.713Z	"/*#__PURE__*/"
2026-01-08T06:37:32.713Z	
2026-01-08T06:37:32.713Z	in "node_modules/@privy-io/react-auth/dist/esm/MfaAuthEnrollmentFlowScreen-CWMULcQb.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.713Z	node_modules/@privy-io/react-auth/dist/esm/MfaAuthEnrollmentFlowScreen-CWMULcQb.mjs (1:3901): A comment
2026-01-08T06:37:32.713Z	
2026-01-08T06:37:32.713Z	"/*#__PURE__*/"
2026-01-08T06:37:32.713Z	
2026-01-08T06:37:32.713Z	in "node_modules/@privy-io/react-auth/dist/esm/MfaAuthEnrollmentFlowScreen-CWMULcQb.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.714Z	node_modules/@privy-io/react-auth/dist/esm/MfaAuthEnrollmentFlowScreen-CWMULcQb.mjs (1:4590): A comment
2026-01-08T06:37:32.714Z	
2026-01-08T06:37:32.714Z	"/*#__PURE__*/"
2026-01-08T06:37:32.714Z	
2026-01-08T06:37:32.714Z	in "node_modules/@privy-io/react-auth/dist/esm/MfaAuthEnrollmentFlowScreen-CWMULcQb.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.721Z	node_modules/@privy-io/react-auth/dist/esm/MfaEnrollmentFlowScreen-DcnqGJ3O.mjs (1:6518): A comment
2026-01-08T06:37:32.721Z	
2026-01-08T06:37:32.721Z	"/*#__PURE__*/"
2026-01-08T06:37:32.721Z	
2026-01-08T06:37:32.721Z	in "node_modules/@privy-io/react-auth/dist/esm/MfaEnrollmentFlowScreen-DcnqGJ3O.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.721Z	node_modules/@privy-io/react-auth/dist/esm/MfaEnrollmentFlowScreen-DcnqGJ3O.mjs (1:6731): A comment
2026-01-08T06:37:32.721Z	
2026-01-08T06:37:32.721Z	"/*#__PURE__*/"
2026-01-08T06:37:32.722Z	
2026-01-08T06:37:32.722Z	in "node_modules/@privy-io/react-auth/dist/esm/MfaEnrollmentFlowScreen-DcnqGJ3O.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.722Z	node_modules/@privy-io/react-auth/dist/esm/MfaEnrollmentFlowScreen-DcnqGJ3O.mjs (1:7287): A comment
2026-01-08T06:37:32.722Z	
2026-01-08T06:37:32.722Z	"/*#__PURE__*/"
2026-01-08T06:37:32.722Z	
2026-01-08T06:37:32.722Z	in "node_modules/@privy-io/react-auth/dist/esm/MfaEnrollmentFlowScreen-DcnqGJ3O.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.722Z	node_modules/@privy-io/react-auth/dist/esm/MfaEnrollmentFlowScreen-DcnqGJ3O.mjs (1:7919): A comment
2026-01-08T06:37:32.722Z	
2026-01-08T06:37:32.722Z	"/*#__PURE__*/"
2026-01-08T06:37:32.722Z	
2026-01-08T06:37:32.722Z	in "node_modules/@privy-io/react-auth/dist/esm/MfaEnrollmentFlowScreen-DcnqGJ3O.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.722Z	node_modules/@privy-io/react-auth/dist/esm/MfaEnrollmentFlowScreen-DcnqGJ3O.mjs (1:8620): A comment
2026-01-08T06:37:32.722Z	
2026-01-08T06:37:32.722Z	"/*#__PURE__*/"
2026-01-08T06:37:32.722Z	
2026-01-08T06:37:32.722Z	in "node_modules/@privy-io/react-auth/dist/esm/MfaEnrollmentFlowScreen-DcnqGJ3O.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.731Z	node_modules/@privy-io/react-auth/dist/esm/MoonpayStatusScreen-lYMS5etL.mjs (1:2926): A comment
2026-01-08T06:37:32.731Z	
2026-01-08T06:37:32.731Z	"/*#__PURE__*/"
2026-01-08T06:37:32.733Z	
2026-01-08T06:37:32.733Z	in "node_modules/@privy-io/react-auth/dist/esm/MoonpayStatusScreen-lYMS5etL.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.733Z	node_modules/@privy-io/react-auth/dist/esm/MoonpayStatusScreen-lYMS5etL.mjs (1:3758): A comment
2026-01-08T06:37:32.733Z	
2026-01-08T06:37:32.733Z	"/*#__PURE__*/"
2026-01-08T06:37:32.733Z	
2026-01-08T06:37:32.733Z	in "node_modules/@privy-io/react-auth/dist/esm/MoonpayStatusScreen-lYMS5etL.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.733Z	node_modules/@privy-io/react-auth/dist/esm/MoonpayStatusScreen-lYMS5etL.mjs (1:4076): A comment
2026-01-08T06:37:32.734Z	
2026-01-08T06:37:32.734Z	"/*#__PURE__*/"
2026-01-08T06:37:32.734Z	
2026-01-08T06:37:32.734Z	in "node_modules/@privy-io/react-auth/dist/esm/MoonpayStatusScreen-lYMS5etL.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.734Z	node_modules/@privy-io/react-auth/dist/esm/MoonpayStatusScreen-lYMS5etL.mjs (1:4872): A comment
2026-01-08T06:37:32.734Z	
2026-01-08T06:37:32.735Z	"/*#__PURE__*/"
2026-01-08T06:37:32.735Z	
2026-01-08T06:37:32.735Z	in "node_modules/@privy-io/react-auth/dist/esm/MoonpayStatusScreen-lYMS5etL.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.735Z	node_modules/@privy-io/react-auth/dist/esm/OAuthStatusScreen-DEtT_t2P.mjs (1:4254): A comment
2026-01-08T06:37:32.735Z	
2026-01-08T06:37:32.735Z	"/*#__PURE__*/"
2026-01-08T06:37:32.735Z	
2026-01-08T06:37:32.735Z	in "node_modules/@privy-io/react-auth/dist/esm/OAuthStatusScreen-DEtT_t2P.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.736Z	node_modules/@privy-io/react-auth/dist/esm/PasskeySelectSignupOrLogin-DgH-G2yO.mjs (1:2045): A comment
2026-01-08T06:37:32.736Z	
2026-01-08T06:37:32.736Z	"/*#__PURE__*/"
2026-01-08T06:37:32.736Z	
2026-01-08T06:37:32.736Z	in "node_modules/@privy-io/react-auth/dist/esm/PasskeySelectSignupOrLogin-DgH-G2yO.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.740Z	node_modules/@privy-io/react-auth/dist/esm/PasswordRecoveryScreen-CT1bj8Gb.mjs (1:2494): A comment
2026-01-08T06:37:32.740Z	
2026-01-08T06:37:32.740Z	"/*#__PURE__*/"
2026-01-08T06:37:32.740Z	
2026-01-08T06:37:32.740Z	in "node_modules/@privy-io/react-auth/dist/esm/PasswordRecoveryScreen-CT1bj8Gb.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.743Z	node_modules/@privy-io/react-auth/dist/esm/RecoveryOAuthStatusScreen-Ce6qiP-3.mjs (1:8623): A comment
2026-01-08T06:37:32.744Z	
2026-01-08T06:37:32.744Z	"/*#__PURE__*/"
2026-01-08T06:37:32.744Z	
2026-01-08T06:37:32.744Z	in "node_modules/@privy-io/react-auth/dist/esm/RecoveryOAuthStatusScreen-Ce6qiP-3.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.745Z	node_modules/@privy-io/react-auth/dist/esm/RecoverySelectionScreen-_u02vomS.mjs (1:4141): A comment
2026-01-08T06:37:32.745Z	
2026-01-08T06:37:32.745Z	"/*#__PURE__*/"
2026-01-08T06:37:32.745Z	
2026-01-08T06:37:32.745Z	in "node_modules/@privy-io/react-auth/dist/esm/RecoverySelectionScreen-_u02vomS.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.745Z	node_modules/@privy-io/react-auth/dist/esm/RecoverySelectionScreen-_u02vomS.mjs (1:4316): A comment
2026-01-08T06:37:32.745Z	
2026-01-08T06:37:32.745Z	"/*#__PURE__*/"
2026-01-08T06:37:32.745Z	
2026-01-08T06:37:32.746Z	in "node_modules/@privy-io/react-auth/dist/esm/RecoverySelectionScreen-_u02vomS.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.746Z	node_modules/@privy-io/react-auth/dist/esm/RecoverySelectionScreen-_u02vomS.mjs (1:4492): A comment
2026-01-08T06:37:32.746Z	
2026-01-08T06:37:32.746Z	"/*#__PURE__*/"
2026-01-08T06:37:32.746Z	
2026-01-08T06:37:32.746Z	in "node_modules/@privy-io/react-auth/dist/esm/RecoverySelectionScreen-_u02vomS.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.751Z	node_modules/@privy-io/react-auth/dist/esm/index-DNmMGazz.mjs (1:15102): A comment
2026-01-08T06:37:32.751Z	
2026-01-08T06:37:32.751Z	"/*#__PURE__*/"
2026-01-08T06:37:32.751Z	
2026-01-08T06:37:32.751Z	in "node_modules/@privy-io/react-auth/dist/esm/index-DNmMGazz.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.751Z	node_modules/@privy-io/react-auth/dist/esm/index-DNmMGazz.mjs (1:17904): A comment
2026-01-08T06:37:32.751Z	
2026-01-08T06:37:32.751Z	"/*#__PURE__*/"
2026-01-08T06:37:32.751Z	
2026-01-08T06:37:32.751Z	in "node_modules/@privy-io/react-auth/dist/esm/index-DNmMGazz.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.752Z	node_modules/@privy-io/react-auth/dist/esm/index-DNmMGazz.mjs (1:18170): A comment
2026-01-08T06:37:32.752Z	
2026-01-08T06:37:32.752Z	"/*#__PURE__*/"
2026-01-08T06:37:32.752Z	
2026-01-08T06:37:32.752Z	in "node_modules/@privy-io/react-auth/dist/esm/index-DNmMGazz.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.752Z	node_modules/@privy-io/react-auth/dist/esm/index-DNmMGazz.mjs (1:20300): A comment
2026-01-08T06:37:32.755Z	
2026-01-08T06:37:32.755Z	"/*#__PURE__*/"
2026-01-08T06:37:32.755Z	
2026-01-08T06:37:32.755Z	in "node_modules/@privy-io/react-auth/dist/esm/index-DNmMGazz.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.756Z	node_modules/@privy-io/react-auth/dist/esm/index-DNmMGazz.mjs (1:20584): A comment
2026-01-08T06:37:32.756Z	
2026-01-08T06:37:32.756Z	"/*#__PURE__*/"
2026-01-08T06:37:32.756Z	
2026-01-08T06:37:32.756Z	in "node_modules/@privy-io/react-auth/dist/esm/index-DNmMGazz.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.759Z	node_modules/@privy-io/react-auth/dist/esm/SetAutomaticRecoveryScreen-CUheSZ7h.mjs (1:1940): A comment
2026-01-08T06:37:32.760Z	
2026-01-08T06:37:32.760Z	"/*#__PURE__*/"
2026-01-08T06:37:32.760Z	
2026-01-08T06:37:32.760Z	in "node_modules/@privy-io/react-auth/dist/esm/SetAutomaticRecoveryScreen-CUheSZ7h.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.761Z	node_modules/@privy-io/react-auth/dist/esm/LinkPasskeyScreen-B5LWH116.mjs (1:2099): A comment
2026-01-08T06:37:32.761Z	
2026-01-08T06:37:32.761Z	"/*#__PURE__*/"
2026-01-08T06:37:32.761Z	
2026-01-08T06:37:32.761Z	in "node_modules/@privy-io/react-auth/dist/esm/LinkPasskeyScreen-B5LWH116.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.761Z	node_modules/@privy-io/react-auth/dist/esm/LinkPasskeyScreen-B5LWH116.mjs (1:2233): A comment
2026-01-08T06:37:32.761Z	
2026-01-08T06:37:32.761Z	"/*#__PURE__*/"
2026-01-08T06:37:32.761Z	
2026-01-08T06:37:32.761Z	in "node_modules/@privy-io/react-auth/dist/esm/LinkPasskeyScreen-B5LWH116.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.766Z	node_modules/@privy-io/react-auth/dist/esm/SignRequestScreen-BNC2mYtk.mjs (1:1851): A comment
2026-01-08T06:37:32.766Z	
2026-01-08T06:37:32.766Z	"/*#__PURE__*/"
2026-01-08T06:37:32.766Z	
2026-01-08T06:37:32.766Z	in "node_modules/@privy-io/react-auth/dist/esm/SignRequestScreen-BNC2mYtk.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.767Z	node_modules/@privy-io/react-auth/dist/esm/SignRequestScreen-BNC2mYtk.mjs (1:3676): A comment
2026-01-08T06:37:32.767Z	
2026-01-08T06:37:32.767Z	"/*#__PURE__*/"
2026-01-08T06:37:32.767Z	
2026-01-08T06:37:32.767Z	in "node_modules/@privy-io/react-auth/dist/esm/SignRequestScreen-BNC2mYtk.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.769Z	node_modules/@privy-io/react-auth/dist/esm/UpdateEmailScreen-BVzkFXeI.mjs (1:2861): A comment
2026-01-08T06:37:32.769Z	
2026-01-08T06:37:32.769Z	"/*#__PURE__*/"
2026-01-08T06:37:32.769Z	
2026-01-08T06:37:32.769Z	in "node_modules/@privy-io/react-auth/dist/esm/UpdateEmailScreen-BVzkFXeI.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.771Z	node_modules/@privy-io/react-auth/dist/esm/UpdatePhoneScreen-DZ_resri.mjs (1:1352): A comment
2026-01-08T06:37:32.771Z	
2026-01-08T06:37:32.771Z	"/*#__PURE__*/"
2026-01-08T06:37:32.771Z	
2026-01-08T06:37:32.771Z	in "node_modules/@privy-io/react-auth/dist/esm/UpdatePhoneScreen-DZ_resri.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.772Z	node_modules/@privy-io/react-auth/dist/esm/UpdatePhoneScreen-DZ_resri.mjs (1:1774): A comment
2026-01-08T06:37:32.772Z	
2026-01-08T06:37:32.772Z	"/*#__PURE__*/"
2026-01-08T06:37:32.772Z	
2026-01-08T06:37:32.772Z	in "node_modules/@privy-io/react-auth/dist/esm/UpdatePhoneScreen-DZ_resri.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.774Z	node_modules/@privy-io/react-auth/dist/esm/TransferFromWalletScreen-CLqyv8Ra.mjs (1:3338): A comment
2026-01-08T06:37:32.774Z	
2026-01-08T06:37:32.774Z	"/*#__PURE__*/"
2026-01-08T06:37:32.774Z	
2026-01-08T06:37:32.774Z	in "node_modules/@privy-io/react-auth/dist/esm/TransferFromWalletScreen-CLqyv8Ra.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.777Z	node_modules/@privy-io/react-auth/dist/esm/UserLimitReachedScreen-CTmSitf0.mjs (1:1792): A comment
2026-01-08T06:37:32.777Z	
2026-01-08T06:37:32.777Z	"/*#__PURE__*/"
2026-01-08T06:37:32.777Z	
2026-01-08T06:37:32.777Z	in "node_modules/@privy-io/react-auth/dist/esm/UserLimitReachedScreen-CTmSitf0.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.778Z	node_modules/@privy-io/react-auth/dist/esm/TelegramAuthScreen-xobB3RHK.mjs (1:1880): A comment
2026-01-08T06:37:32.779Z	
2026-01-08T06:37:32.779Z	"/*#__PURE__*/"
2026-01-08T06:37:32.779Z	
2026-01-08T06:37:32.779Z	in "node_modules/@privy-io/react-auth/dist/esm/TelegramAuthScreen-xobB3RHK.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:32.779Z	node_modules/@privy-io/react-auth/dist/esm/TelegramAuthScreen-xobB3RHK.mjs (1:4203): A comment
2026-01-08T06:37:32.779Z	
2026-01-08T06:37:32.779Z	"/*#__PURE__*/"
2026-01-08T06:37:32.779Z	
2026-01-08T06:37:32.779Z	in "node_modules/@privy-io/react-auth/dist/esm/TelegramAuthScreen-xobB3RHK.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.803Z	node_modules/@privy-io/react-auth/dist/esm/ModalHeader-BTru6YQw.mjs (1:429): A comment
2026-01-08T06:37:33.804Z	
2026-01-08T06:37:33.804Z	"/*#__PURE__*/"
2026-01-08T06:37:33.804Z	
2026-01-08T06:37:33.804Z	in "node_modules/@privy-io/react-auth/dist/esm/ModalHeader-BTru6YQw.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.805Z	node_modules/@privy-io/react-auth/dist/esm/ModalHeader-BTru6YQw.mjs (3:297): A comment
2026-01-08T06:37:33.805Z	
2026-01-08T06:37:33.805Z	"/*#__PURE__*/"
2026-01-08T06:37:33.805Z	
2026-01-08T06:37:33.805Z	in "node_modules/@privy-io/react-auth/dist/esm/ModalHeader-BTru6YQw.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.805Z	node_modules/@privy-io/react-auth/dist/esm/ModalHeader-BTru6YQw.mjs (3:1591): A comment
2026-01-08T06:37:33.805Z	
2026-01-08T06:37:33.805Z	"/*#__PURE__*/"
2026-01-08T06:37:33.805Z	
2026-01-08T06:37:33.805Z	in "node_modules/@privy-io/react-auth/dist/esm/ModalHeader-BTru6YQw.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.808Z	node_modules/@privy-io/react-auth/dist/esm/FundWalletMethodHeader-CS84Ots9.mjs (1:239): A comment
2026-01-08T06:37:33.808Z	
2026-01-08T06:37:33.808Z	"/*#__PURE__*/"
2026-01-08T06:37:33.808Z	
2026-01-08T06:37:33.808Z	in "node_modules/@privy-io/react-auth/dist/esm/FundWalletMethodHeader-CS84Ots9.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.809Z	node_modules/@privy-io/react-auth/dist/esm/TransferOrBridgeLoadingScreen-BY7Eot6x.mjs (1:846): A comment
2026-01-08T06:37:33.809Z	
2026-01-08T06:37:33.810Z	"/*#__PURE__*/"
2026-01-08T06:37:33.811Z	
2026-01-08T06:37:33.812Z	in "node_modules/@privy-io/react-auth/dist/esm/TransferOrBridgeLoadingScreen-BY7Eot6x.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.815Z	node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs (1:265): A comment
2026-01-08T06:37:33.815Z	
2026-01-08T06:37:33.815Z	"/*#__PURE__*/"
2026-01-08T06:37:33.815Z	
2026-01-08T06:37:33.815Z	in "node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.815Z	node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs (1:327): A comment
2026-01-08T06:37:33.815Z	
2026-01-08T06:37:33.815Z	"/*#__PURE__*/"
2026-01-08T06:37:33.815Z	
2026-01-08T06:37:33.815Z	in "node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.815Z	node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs (1:398): A comment
2026-01-08T06:37:33.815Z	
2026-01-08T06:37:33.815Z	"/*#__PURE__*/"
2026-01-08T06:37:33.815Z	
2026-01-08T06:37:33.815Z	in "node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.816Z	node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs (1:456): A comment
2026-01-08T06:37:33.816Z	
2026-01-08T06:37:33.816Z	"/*#__PURE__*/"
2026-01-08T06:37:33.816Z	
2026-01-08T06:37:33.816Z	in "node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.816Z	node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs (1:1145): A comment
2026-01-08T06:37:33.816Z	
2026-01-08T06:37:33.816Z	"/*#__PURE__*/"
2026-01-08T06:37:33.816Z	
2026-01-08T06:37:33.816Z	in "node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.816Z	node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs (1:3428): A comment
2026-01-08T06:37:33.816Z	
2026-01-08T06:37:33.816Z	"/*#__PURE__*/"
2026-01-08T06:37:33.816Z	
2026-01-08T06:37:33.816Z	in "node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.816Z	node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs (1:3823): A comment
2026-01-08T06:37:33.816Z	
2026-01-08T06:37:33.816Z	"/*#__PURE__*/"
2026-01-08T06:37:33.816Z	
2026-01-08T06:37:33.816Z	in "node_modules/@privy-io/react-auth/dist/esm/Button-BCV6mjvS.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.817Z	node_modules/@privy-io/react-auth/dist/esm/NetworkIcon-B48ilzF8.mjs (1:12201): A comment
2026-01-08T06:37:33.817Z	
2026-01-08T06:37:33.817Z	"/*#__PURE__*/"
2026-01-08T06:37:33.817Z	
2026-01-08T06:37:33.817Z	in "node_modules/@privy-io/react-auth/dist/esm/NetworkIcon-B48ilzF8.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.818Z	node_modules/@privy-io/react-auth/dist/esm/NetworkIcon-B48ilzF8.mjs (1:12244): A comment
2026-01-08T06:37:33.818Z	
2026-01-08T06:37:33.818Z	"/*#__PURE__*/"
2026-01-08T06:37:33.818Z	
2026-01-08T06:37:33.818Z	in "node_modules/@privy-io/react-auth/dist/esm/NetworkIcon-B48ilzF8.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.926Z	node_modules/@privy-io/react-auth/dist/esm/WalletLink-Cj92ni3W.mjs (1:456): A comment
2026-01-08T06:37:33.926Z	
2026-01-08T06:37:33.926Z	"/*#__PURE__*/"
2026-01-08T06:37:33.926Z	
2026-01-08T06:37:33.926Z	in "node_modules/@privy-io/react-auth/dist/esm/WalletLink-Cj92ni3W.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.926Z	node_modules/@privy-io/react-auth/dist/esm/WalletLink-Cj92ni3W.mjs (1:587): A comment
2026-01-08T06:37:33.926Z	
2026-01-08T06:37:33.926Z	"/*#__PURE__*/"
2026-01-08T06:37:33.926Z	
2026-01-08T06:37:33.926Z	in "node_modules/@privy-io/react-auth/dist/esm/WalletLink-Cj92ni3W.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.926Z	node_modules/@privy-io/react-auth/dist/esm/WalletLink-Cj92ni3W.mjs (2:263): A comment
2026-01-08T06:37:33.926Z	
2026-01-08T06:37:33.926Z	"/*#__PURE__*/"
2026-01-08T06:37:33.926Z	
2026-01-08T06:37:33.926Z	in "node_modules/@privy-io/react-auth/dist/esm/WalletLink-Cj92ni3W.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.931Z	node_modules/@privy-io/react-auth/dist/esm/TransactionErrorView-RLIeHdul.mjs (1:1721): A comment
2026-01-08T06:37:33.933Z	
2026-01-08T06:37:33.933Z	"/*#__PURE__*/"
2026-01-08T06:37:33.933Z	
2026-01-08T06:37:33.933Z	in "node_modules/@privy-io/react-auth/dist/esm/TransactionErrorView-RLIeHdul.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.933Z	node_modules/@privy-io/react-auth/dist/esm/TransactionErrorView-RLIeHdul.mjs (1:2105): A comment
2026-01-08T06:37:33.934Z	
2026-01-08T06:37:33.934Z	"/*#__PURE__*/"
2026-01-08T06:37:33.934Z	
2026-01-08T06:37:33.934Z	in "node_modules/@privy-io/react-auth/dist/esm/TransactionErrorView-RLIeHdul.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.934Z	node_modules/@privy-io/react-auth/dist/esm/TransactionErrorView-RLIeHdul.mjs (1:3128): A comment
2026-01-08T06:37:33.934Z	
2026-01-08T06:37:33.934Z	"/*#__PURE__*/"
2026-01-08T06:37:33.934Z	
2026-01-08T06:37:33.934Z	in "node_modules/@privy-io/react-auth/dist/esm/TransactionErrorView-RLIeHdul.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.934Z	node_modules/@privy-io/react-auth/dist/esm/TransactionErrorView-RLIeHdul.mjs (1:7925): A comment
2026-01-08T06:37:33.935Z	
2026-01-08T06:37:33.935Z	"/*#__PURE__*/"
2026-01-08T06:37:33.935Z	
2026-01-08T06:37:33.935Z	in "node_modules/@privy-io/react-auth/dist/esm/TransactionErrorView-RLIeHdul.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.935Z	node_modules/@privy-io/react-auth/dist/esm/TransactionErrorView-RLIeHdul.mjs (2:877): A comment
2026-01-08T06:37:33.935Z	
2026-01-08T06:37:33.936Z	"/*#__PURE__*/"
2026-01-08T06:37:33.936Z	
2026-01-08T06:37:33.936Z	in "node_modules/@privy-io/react-auth/dist/esm/TransactionErrorView-RLIeHdul.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.936Z	node_modules/@privy-io/react-auth/dist/esm/TransactionErrorView-RLIeHdul.mjs (2:11396): A comment
2026-01-08T06:37:33.936Z	
2026-01-08T06:37:33.936Z	"/*#__PURE__*/"
2026-01-08T06:37:33.936Z	
2026-01-08T06:37:33.936Z	in "node_modules/@privy-io/react-auth/dist/esm/TransactionErrorView-RLIeHdul.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.936Z	node_modules/@privy-io/react-auth/dist/esm/ScreenLayout-CNho46nP.mjs (1:323): A comment
2026-01-08T06:37:33.936Z	
2026-01-08T06:37:33.936Z	"/*#__PURE__*/"
2026-01-08T06:37:33.936Z	
2026-01-08T06:37:33.936Z	in "node_modules/@privy-io/react-auth/dist/esm/ScreenLayout-CNho46nP.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.936Z	node_modules/@privy-io/react-auth/dist/esm/ScreenLayout-CNho46nP.mjs (1:466): A comment
2026-01-08T06:37:33.936Z	
2026-01-08T06:37:33.936Z	"/*#__PURE__*/"
2026-01-08T06:37:33.936Z	
2026-01-08T06:37:33.938Z	in "node_modules/@privy-io/react-auth/dist/esm/ScreenLayout-CNho46nP.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:33.938Z	node_modules/@privy-io/react-auth/dist/esm/ScreenLayout-CNho46nP.mjs (1:563): A comment
2026-01-08T06:37:33.939Z	
2026-01-08T06:37:33.939Z	"/*#__PURE__*/"
2026-01-08T06:37:33.939Z	
2026-01-08T06:37:33.939Z	in "node_modules/@privy-io/react-auth/dist/esm/ScreenLayout-CNho46nP.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.334Z	node_modules/@privy-io/react-auth/dist/esm/ConnectWalletView-Cmm9Ulis.mjs (1:1858): A comment
2026-01-08T06:37:34.334Z	
2026-01-08T06:37:34.334Z	"/*#__PURE__*/"
2026-01-08T06:37:34.334Z	
2026-01-08T06:37:34.334Z	in "node_modules/@privy-io/react-auth/dist/esm/ConnectWalletView-Cmm9Ulis.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.347Z	node_modules/@privy-io/react-auth/dist/esm/QrCode-Oxn5GT3C.mjs (2:688): A comment
2026-01-08T06:37:34.347Z	
2026-01-08T06:37:34.347Z	"/*#__PURE__*/"
2026-01-08T06:37:34.347Z	
2026-01-08T06:37:34.347Z	in "node_modules/@privy-io/react-auth/dist/esm/QrCode-Oxn5GT3C.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.347Z	node_modules/@privy-io/react-auth/dist/esm/QrCode-Oxn5GT3C.mjs (2:827): A comment
2026-01-08T06:37:34.347Z	
2026-01-08T06:37:34.349Z	"/*#__PURE__*/"
2026-01-08T06:37:34.349Z	
2026-01-08T06:37:34.349Z	in "node_modules/@privy-io/react-auth/dist/esm/QrCode-Oxn5GT3C.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.349Z	node_modules/@privy-io/react-auth/dist/esm/QrCode-Oxn5GT3C.mjs (2:1087): A comment
2026-01-08T06:37:34.349Z	
2026-01-08T06:37:34.349Z	"/*#__PURE__*/"
2026-01-08T06:37:34.349Z	
2026-01-08T06:37:34.349Z	in "node_modules/@privy-io/react-auth/dist/esm/QrCode-Oxn5GT3C.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.349Z	node_modules/@privy-io/react-auth/dist/esm/QrCode-Oxn5GT3C.mjs (2:2031): A comment
2026-01-08T06:37:34.349Z	
2026-01-08T06:37:34.349Z	"/*#__PURE__*/"
2026-01-08T06:37:34.349Z	
2026-01-08T06:37:34.349Z	in "node_modules/@privy-io/react-auth/dist/esm/QrCode-Oxn5GT3C.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.354Z	node_modules/@privy-io/react-auth/dist/esm/BridgeNetworkSelectionView-BXBCujiq.mjs (1:4464): A comment
2026-01-08T06:37:34.354Z	
2026-01-08T06:37:34.354Z	"/*#__PURE__*/"
2026-01-08T06:37:34.354Z	
2026-01-08T06:37:34.354Z	in "node_modules/@privy-io/react-auth/dist/esm/BridgeNetworkSelectionView-BXBCujiq.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.356Z	node_modules/@privy-io/react-auth/dist/esm/Chip-Bsgj4Yc-.mjs (1:919): A comment
2026-01-08T06:37:34.356Z	
2026-01-08T06:37:34.356Z	"/*#__PURE__*/"
2026-01-08T06:37:34.356Z	
2026-01-08T06:37:34.356Z	in "node_modules/@privy-io/react-auth/dist/esm/Chip-Bsgj4Yc-.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.362Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:499): A comment
2026-01-08T06:37:34.362Z	
2026-01-08T06:37:34.362Z	"/*#__PURE__*/"
2026-01-08T06:37:34.362Z	
2026-01-08T06:37:34.362Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.362Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:965): A comment
2026-01-08T06:37:34.362Z	
2026-01-08T06:37:34.362Z	"/*#__PURE__*/"
2026-01-08T06:37:34.362Z	
2026-01-08T06:37:34.362Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.362Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:4921): A comment
2026-01-08T06:37:34.362Z	
2026-01-08T06:37:34.362Z	"/*#__PURE__*/"
2026-01-08T06:37:34.362Z	
2026-01-08T06:37:34.362Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.362Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:6738): A comment
2026-01-08T06:37:34.362Z	
2026-01-08T06:37:34.362Z	"/*#__PURE__*/"
2026-01-08T06:37:34.363Z	
2026-01-08T06:37:34.363Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.363Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:7636): A comment
2026-01-08T06:37:34.363Z	
2026-01-08T06:37:34.363Z	"/*#__PURE__*/"
2026-01-08T06:37:34.363Z	
2026-01-08T06:37:34.364Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.364Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:9851): A comment
2026-01-08T06:37:34.364Z	
2026-01-08T06:37:34.364Z	"/*#__PURE__*/"
2026-01-08T06:37:34.364Z	
2026-01-08T06:37:34.365Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.365Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10013): A comment
2026-01-08T06:37:34.365Z	
2026-01-08T06:37:34.365Z	"/*#__PURE__*/"
2026-01-08T06:37:34.365Z	
2026-01-08T06:37:34.365Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.365Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10173): A comment
2026-01-08T06:37:34.369Z	
2026-01-08T06:37:34.369Z	"/*#__PURE__*/"
2026-01-08T06:37:34.369Z	
2026-01-08T06:37:34.369Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.373Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10237): A comment
2026-01-08T06:37:34.373Z	
2026-01-08T06:37:34.373Z	"/*#__PURE__*/"
2026-01-08T06:37:34.373Z	
2026-01-08T06:37:34.373Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.374Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10305): A comment
2026-01-08T06:37:34.374Z	
2026-01-08T06:37:34.374Z	"/*#__PURE__*/"
2026-01-08T06:37:34.374Z	
2026-01-08T06:37:34.374Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.374Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10352): A comment
2026-01-08T06:37:34.374Z	
2026-01-08T06:37:34.374Z	"/*#__PURE__*/"
2026-01-08T06:37:34.374Z	
2026-01-08T06:37:34.374Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.374Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10416): A comment
2026-01-08T06:37:34.374Z	
2026-01-08T06:37:34.374Z	"/*#__PURE__*/"
2026-01-08T06:37:34.374Z	
2026-01-08T06:37:34.374Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.374Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10482): A comment
2026-01-08T06:37:34.374Z	
2026-01-08T06:37:34.375Z	"/*#__PURE__*/"
2026-01-08T06:37:34.375Z	
2026-01-08T06:37:34.375Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.375Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10548): A comment
2026-01-08T06:37:34.375Z	
2026-01-08T06:37:34.375Z	"/*#__PURE__*/"
2026-01-08T06:37:34.375Z	
2026-01-08T06:37:34.375Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.375Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10610): A comment
2026-01-08T06:37:34.375Z	
2026-01-08T06:37:34.375Z	"/*#__PURE__*/"
2026-01-08T06:37:34.375Z	
2026-01-08T06:37:34.375Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.377Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10672): A comment
2026-01-08T06:37:34.377Z	
2026-01-08T06:37:34.377Z	"/*#__PURE__*/"
2026-01-08T06:37:34.377Z	
2026-01-08T06:37:34.377Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.381Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10737): A comment
2026-01-08T06:37:34.381Z	
2026-01-08T06:37:34.381Z	"/*#__PURE__*/"
2026-01-08T06:37:34.381Z	
2026-01-08T06:37:34.381Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.381Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10805): A comment
2026-01-08T06:37:34.381Z	
2026-01-08T06:37:34.381Z	"/*#__PURE__*/"
2026-01-08T06:37:34.381Z	
2026-01-08T06:37:34.381Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.381Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10873): A comment
2026-01-08T06:37:34.381Z	
2026-01-08T06:37:34.382Z	"/*#__PURE__*/"
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.382Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10940): A comment
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	"/*#__PURE__*/"
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.382Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:10979): A comment
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	"/*#__PURE__*/"
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.382Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:11141): A comment
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	"/*#__PURE__*/"
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.382Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:11274): A comment
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	"/*#__PURE__*/"
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.382Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:12647): A comment
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	"/*#__PURE__*/"
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.382Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:15823): A comment
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	"/*#__PURE__*/"
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.382Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:15983): A comment
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	"/*#__PURE__*/"
2026-01-08T06:37:34.382Z	
2026-01-08T06:37:34.382Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.383Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16141): A comment
2026-01-08T06:37:34.383Z	
2026-01-08T06:37:34.383Z	"/*#__PURE__*/"
2026-01-08T06:37:34.383Z	
2026-01-08T06:37:34.383Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.383Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16205): A comment
2026-01-08T06:37:34.383Z	
2026-01-08T06:37:34.383Z	"/*#__PURE__*/"
2026-01-08T06:37:34.383Z	
2026-01-08T06:37:34.383Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.383Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16273): A comment
2026-01-08T06:37:34.383Z	
2026-01-08T06:37:34.383Z	"/*#__PURE__*/"
2026-01-08T06:37:34.383Z	
2026-01-08T06:37:34.383Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.383Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16320): A comment
2026-01-08T06:37:34.383Z	
2026-01-08T06:37:34.383Z	"/*#__PURE__*/"
2026-01-08T06:37:34.383Z	
2026-01-08T06:37:34.383Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.383Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16384): A comment
2026-01-08T06:37:34.383Z	
2026-01-08T06:37:34.384Z	"/*#__PURE__*/"
2026-01-08T06:37:34.384Z	
2026-01-08T06:37:34.384Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.384Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16450): A comment
2026-01-08T06:37:34.384Z	
2026-01-08T06:37:34.384Z	"/*#__PURE__*/"
2026-01-08T06:37:34.384Z	
2026-01-08T06:37:34.384Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.384Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16517): A comment
2026-01-08T06:37:34.384Z	
2026-01-08T06:37:34.384Z	"/*#__PURE__*/"
2026-01-08T06:37:34.384Z	
2026-01-08T06:37:34.385Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.385Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16585): A comment
2026-01-08T06:37:34.385Z	
2026-01-08T06:37:34.385Z	"/*#__PURE__*/"
2026-01-08T06:37:34.386Z	
2026-01-08T06:37:34.386Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.386Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16652): A comment
2026-01-08T06:37:34.386Z	
2026-01-08T06:37:34.386Z	"/*#__PURE__*/"
2026-01-08T06:37:34.386Z	
2026-01-08T06:37:34.386Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.386Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16714): A comment
2026-01-08T06:37:34.386Z	
2026-01-08T06:37:34.386Z	"/*#__PURE__*/"
2026-01-08T06:37:34.386Z	
2026-01-08T06:37:34.387Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.387Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16776): A comment
2026-01-08T06:37:34.387Z	
2026-01-08T06:37:34.387Z	"/*#__PURE__*/"
2026-01-08T06:37:34.387Z	
2026-01-08T06:37:34.387Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.387Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16841): A comment
2026-01-08T06:37:34.387Z	
2026-01-08T06:37:34.387Z	"/*#__PURE__*/"
2026-01-08T06:37:34.387Z	
2026-01-08T06:37:34.387Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.387Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16908): A comment
2026-01-08T06:37:34.387Z	
2026-01-08T06:37:34.387Z	"/*#__PURE__*/"
2026-01-08T06:37:34.387Z	
2026-01-08T06:37:34.387Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.387Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:16965): A comment
2026-01-08T06:37:34.387Z	
2026-01-08T06:37:34.387Z	"/*#__PURE__*/"
2026-01-08T06:37:34.388Z	
2026-01-08T06:37:34.388Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.388Z	node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs (2:17581): A comment
2026-01-08T06:37:34.388Z	
2026-01-08T06:37:34.388Z	"/*#__PURE__*/"
2026-01-08T06:37:34.388Z	
2026-01-08T06:37:34.388Z	in "node_modules/@privy-io/react-auth/dist/esm/CustomLandingScreenView-B_ZwsVad.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.392Z	node_modules/@privy-io/react-auth/dist/esm/ConnectEmailForm-DtLW0rv7.mjs (1:1686): A comment
2026-01-08T06:37:34.393Z	
2026-01-08T06:37:34.393Z	"/*#__PURE__*/"
2026-01-08T06:37:34.393Z	
2026-01-08T06:37:34.393Z	in "node_modules/@privy-io/react-auth/dist/esm/ConnectEmailForm-DtLW0rv7.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.394Z	node_modules/@privy-io/react-auth/dist/esm/twitter-6jomarO4.mjs (1:7958): A comment
2026-01-08T06:37:34.394Z	
2026-01-08T06:37:34.394Z	"/*#__PURE__*/"
2026-01-08T06:37:34.394Z	
2026-01-08T06:37:34.394Z	in "node_modules/@privy-io/react-auth/dist/esm/twitter-6jomarO4.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.394Z	node_modules/@privy-io/react-auth/dist/esm/twitter-6jomarO4.mjs (1:12540): A comment
2026-01-08T06:37:34.394Z	
2026-01-08T06:37:34.394Z	"/*#__PURE__*/"
2026-01-08T06:37:34.394Z	
2026-01-08T06:37:34.394Z	in "node_modules/@privy-io/react-auth/dist/esm/twitter-6jomarO4.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.394Z	node_modules/@privy-io/react-auth/dist/esm/twitter-6jomarO4.mjs (1:13625): A comment
2026-01-08T06:37:34.394Z	
2026-01-08T06:37:34.394Z	"/*#__PURE__*/"
2026-01-08T06:37:34.394Z	
2026-01-08T06:37:34.394Z	in "node_modules/@privy-io/react-auth/dist/esm/twitter-6jomarO4.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.394Z	node_modules/@privy-io/react-auth/dist/esm/twitter-6jomarO4.mjs (1:14609): A comment
2026-01-08T06:37:34.394Z	
2026-01-08T06:37:34.394Z	"/*#__PURE__*/"
2026-01-08T06:37:34.395Z	
2026-01-08T06:37:34.395Z	in "node_modules/@privy-io/react-auth/dist/esm/twitter-6jomarO4.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.395Z	node_modules/@privy-io/react-auth/dist/esm/telegram-B-JqnkqZ.mjs (1:64): A comment
2026-01-08T06:37:34.395Z	
2026-01-08T06:37:34.395Z	"/*#__PURE__*/"
2026-01-08T06:37:34.395Z	
2026-01-08T06:37:34.395Z	in "node_modules/@privy-io/react-auth/dist/esm/telegram-B-JqnkqZ.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.395Z	node_modules/@privy-io/react-auth/dist/esm/twitch-5IOe4sIQ.mjs (1:64): A comment
2026-01-08T06:37:34.403Z	
2026-01-08T06:37:34.403Z	"/*#__PURE__*/"
2026-01-08T06:37:34.403Z	
2026-01-08T06:37:34.404Z	in "node_modules/@privy-io/react-auth/dist/esm/twitch-5IOe4sIQ.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.404Z	node_modules/@privy-io/react-auth/dist/esm/twitch-5IOe4sIQ.mjs (1:10025): A comment
2026-01-08T06:37:34.404Z	
2026-01-08T06:37:34.404Z	"/*#__PURE__*/"
2026-01-08T06:37:34.404Z	
2026-01-08T06:37:34.404Z	in "node_modules/@privy-io/react-auth/dist/esm/twitch-5IOe4sIQ.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.404Z	node_modules/@privy-io/react-auth/dist/esm/SetWalletPasswordForm-vaG_68V0.mjs (2:313): A comment
2026-01-08T06:37:34.404Z	
2026-01-08T06:37:34.404Z	"/*#__PURE__*/"
2026-01-08T06:37:34.404Z	
2026-01-08T06:37:34.404Z	in "node_modules/@privy-io/react-auth/dist/esm/SetWalletPasswordForm-vaG_68V0.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.404Z	node_modules/@privy-io/react-auth/dist/esm/SetWalletPasswordForm-vaG_68V0.mjs (2:2625): A comment
2026-01-08T06:37:34.404Z	
2026-01-08T06:37:34.404Z	"/*#__PURE__*/"
2026-01-08T06:37:34.404Z	
2026-01-08T06:37:34.404Z	in "node_modules/@privy-io/react-auth/dist/esm/SetWalletPasswordForm-vaG_68V0.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.404Z	node_modules/@privy-io/react-auth/dist/esm/SetWalletPasswordForm-vaG_68V0.mjs (2:5035): A comment
2026-01-08T06:37:34.404Z	
2026-01-08T06:37:34.404Z	"/*#__PURE__*/"
2026-01-08T06:37:34.404Z	
2026-01-08T06:37:34.404Z	in "node_modules/@privy-io/react-auth/dist/esm/SetWalletPasswordForm-vaG_68V0.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.405Z	node_modules/@privy-io/react-auth/dist/esm/CopyToClipboard-DatKc59_.mjs (1:509): A comment
2026-01-08T06:37:34.406Z	
2026-01-08T06:37:34.406Z	"/*#__PURE__*/"
2026-01-08T06:37:34.406Z	
2026-01-08T06:37:34.406Z	in "node_modules/@privy-io/react-auth/dist/esm/CopyToClipboard-DatKc59_.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.409Z	node_modules/@privy-io/react-auth/dist/esm/TodoList-Dn0Qu-vv.mjs (1:563): A comment
2026-01-08T06:37:34.409Z	
2026-01-08T06:37:34.409Z	"/*#__PURE__*/"
2026-01-08T06:37:34.409Z	
2026-01-08T06:37:34.410Z	in "node_modules/@privy-io/react-auth/dist/esm/TodoList-Dn0Qu-vv.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.410Z	node_modules/@privy-io/react-auth/dist/esm/TodoList-Dn0Qu-vv.mjs (2:0): A comment
2026-01-08T06:37:34.410Z	
2026-01-08T06:37:34.410Z	"/*#__PURE__*/"
2026-01-08T06:37:34.410Z	
2026-01-08T06:37:34.410Z	in "node_modules/@privy-io/react-auth/dist/esm/TodoList-Dn0Qu-vv.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.410Z	node_modules/@privy-io/react-auth/dist/esm/TodoList-Dn0Qu-vv.mjs (2:132): A comment
2026-01-08T06:37:34.410Z	
2026-01-08T06:37:34.410Z	"/*#__PURE__*/"
2026-01-08T06:37:34.410Z	
2026-01-08T06:37:34.410Z	in "node_modules/@privy-io/react-auth/dist/esm/TodoList-Dn0Qu-vv.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.410Z	node_modules/@privy-io/react-auth/dist/esm/TodoList-Dn0Qu-vv.mjs (2:204): A comment
2026-01-08T06:37:34.410Z	
2026-01-08T06:37:34.410Z	"/*#__PURE__*/"
2026-01-08T06:37:34.410Z	
2026-01-08T06:37:34.410Z	in "node_modules/@privy-io/react-auth/dist/esm/TodoList-Dn0Qu-vv.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.413Z	node_modules/@privy-io/react-auth/dist/esm/OpenLink-BpeNYBKs.mjs (1:143): A comment
2026-01-08T06:37:34.413Z	
2026-01-08T06:37:34.413Z	"/*#__PURE__*/"
2026-01-08T06:37:34.413Z	
2026-01-08T06:37:34.413Z	in "node_modules/@privy-io/react-auth/dist/esm/OpenLink-BpeNYBKs.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.415Z	node_modules/@privy-io/react-auth/dist/esm/EnrollTotp-CMtBCJbR.mjs (1:3485): A comment
2026-01-08T06:37:34.415Z	
2026-01-08T06:37:34.415Z	"/*#__PURE__*/"
2026-01-08T06:37:34.415Z	
2026-01-08T06:37:34.415Z	in "node_modules/@privy-io/react-auth/dist/esm/EnrollTotp-CMtBCJbR.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.416Z	node_modules/@privy-io/react-auth/dist/esm/EnrollTotp-CMtBCJbR.mjs (1:18752): A comment
2026-01-08T06:37:34.416Z	
2026-01-08T06:37:34.416Z	"/*#__PURE__*/"
2026-01-08T06:37:34.416Z	
2026-01-08T06:37:34.416Z	in "node_modules/@privy-io/react-auth/dist/esm/EnrollTotp-CMtBCJbR.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.416Z	node_modules/@privy-io/react-auth/dist/esm/EnrollTotp-CMtBCJbR.mjs (1:21084): A comment
2026-01-08T06:37:34.416Z	
2026-01-08T06:37:34.416Z	"/*#__PURE__*/"
2026-01-08T06:37:34.416Z	
2026-01-08T06:37:34.416Z	in "node_modules/@privy-io/react-auth/dist/esm/EnrollTotp-CMtBCJbR.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.418Z	node_modules/@privy-io/react-auth/dist/esm/PinInput-C3_MNxMt.mjs (1:8071): A comment
2026-01-08T06:37:34.418Z	
2026-01-08T06:37:34.418Z	"/*#__PURE__*/"
2026-01-08T06:37:34.418Z	
2026-01-08T06:37:34.418Z	in "node_modules/@privy-io/react-auth/dist/esm/PinInput-C3_MNxMt.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.419Z	node_modules/@privy-io/react-auth/dist/esm/to-ui-error-CYFXznYy.mjs (1:2867): A comment
2026-01-08T06:37:34.420Z	
2026-01-08T06:37:34.420Z	"/*#__PURE__*/"
2026-01-08T06:37:34.420Z	
2026-01-08T06:37:34.420Z	in "node_modules/@privy-io/react-auth/dist/esm/to-ui-error-CYFXznYy.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.420Z	node_modules/@privy-io/react-auth/dist/esm/to-ui-error-CYFXznYy.mjs (1:4112): A comment
2026-01-08T06:37:34.420Z	
2026-01-08T06:37:34.420Z	"/*#__PURE__*/"
2026-01-08T06:37:34.420Z	
2026-01-08T06:37:34.420Z	in "node_modules/@privy-io/react-auth/dist/esm/to-ui-error-CYFXznYy.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.420Z	node_modules/@privy-io/react-auth/dist/esm/to-ui-error-CYFXznYy.mjs (1:4779): A comment
2026-01-08T06:37:34.420Z	
2026-01-08T06:37:34.420Z	"/*#__PURE__*/"
2026-01-08T06:37:34.420Z	
2026-01-08T06:37:34.421Z	in "node_modules/@privy-io/react-auth/dist/esm/to-ui-error-CYFXznYy.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.424Z	node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs (1:1610): A comment
2026-01-08T06:37:34.424Z	
2026-01-08T06:37:34.424Z	"/*#__PURE__*/"
2026-01-08T06:37:34.424Z	
2026-01-08T06:37:34.424Z	in "node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.424Z	node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs (1:2581): A comment
2026-01-08T06:37:34.424Z	
2026-01-08T06:37:34.424Z	"/*#__PURE__*/"
2026-01-08T06:37:34.425Z	
2026-01-08T06:37:34.425Z	in "node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.425Z	node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs (1:2786): A comment
2026-01-08T06:37:34.425Z	
2026-01-08T06:37:34.425Z	"/*#__PURE__*/"
2026-01-08T06:37:34.425Z	
2026-01-08T06:37:34.425Z	in "node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.425Z	node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs (1:3022): A comment
2026-01-08T06:37:34.425Z	
2026-01-08T06:37:34.425Z	"/*#__PURE__*/"
2026-01-08T06:37:34.425Z	
2026-01-08T06:37:34.425Z	in "node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.425Z	node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs (2:317): A comment
2026-01-08T06:37:34.425Z	
2026-01-08T06:37:34.425Z	"/*#__PURE__*/"
2026-01-08T06:37:34.425Z	
2026-01-08T06:37:34.425Z	in "node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.425Z	node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs (2:469): A comment
2026-01-08T06:37:34.425Z	
2026-01-08T06:37:34.426Z	"/*#__PURE__*/"
2026-01-08T06:37:34.426Z	
2026-01-08T06:37:34.426Z	in "node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.426Z	node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs (2:2297): A comment
2026-01-08T06:37:34.426Z	
2026-01-08T06:37:34.426Z	"/*#__PURE__*/"
2026-01-08T06:37:34.426Z	
2026-01-08T06:37:34.426Z	in "node_modules/@privy-io/react-auth/dist/esm/TransactionDetails-BdW2lq_B.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:34.426Z	node_modules/@privy-io/react-auth/dist/esm/JsonTree-Bvd2C29R.mjs (1:346): A comment
2026-01-08T06:37:34.426Z	
2026-01-08T06:37:34.426Z	"/*#__PURE__*/"
2026-01-08T06:37:34.426Z	
2026-01-08T06:37:34.426Z	in "node_modules/@privy-io/react-auth/dist/esm/JsonTree-Bvd2C29R.mjs" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:39.815Z	node_modules/@walletconnect/utils/node_modules/ox/_esm/core/Base64.js (6:27): A comment
2026-01-08T06:37:39.816Z	
2026-01-08T06:37:39.816Z	"/*#__PURE__*/"
2026-01-08T06:37:39.816Z	
2026-01-08T06:37:39.817Z	in "node_modules/@walletconnect/utils/node_modules/ox/_esm/core/Base64.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:41.600Z	node_modules/viem/node_modules/ox/_esm/core/Base64.js (6:27): A comment
2026-01-08T06:37:41.601Z	
2026-01-08T06:37:41.602Z	"/*#__PURE__*/"
2026-01-08T06:37:41.602Z	
2026-01-08T06:37:41.602Z	in "node_modules/viem/node_modules/ox/_esm/core/Base64.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:43.955Z	node_modules/ox/_esm/core/Address.js (6:21): A comment
2026-01-08T06:37:43.956Z	
2026-01-08T06:37:43.956Z	"/*#__PURE__*/"
2026-01-08T06:37:43.956Z	
2026-01-08T06:37:43.956Z	in "node_modules/ox/_esm/core/Address.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:43.958Z	node_modules/ox/_esm/core/Base64.js (6:27): A comment
2026-01-08T06:37:43.958Z	
2026-01-08T06:37:43.958Z	"/*#__PURE__*/"
2026-01-08T06:37:43.958Z	
2026-01-08T06:37:43.958Z	in "node_modules/ox/_esm/core/Base64.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:46.129Z	node_modules/ox/_esm/core/internal/cursor.js (2:21): A comment
2026-01-08T06:37:46.130Z	
2026-01-08T06:37:46.130Z	"/*#__PURE__*/"
2026-01-08T06:37:46.130Z	
2026-01-08T06:37:46.130Z	in "node_modules/ox/_esm/core/internal/cursor.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:48.507Z	node_modules/porto/node_modules/ox/_esm/core/Base64.js (6:27): A comment
2026-01-08T06:37:48.509Z	
2026-01-08T06:37:48.509Z	"/*#__PURE__*/"
2026-01-08T06:37:48.509Z	
2026-01-08T06:37:48.509Z	in "node_modules/porto/node_modules/ox/_esm/core/Base64.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:58.244Z	node_modules/@wagmi/connectors/node_modules/@walletconnect/utils/node_modules/ox/_esm/core/internal/cursor.js (2:21): A comment
2026-01-08T06:37:58.244Z	
2026-01-08T06:37:58.244Z	"/*#__PURE__*/"
2026-01-08T06:37:58.244Z	
2026-01-08T06:37:58.244Z	in "node_modules/@wagmi/connectors/node_modules/@walletconnect/utils/node_modules/ox/_esm/core/internal/cursor.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:58.471Z	node_modules/@wagmi/connectors/node_modules/@walletconnect/utils/node_modules/ox/_esm/core/Address.js (6:21): A comment
2026-01-08T06:37:58.471Z	
2026-01-08T06:37:58.471Z	"/*#__PURE__*/"
2026-01-08T06:37:58.471Z	
2026-01-08T06:37:58.471Z	in "node_modules/@wagmi/connectors/node_modules/@walletconnect/utils/node_modules/ox/_esm/core/Address.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:59.909Z	node_modules/@wagmi/connectors/node_modules/@reown/appkit/node_modules/ox/_esm/core/internal/cursor.js (2:21): A comment
2026-01-08T06:37:59.909Z	
2026-01-08T06:37:59.909Z	"/*#__PURE__*/"
2026-01-08T06:37:59.909Z	
2026-01-08T06:37:59.911Z	in "node_modules/@wagmi/connectors/node_modules/@reown/appkit/node_modules/ox/_esm/core/internal/cursor.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:37:59.976Z	node_modules/@wagmi/connectors/node_modules/@reown/appkit/node_modules/ox/_esm/core/Address.js (6:21): A comment
2026-01-08T06:37:59.977Z	
2026-01-08T06:37:59.977Z	"/*#__PURE__*/"
2026-01-08T06:37:59.977Z	
2026-01-08T06:37:59.977Z	in "node_modules/@wagmi/connectors/node_modules/@reown/appkit/node_modules/ox/_esm/core/Address.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:38:00.120Z	node_modules/@wagmi/connectors/node_modules/@reown/appkit-controllers/node_modules/ox/_esm/core/internal/cursor.js (2:21): A comment
2026-01-08T06:38:00.124Z	
2026-01-08T06:38:00.124Z	"/*#__PURE__*/"
2026-01-08T06:38:00.124Z	
2026-01-08T06:38:00.124Z	in "node_modules/@wagmi/connectors/node_modules/@reown/appkit-controllers/node_modules/ox/_esm/core/internal/cursor.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:38:00.134Z	node_modules/@wagmi/connectors/node_modules/@reown/appkit-controllers/node_modules/ox/_esm/core/Address.js (6:21): A comment
2026-01-08T06:38:00.134Z	
2026-01-08T06:38:00.134Z	"/*#__PURE__*/"
2026-01-08T06:38:00.134Z	
2026-01-08T06:38:00.134Z	in "node_modules/@wagmi/connectors/node_modules/@reown/appkit-controllers/node_modules/ox/_esm/core/Address.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
2026-01-08T06:38:13.984Z	✓ 10795 modules transformed.
2026-01-08T06:38:15.569Z	node_modules/onnxruntime-web/dist/ort-web.min.js (6:62546): Use of eval in "node_modules/onnxruntime-web/dist/ort-web.min.js" is strongly discouraged as it poses security risks and may cause issues with minification.
2026-01-08T06:38:16.004Z	rendering chunks...
2026-01-08T06:38:18.468Z	[plugin vite:reporter] 
2026-01-08T06:38:18.468Z	(!) /opt/buildhome/repo/kiko-web/src/utils/apiRateLimiter.ts is dynamically imported by /opt/buildhome/repo/kiko-web/src/services/dexAggregatorService.ts but also statically imported by /opt/buildhome/repo/kiko-web/src/services/swapService.ts, dynamic import will not move module into another chunk.
2026-01-08T06:38:18.468Z	
2026-01-08T06:38:18.468Z	[plugin vite:reporter] 
2026-01-08T06:38:18.468Z	(!) /opt/buildhome/repo/kiko-web/src/services/swapService.ts is dynamically imported by /opt/buildhome/repo/kiko-web/src/components/Chat/ChatInterface.tsx, /opt/buildhome/repo/kiko-web/src/components/Chat/ChatInterface.tsx, /opt/buildhome/repo/kiko-web/src/components/Chat/ChatInterface.tsx but also statically imported by /opt/buildhome/repo/kiko-web/src/components/Swap/SwapCardIntegrated.tsx, /opt/buildhome/repo/kiko-web/src/hooks/useSwap.ts, dynamic import will not move module into another chunk.
2026-01-08T06:38:18.468Z	
2026-01-08T06:38:18.469Z	[plugin vite:reporter] 
2026-01-08T06:38:18.469Z	(!) /opt/buildhome/repo/kiko-web/src/services/tokenDataService.ts is dynamically imported by /opt/buildhome/repo/kiko-web/src/components/Chat/SwapCardChat.tsx, /opt/buildhome/repo/kiko-web/src/services/dexAggregatorService.ts but also statically imported by /opt/buildhome/repo/kiko-web/src/components/Chat/SwapCardChat.tsx, /opt/buildhome/repo/kiko-web/src/hooks/useSolanaSwap.ts, /opt/buildhome/repo/kiko-web/src/hooks/useSwap.ts, /opt/buildhome/repo/kiko-web/src/pages/WalletPage.tsx, dynamic import will not move module into another chunk.
2026-01-08T06:38:18.469Z	
2026-01-08T06:38:18.470Z	[plugin vite:reporter] 
2026-01-08T06:38:18.470Z	(!) /opt/buildhome/repo/kiko-web/node_modules/@solana/web3.js/lib/index.browser.esm.js is dynamically imported by /opt/buildhome/repo/kiko-web/src/hooks/useSolanaSwap.ts, /opt/buildhome/repo/kiko-web/src/hooks/useSolanaSwap.ts, /opt/buildhome/repo/kiko-web/src/pages/WalletPage.tsx, /opt/buildhome/repo/kiko-web/src/services/solanaSwapService.ts but also statically imported by /opt/buildhome/repo/kiko-web/node_modules/@raydium-io/raydium-sdk-v2/lib/index.mjs, /opt/buildhome/repo/kiko-web/node_modules/@solana/buffer-layout-utils/lib/esm/web3.mjs, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token-group/lib/esm/instruction.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token-group/lib/esm/state/tokenGroup.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token-group/lib/esm/state/tokenGroupMember.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token-metadata/lib/esm/instruction.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token-metadata/lib/esm/state.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/amountToUiAmount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/approve.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/approveChecked.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/burn.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/burnChecked.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/closeAccount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/createAccount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/createAssociatedTokenAccount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/createAssociatedTokenAccountIdempotent.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/createMint.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/createMultisig.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/createNativeMint.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/createWrappedNativeAccount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/freezeAccount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/getOrCreateAssociatedTokenAccount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/internal.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/mintTo.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/mintToChecked.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/recoverNested.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/revoke.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/setAuthority.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/syncNative.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/thawAccount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/transfer.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/transferChecked.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/actions/uiAmountToAmount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/constants.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/cpiGuard/actions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/cpiGuard/instructions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/defaultAccountState/actions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/defaultAccountState/instructions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/groupMemberPointer/instructions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/groupMemberPointer/state.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/groupPointer/instructions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/groupPointer/state.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/interestBearingMint/actions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/interestBearingMint/instructions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/memoTransfer/actions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/memoTransfer/instructions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/metadataPointer/instructions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/metadataPointer/state.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/pausable/actions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/pausable/instructions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/scaledUiAmount/actions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/scaledUiAmount/instructions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/tokenGroup/actions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/tokenGroup/state.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/tokenMetadata/actions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/transferFee/actions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/transferFee/instructions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/transferHook/actions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/transferHook/instructions.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/transferHook/pubkeyData.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/extensions/transferHook/state.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/amountToUiAmount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/approve.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/approveChecked.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/associatedTokenAccount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/burn.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/burnChecked.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/closeAccount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/createNativeMint.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/freezeAccount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/initializeAccount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/initializeAccount2.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/initializeAccount3.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/initializeImmutableOwner.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/initializeMint.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/initializeMint2.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/initializeMintCloseAuthority.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/initializeMultisig.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/initializeNonTransferableMint.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/initializePermanentDelegate.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/internal.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/mintTo.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/mintToChecked.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/reallocate.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/revoke.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/setAuthority.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/syncNative.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/thawAccount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/transfer.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/transferChecked.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/instructions/uiAmountToAmount.js, /opt/buildhome/repo/kiko-web/node_modules/@solana/spl-token/lib/esm/state/mint.js, /opt/buildhome/repo/kiko-web/src/services/raydiumApi.ts, /opt/buildhome/repo/kiko-web/src/services/solanaSwapService.ts, dynamic import will not move module into another chunk.
2026-01-08T06:38:18.470Z	
2026-01-08T06:38:18.470Z	[plugin vite:reporter] 
2026-01-08T06:38:18.470Z	(!) /opt/buildhome/repo/kiko-web/src/components/Chart/UnifiedChartCard.tsx is dynamically imported by /opt/buildhome/repo/kiko-web/src/components/Launchpad/LaunchpadCard.tsx but also statically imported by /opt/buildhome/repo/kiko-web/src/components/Chat/MessageBubble.tsx, dynamic import will not move module into another chunk.
2026-01-08T06:38:18.470Z	
2026-01-08T06:38:18.471Z	[plugin vite:reporter] 
2026-01-08T06:38:18.471Z	(!) /opt/buildhome/repo/kiko-web/src/services/api.ts is dynamically imported by /opt/buildhome/repo/kiko-web/src/components/Chart/GeckoTerminalChart.tsx but also statically imported by /opt/buildhome/repo/kiko-web/src/App.tsx, /opt/buildhome/repo/kiko-web/src/components/Chat/ChatInterface.tsx, /opt/buildhome/repo/kiko-web/src/components/Launchpad/LaunchpadCard.tsx, /opt/buildhome/repo/kiko-web/src/components/Wallet/MandatoryExportModal.tsx, /opt/buildhome/repo/kiko-web/src/hooks/useConversations.ts, /opt/buildhome/repo/kiko-web/src/pages/ChainsPage.tsx, /opt/buildhome/repo/kiko-web/src/pages/OverviewPage.tsx, /opt/buildhome/repo/kiko-web/src/pages/SocialPage.tsx, /opt/buildhome/repo/kiko-web/src/pages/SuperDefiPage.tsx, /opt/buildhome/repo/kiko-web/src/pages/TokensPage.tsx, /opt/buildhome/repo/kiko-web/src/services/favoriteService.ts, /opt/buildhome/repo/kiko-web/src/services/moderation.ts, dynamic import will not move module into another chunk.
2026-01-08T06:38:18.471Z	
2026-01-08T06:38:20.779Z	computing gzip size...
2026-01-08T06:38:22.093Z	dist/index.html                                                                 1.48 kB │ gzip:     0.79 kB
2026-01-08T06:38:22.094Z	dist/assets/Zorb-lJ8YrSLc.svg                                                   5.41 kB │ gzip:     1.46 kB
2026-01-08T06:38:22.094Z	dist/assets/gecko-terminal-BNsgmvda.png                                        11.10 kB
2026-01-08T06:38:22.095Z	dist/assets/dex-screener-BW5wa4q0.png                                          50.56 kB
2026-01-08T06:38:22.095Z	dist/assets/kiko-logo-B_c2OhNE.png                                             56.51 kB
2026-01-08T06:38:22.097Z	dist/assets/FourMeme-D5tnZ_4o.png                                              61.26 kB
2026-01-08T06:38:22.097Z	dist/assets/Paragraph-Ch7haqnY.png                                             63.87 kB
2026-01-08T06:38:22.097Z	dist/assets/ClankerOG-SVvGeL5y.png                                             86.40 kB
2026-01-08T06:38:22.097Z	dist/assets/PumpFun-_K8yUQsh.png                                              105.07 kB
2026-01-08T06:38:22.097Z	dist/assets/BonkFun-phxb5aFp.png                                              205.38 kB
2026-01-08T06:38:22.097Z	dist/assets/ArticleDetailPage-Bk2oVx8U.css                                      5.21 kB │ gzip:     1.59 kB
2026-01-08T06:38:22.097Z	dist/assets/index-DjZyUVH-.css                                                233.05 kB │ gzip:    40.60 kB
2026-01-08T06:38:22.105Z	dist/assets/analytics-mkkvFRju-DOXuftJB.js                                      0.06 kB │ gzip:     0.08 kB
2026-01-08T06:38:22.106Z	dist/assets/capitalizeFirstLetter-DmLYqXsO-tV1Idewc.js                          0.07 kB │ gzip:     0.09 kB
2026-01-08T06:38:22.107Z	dist/assets/shouldProceedtoEmbeddedWalletCreationFlow-BI33jNSF-D_mgO1kB.js      0.14 kB │ gzip:     0.13 kB
2026-01-08T06:38:22.109Z	dist/assets/getChainName-DjpPdUSc-c2urPd0g.js                                   0.15 kB │ gzip:     0.11 kB
2026-01-08T06:38:22.109Z	dist/assets/formatErc20TokenAmount-BuPk9xcy-CkAr4Oc0.js                         0.16 kB │ gzip:     0.16 kB
2026-01-08T06:38:22.109Z	dist/assets/getUsdcMintAddress-DFI1hv05-jlhpBW9a.js                             0.18 kB │ gzip:     0.18 kB
2026-01-08T06:38:22.109Z	dist/assets/circle-check-big-CE0H0AFF.js                                        0.20 kB │ gzip:     0.18 kB
2026-01-08T06:38:22.109Z	dist/assets/transfer-CMPmjPsM-Cjofo3yZ.js                                       0.21 kB │ gzip:     0.16 kB
2026-01-08T06:38:22.109Z	dist/assets/circle-x-Dvi949u8.js                                                0.21 kB │ gzip:     0.18 kB
2026-01-08T06:38:22.109Z	dist/assets/mail-Cp-fo5T6.js                                                    0.22 kB │ gzip:     0.20 kB
2026-01-08T06:38:22.110Z	dist/assets/LabelXs-BOisBtqT-DHinA2DL.js                                        0.24 kB │ gzip:     0.21 kB
2026-01-08T06:38:22.110Z	dist/assets/ErrorMessage-Cx8GKGhL-DFh9YicQ.js                                   0.25 kB │ gzip:     0.22 kB
2026-01-08T06:38:22.110Z	dist/assets/Title-D0pfZff--BISICSzq.js                                          0.25 kB │ gzip:     0.22 kB
2026-01-08T06:38:22.110Z	dist/assets/formatters-CJsTQFDb.js                                              0.30 kB │ gzip:     0.23 kB
2026-01-08T06:38:22.110Z	dist/assets/Subtitle-DkvfP2Ev-Bi-s8xfI.js                                       0.31 kB │ gzip:     0.25 kB
2026-01-08T06:38:22.110Z	dist/assets/InjectedWalletIcon-DLcYOGDj-nvbN0903.js                             0.33 kB │ gzip:     0.24 kB
2026-01-08T06:38:22.110Z	dist/assets/StackedContainer-BrIQsdas-B2mM3mMT.js                               0.38 kB │ gzip:     0.28 kB
2026-01-08T06:38:22.110Z	dist/assets/LoadingSkeleton-CHdaq3pb-BKslcGgL.js                                0.40 kB │ gzip:     0.24 kB
2026-01-08T06:38:22.110Z	dist/assets/useGetSolPrice-Cfm8o9C5-BSpMpmOf.js                                 0.43 kB │ gzip:     0.31 kB
2026-01-08T06:38:22.110Z	dist/assets/WalletOverflowButton-BT_VMZP5-Dm8D5APU.js                           0.43 kB │ gzip:     0.28 kB
2026-01-08T06:38:22.110Z	dist/assets/getErc20Balance-CaKjNAs9-Dv9T5FE6.js                                0.46 kB │ gzip:     0.32 kB
2026-01-08T06:38:22.110Z	dist/assets/ChevronDownIcon-kHT8jUfN.js                                         0.48 kB │ gzip:     0.35 kB
2026-01-08T06:38:22.110Z	dist/assets/WalletCards-DH1rqayz-11FAVjU0.js                                    0.49 kB │ gzip:     0.34 kB
2026-01-08T06:38:22.110Z	dist/assets/CheckCircleIcon-DocFcxUL.js                                         0.52 kB │ gzip:     0.38 kB
2026-01-08T06:38:22.113Z	dist/assets/telegram-B-JqnkqZ-BWZF4j4U.js                                       0.52 kB │ gzip:     0.36 kB
2026-01-08T06:38:22.113Z	dist/assets/shared-CtYf3O54-x98UGqVh.js                                         0.53 kB │ gzip:     0.35 kB
2026-01-08T06:38:22.117Z	dist/assets/ExclamationCircleIcon-CthtR5OM.js                                   0.53 kB │ gzip:     0.39 kB
2026-01-08T06:38:22.117Z	dist/assets/useWalletBalance-CkNw6kj0-CbgJcTwD.js                               0.54 kB │ gzip:     0.36 kB
2026-01-08T06:38:22.117Z	dist/assets/FundWalletMethodHeader-CS84Ots9-TSDAyVZD.js                         0.57 kB │ gzip:     0.34 kB
2026-01-08T06:38:22.117Z	dist/assets/transaction-CnfuREWo-nROljJQP.js                                    0.57 kB │ gzip:     0.38 kB
2026-01-08T06:38:22.117Z	dist/assets/fingerprint-pattern-DWdKtSd_.js                                     0.61 kB │ gzip:     0.36 kB
2026-01-08T06:38:22.118Z	dist/assets/LockClosedIcon-B4IFGxdD.js                                          0.63 kB │ gzip:     0.41 kB
2026-01-08T06:38:22.118Z	dist/assets/ExclamationTriangleIcon-ixOlARJg.js                                 0.63 kB │ gzip:     0.45 kB
2026-01-08T06:38:22.118Z	dist/assets/getErc20TokenInfo-BFoeg5F6-CnZ6Qd7M.js                              0.64 kB │ gzip:     0.35 kB
2026-01-08T06:38:22.118Z	dist/assets/CheckCircleIcon-DUp_S-aQ.js                                         0.65 kB │ gzip:     0.43 kB
2026-01-08T06:38:22.118Z	dist/assets/use-create-wallet-without-fallback-C0dI_RFZ-Bn-g55QM.js             0.67 kB │ gzip:     0.37 kB
2026-01-08T06:38:22.118Z	dist/assets/ShieldCheckIcon-BpL2q8Bu.js                                         0.67 kB │ gzip:     0.47 kB
2026-01-08T06:38:22.118Z	dist/assets/InAppBrowserLoginNotPossible-COUNBN1W-D284YYrw.js                   0.69 kB │ gzip:     0.46 kB
2026-01-08T06:38:22.118Z	dist/assets/ethers-Bl5aM5Gz-Dl6PlfDJ.js                                         0.69 kB │ gzip:     0.44 kB
2026-01-08T06:38:22.118Z	dist/assets/EnvelopeIcon-DQQpCob6.js                                            0.71 kB │ gzip:     0.43 kB
2026-01-08T06:38:22.118Z	dist/assets/WalletIcon-C4s9UiNv.js                                              0.72 kB │ gzip:     0.42 kB
2026-01-08T06:38:22.118Z	dist/assets/ArrowsRightLeftIcon-BEWyxjJG.js                                     0.74 kB │ gzip:     0.42 kB
2026-01-08T06:38:22.118Z	dist/assets/FingerPrintIcon-V35YcJn_.js                                         0.76 kB │ gzip:     0.51 kB
2026-01-08T06:38:22.118Z	dist/assets/ErrorBanner-BdiArMwu-CzeMIUgM.js                                    0.79 kB │ gzip:     0.46 kB
2026-01-08T06:38:22.118Z	dist/assets/WarningBanner-BDp-QC9i--JXba-yM.js                                  0.79 kB │ gzip:     0.47 kB
2026-01-08T06:38:22.118Z	dist/assets/PhoneIcon-BgJCmUWE.js                                               0.81 kB │ gzip:     0.53 kB
2026-01-08T06:38:22.118Z	dist/assets/ScreenLayout-CNho46nP-DiAhXIcK.js                                   0.82 kB │ gzip:     0.43 kB
2026-01-08T06:38:22.118Z	dist/assets/LoginFailedScreen-CZnzwKpB-CgIITY7s.js                              0.88 kB │ gzip:     0.55 kB
2026-01-08T06:38:22.118Z	dist/assets/ScreenHeader-Biz1wq02-DY483eoy.js                                   0.92 kB │ gzip:     0.48 kB
2026-01-08T06:38:22.118Z	dist/assets/Value-B4M62ove-DUMlqcGm.js                                          0.92 kB │ gzip:     0.44 kB
2026-01-08T06:38:22.118Z	dist/assets/AccountNotFoundScreen-BzbvtCmu-BoZS_zon.js                          0.93 kB │ gzip:     0.60 kB
2026-01-08T06:38:22.118Z	dist/assets/GlobeAltIcon-iPv-Hhcr.js                                            0.93 kB │ gzip:     0.56 kB
2026-01-08T06:38:22.125Z	dist/assets/OpenLink-BpeNYBKs-ZmhM6KK4.js                                       0.95 kB │ gzip:     0.56 kB
2026-01-08T06:38:22.125Z	dist/assets/LinkEmailScreen-D7VTyZrH-Bc0sHAAx.js                                0.97 kB │ gzip:     0.58 kB
2026-01-08T06:38:22.126Z	dist/assets/Chip-Bsgj4Yc--D2mE-xwP.js                                           0.98 kB │ gzip:     0.53 kB
2026-01-08T06:38:22.126Z	dist/assets/AllowlistRejectionScreen-DhhfJ6ai-D7t_gY2T.js                       1.02 kB │ gzip:     0.57 kB
2026-01-08T06:38:22.126Z	dist/assets/useGetTokenPrice-CDPxMEO--C_JwVmMJ.js                               1.02 kB │ gzip:     0.54 kB
2026-01-08T06:38:22.126Z	dist/assets/EmbeddedWalletPasswordUpdateSplashScreen-BPTp0nwT-CQB5-0t7.js       1.07 kB │ gzip:     0.65 kB
2026-01-08T06:38:22.126Z	dist/assets/JsonTree-Bvd2C29R-D4M3Bbbf.js                                       1.07 kB │ gzip:     0.59 kB
2026-01-08T06:38:22.126Z	dist/assets/EmbeddedWalletCreatedScreen-B7TnCst_--JWKZm-i.js                    1.19 kB │ gzip:     0.73 kB
2026-01-08T06:38:22.126Z	dist/assets/dijkstra-COg3n3zL.js                                                1.19 kB │ gzip:     0.60 kB
2026-01-08T06:38:22.126Z	dist/assets/UserLimitReachedScreen-CTmSitf0-Bzsu3a_p.js                         1.22 kB │ gzip:     0.74 kB
2026-01-08T06:38:22.126Z	dist/assets/InfoBanner-D6C6Bt8L-BjOUCMrQ.js                                     1.29 kB │ gzip:     0.75 kB
2026-01-08T06:38:22.126Z	dist/assets/ConnectOrCreateScreen-BOO4iaC6-Bn6mvSdZ.js                          1.31 kB │ gzip:     0.76 kB
2026-01-08T06:38:22.126Z	dist/assets/LandingScreen-Dp4m_c2X-C-zqeQDT.js                                  1.35 kB │ gzip:     0.78 kB
2026-01-08T06:38:22.126Z	dist/assets/getFormattedUsdFromLamports-B6EqSEho-C-HCdwKa.js                    1.42 kB │ gzip:     0.73 kB
2026-01-08T06:38:22.126Z	dist/assets/Address-BUmpXgsy-C1BAAjzl.js                                        1.43 kB │ gzip:     0.71 kB
2026-01-08T06:38:22.126Z	dist/assets/TodoList-Dn0Qu-vv-DvVr2FuA.js                                       1.43 kB │ gzip:     0.64 kB
2026-01-08T06:38:22.126Z	dist/assets/LinkPhoneScreen-DdRe154C-D4p0KuSh.js                                1.44 kB │ gzip:     0.84 kB
2026-01-08T06:38:22.126Z	dist/assets/farcaster-DPlSjvF5-VX9iaiqz.js                                      1.46 kB │ gzip:     0.69 kB
2026-01-08T06:38:22.126Z	dist/assets/CopyToClipboard-DatKc59_-DzJluFyi.js                                1.46 kB │ gzip:     0.80 kB
2026-01-08T06:38:22.126Z	dist/assets/UpdatePhoneScreen-DZ_resri-Bve5h1FP.js                              1.55 kB │ gzip:     0.90 kB
2026-01-08T06:38:22.126Z	dist/assets/InstallWalletScreen-BjprJkty-DD0R6JNf.js                            1.55 kB │ gzip:     0.84 kB
2026-01-08T06:38:22.126Z	dist/assets/Link-DwjLfHwW-Cv_CpQ48.js                                           1.58 kB │ gzip:     0.63 kB
2026-01-08T06:38:22.126Z	dist/assets/DelegatedActionsRevokeScreen-D0mAKxDs-v9JTP-1A.js                   1.63 kB │ gzip:     0.96 kB
2026-01-08T06:38:22.128Z	dist/assets/copy-Bx2Jwc5_-CN-XrKSe.js                                           1.63 kB │ gzip:     0.67 kB
2026-01-08T06:38:22.129Z	dist/assets/WalletInterstitialScreen-tDCVxTFi-kb5bTlJq.js                       1.64 kB │ gzip:     0.92 kB
2026-01-08T06:38:22.129Z	dist/assets/PasskeySelectSignupOrLogin-DgH-G2yO-rDzZpA2A.js                     1.65 kB │ gzip:     0.72 kB
2026-01-08T06:38:22.129Z	dist/assets/index-CJMgUOnw-wKnNUMfQ.js                                          1.66 kB │ gzip:     0.66 kB
2026-01-08T06:38:22.129Z	dist/assets/index-D9w4UYos-BlDkEGX9.js                                          1.71 kB │ gzip:     0.83 kB
2026-01-08T06:38:22.129Z	dist/assets/FundingEditAmountScreen-CzbuYpdw-Bg9BmzrH.js                        1.76 kB │ gzip:     0.98 kB
2026-01-08T06:38:22.129Z	dist/assets/styles-DY17fuAX-OUt0tlrN.js                                         1.77 kB │ gzip:     0.63 kB
2026-01-08T06:38:22.129Z	dist/assets/useI18n-99pFPsz3-DtlsRvnw.js                                        1.78 kB │ gzip:     0.77 kB
2026-01-08T06:38:22.130Z	dist/assets/ConnectOnlyLandingScreen-ZnI9ReZJ-Tn7ymC_A.js                       1.82 kB │ gzip:     0.91 kB
2026-01-08T06:38:22.130Z	dist/assets/AuthenticateWithWalletScreen-BN0s1mtv-TBIHSZtZ.js                   1.86 kB │ gzip:     0.97 kB
2026-01-08T06:38:22.130Z	dist/assets/WalletLink-Cj92ni3W-lINFX_5i.js                                     1.87 kB │ gzip:     0.87 kB
2026-01-08T06:38:22.130Z	dist/assets/PhCaretLeft-B7YLoNEF.js                                             1.88 kB │ gzip:     0.92 kB
2026-01-08T06:38:22.130Z	dist/assets/WalletInfoCard-COAfUoX0-BDfoH_mq.js                                 1.94 kB │ gzip:     0.95 kB
2026-01-08T06:38:22.137Z	dist/assets/PhCaretDown-ddSjwcwm.js                                             1.94 kB │ gzip:     0.96 kB
2026-01-08T06:38:22.137Z	dist/assets/PhCaretRight-BY8D5MIg.js                                            1.96 kB │ gzip:     0.94 kB
2026-01-08T06:38:22.137Z	dist/assets/Layouts-Bmf8DxNP-Bl4Ias55.js                                        2.00 kB │ gzip:     0.65 kB
2026-01-08T06:38:22.138Z	dist/assets/reservoir-kvLjIrEo-CtNUabok.js                                      2.00 kB │ gzip:     1.04 kB
2026-01-08T06:38:22.138Z	dist/assets/DelegatedActionsConsentScreen-B0AwZEKc-BOi8tyMR.js                  2.01 kB │ gzip:     1.18 kB
2026-01-08T06:38:22.138Z	dist/assets/PhCaretUp-BG10nSut.js                                               2.02 kB │ gzip:     0.94 kB
2026-01-08T06:38:22.138Z	dist/assets/PhArrowUpRight-Bn-JhHsY.js                                          2.06 kB │ gzip:     1.02 kB
2026-01-08T06:38:22.138Z	dist/assets/PhArrowDown-CkoOD89h.js                                             2.10 kB │ gzip:     1.01 kB
2026-01-08T06:38:22.138Z	dist/assets/PhArrowRight-BI-V03Xf.js                                            2.11 kB │ gzip:     1.01 kB
2026-01-08T06:38:22.138Z	dist/assets/PhPlus-CBvZvLax.js                                                  2.11 kB │ gzip:     0.97 kB
2026-01-08T06:38:22.138Z	dist/assets/PhCheck-DrKd7pBC.js                                                 2.11 kB │ gzip:     0.99 kB
2026-01-08T06:38:22.138Z	dist/assets/PhArrowLeft-C0jlxVhM.js                                             2.12 kB │ gzip:     1.01 kB
2026-01-08T06:38:22.138Z	dist/assets/PhArrowUp-izKvURUW.js                                               2.17 kB │ gzip:     1.01 kB
2026-01-08T06:38:22.138Z	dist/assets/PhMagnifyingGlass-B6D0sWFL.js                                       2.21 kB │ gzip:     1.08 kB
2026-01-08T06:38:22.138Z	dist/assets/PhBrowser-BjzAmrHO.js                                               2.22 kB │ gzip:     0.97 kB
2026-01-08T06:38:22.138Z	dist/assets/Checkbox-NmGCZeKL-CKpiYDaO.js                                       2.22 kB │ gzip:     1.17 kB
2026-01-08T06:38:22.141Z	dist/assets/PhDotsThree-CSAEcba1.js                                             2.25 kB │ gzip:     0.95 kB
2026-01-08T06:38:22.141Z	dist/assets/MfaVerifyFlowScreen-BEt8Gfpb-DN-6_wJP.js                            2.27 kB │ gzip:     1.21 kB
2026-01-08T06:38:22.141Z	dist/assets/ConnectLedgerScreen-BEhSz1FM-9diCgQCw.js                            2.31 kB │ gzip:     1.15 kB
2026-01-08T06:38:22.141Z	dist/assets/ConnectEmailForm-DtLW0rv7-DG8YvqBw.js                               2.33 kB │ gzip:     1.32 kB
2026-01-08T06:38:22.142Z	dist/assets/AffirmativeConsentScreen-CrZKQjas-_Hdh6MI4.js                       2.34 kB │ gzip:     1.26 kB
2026-01-08T06:38:22.142Z	dist/assets/PhFunnelSimple-DKx35ITq.js                                          2.36 kB │ gzip:     1.00 kB
2026-01-08T06:38:22.142Z	dist/assets/PhCopy-rgttky8E.js                                                  2.36 kB │ gzip:     1.01 kB
2026-01-08T06:38:22.142Z	dist/assets/PhClock-Sj17weCB.js                                                 2.37 kB │ gzip:     1.03 kB
2026-01-08T06:38:22.142Z	dist/assets/PhWarningCircle-Cm58gXb9.js                                         2.43 kB │ gzip:     1.05 kB
2026-01-08T06:38:22.142Z	dist/assets/parseSignature-CByzfHHM.js                                          2.44 kB │ gzip:     1.10 kB
2026-01-08T06:38:22.142Z	dist/assets/RecoveryPasswordCreateScreen-jWT25C0X-CjYiLEeJ.js                   2.47 kB │ gzip:     1.27 kB
2026-01-08T06:38:22.145Z	dist/assets/PhX-C3b4cCEy.js                                                     2.50 kB │ gzip:     1.06 kB
2026-01-08T06:38:22.145Z	dist/assets/UpdateEmailScreen-BVzkFXeI-Bp7Iahkh.js                              2.53 kB │ gzip:     1.33 kB
2026-01-08T06:38:22.145Z	dist/assets/EmailInputForm-B4hjCxRU-CHNccIJG.js                                 2.53 kB │ gzip:     0.90 kB
2026-01-08T06:38:22.145Z	dist/assets/EmbeddedWalletOnAccountCreateScreen-vxaCVWy1-DFnkwtZy.js            2.54 kB │ gzip:     1.28 kB
2026-01-08T06:38:22.145Z	dist/assets/CaptchaScreen-CTRyyYc9-BHlh4FC6.js                                  2.56 kB │ gzip:     1.29 kB
2026-01-08T06:38:22.146Z	dist/assets/PhDeviceMobile-CnybhXY-.js                                          2.57 kB │ gzip:     1.07 kB
2026-01-08T06:38:22.146Z	dist/assets/PhArrowClockwise-mOiWYLMV.js                                        2.59 kB │ gzip:     1.19 kB
2026-01-08T06:38:22.146Z	dist/assets/MfaAuthVerifyFlowScreen-B3Hw1YN--DzAngkTi.js                        2.62 kB │ gzip:     1.39 kB
2026-01-08T06:38:22.146Z	dist/assets/ccip-Cmp4rWyS.js                                                    2.62 kB │ gzip:     1.25 kB
2026-01-08T06:38:22.146Z	dist/assets/SetAutomaticRecoveryScreen-CUheSZ7h-BqaUje6Q.js                     2.68 kB │ gzip:     1.32 kB
2026-01-08T06:38:22.146Z	dist/assets/PhUser-A2fxqIV0.js                                                  2.68 kB │ gzip:     1.26 kB
2026-01-08T06:38:22.146Z	dist/assets/PhEnvelope-SmaNeXoQ.js                                              2.68 kB │ gzip:     1.18 kB
2026-01-08T06:38:22.146Z	dist/assets/PhCircleHalf-Bk9C4DvT.js                                            2.71 kB │ gzip:     1.21 kB
2026-01-08T06:38:22.147Z	dist/assets/styles-BxA7nKxI-FWcB6YQu.js                                         2.73 kB │ gzip:     1.32 kB
2026-01-08T06:38:22.150Z	dist/assets/PhSignOut-Cq2PivQ6.js                                               2.77 kB │ gzip:     1.16 kB
2026-01-08T06:38:22.150Z	dist/assets/PhInfo-X33f06Ej.js                                                  2.78 kB │ gzip:     1.22 kB
2026-01-08T06:38:22.152Z	dist/assets/PhPower-D8-AcNM6.js                                                 2.78 kB │ gzip:     1.28 kB
2026-01-08T06:38:22.152Z	dist/assets/PhDesktop-BuCDXYJj.js                                               2.79 kB │ gzip:     1.12 kB
2026-01-08T06:38:22.152Z	dist/assets/PhArrowsLeftRight-CYsRQ2qh.js                                       2.80 kB │ gzip:     1.18 kB
2026-01-08T06:38:22.152Z	dist/assets/PhArrowCircleDown-BtlNV0TZ.js                                       2.81 kB │ gzip:     1.18 kB
2026-01-08T06:38:22.152Z	dist/assets/PhQuestionMark-W55Txvvb.js                                          2.84 kB │ gzip:     1.30 kB
2026-01-08T06:38:22.152Z	dist/assets/EmbeddedWalletConnectingScreen-9ADobSle-pe814zoo.js                 2.85 kB │ gzip:     1.37 kB
2026-01-08T06:38:22.153Z	dist/assets/PhArrowSquareOut-DnQ7n_B4.js                                        2.93 kB │ gzip:     1.25 kB
2026-01-08T06:38:22.153Z	dist/assets/PhArrowsDownUp-PZosTqZG.js                                          2.93 kB │ gzip:     1.18 kB
2026-01-08T06:38:22.153Z	dist/assets/PhCreditCard-CZpdid2n.js                                            2.93 kB │ gzip:     1.16 kB
2026-01-08T06:38:22.153Z	dist/assets/PhBank-hhPAIPVb.js                                                  2.94 kB │ gzip:     1.25 kB
2026-01-08T06:38:22.153Z	dist/assets/PhVault-B8m1usHw.js                                                 2.97 kB │ gzip:     1.20 kB
2026-01-08T06:38:22.153Z	dist/assets/CrossAppAuthScreen-Bno8NQSa-zMwqQdC4.js                             2.98 kB │ gzip:     1.53 kB
2026-01-08T06:38:22.153Z	dist/assets/PhCompass-Df1ugFO-.js                                               2.98 kB │ gzip:     1.28 kB
2026-01-08T06:38:22.153Z	dist/assets/PasskeyStatusScreen-BOac_MoC-DLW-4h4A.js                            3.00 kB │ gzip:     1.50 kB
2026-01-08T06:38:22.153Z	dist/assets/ConnectOnlyStatusScreen-1oCuFsd6-CcBJ-8Ed.js                        3.07 kB │ gzip:     1.56 kB
2026-01-08T06:38:22.153Z	dist/assets/PhPaperPlaneRight-Dvo-nXr9.js                                       3.10 kB │ gzip:     1.42 kB
2026-01-08T06:38:22.153Z	dist/assets/PhTrash-BamrmMsN.js                                                 3.12 kB │ gzip:     1.19 kB
2026-01-08T06:38:22.153Z	dist/assets/EmbeddedWalletPasswordUpdateScreen-C4dNnXVI-KmMo4BBS.js             3.12 kB │ gzip:     1.29 kB
2026-01-08T06:38:22.162Z	dist/assets/PasswordRecoveryScreen-CT1bj8Gb-DT0mAXqd.js                         3.18 kB │ gzip:     1.62 kB
2026-01-08T06:38:22.162Z	dist/assets/PhCurrencyDollar-B6IKKjue.js                                        3.24 kB │ gzip:     1.33 kB
2026-01-08T06:38:22.162Z	dist/assets/PhQuestion-rUoqC2sC.js                                              3.32 kB │ gzip:     1.45 kB
2026-01-08T06:38:22.162Z	dist/assets/TelegramAuthScreen-xobB3RHK-DMSg2Rjt.js                             3.38 kB │ gzip:     1.67 kB
2026-01-08T06:38:22.162Z	dist/assets/PhImage-BYrKfN9k.js                                                 3.44 kB │ gzip:     1.45 kB
2026-01-08T06:38:22.162Z	dist/assets/CoinbaseOnrampStatusScreen-BNmvm8Bl-HX3xgwwP.js                     3.76 kB │ gzip:     1.71 kB
2026-01-08T06:38:22.162Z	dist/assets/PhArrowsClockwise-Brtx2Re-.js                                       3.87 kB │ gzip:     1.59 kB
2026-01-08T06:38:22.162Z	dist/assets/RecoverySelectionScreen-_u02vomS-46Lt22xH.js                        3.88 kB │ gzip:     1.94 kB
2026-01-08T06:38:22.169Z	dist/assets/PhWarning-CpkID9oi.js                                               3.91 kB │ gzip:     1.49 kB
2026-01-08T06:38:22.169Z	dist/assets/SignRequestScreen-BNC2mYtk-BcgMP17r.js                              3.91 kB │ gzip:     1.99 kB
2026-01-08T06:38:22.169Z	dist/assets/ErrorScreen-Yi-Rhs0v-DBXefg7i.js                                    3.96 kB │ gzip:     1.68 kB
2026-01-08T06:38:22.169Z	dist/assets/FarcasterSignerStatusScreen-CsSFmDry-B6JpR0fE.js                    4.10 kB │ gzip:     1.76 kB
2026-01-08T06:38:22.169Z	dist/assets/PhIdentificationCard-BeLXJpfZ.js                                    4.22 kB │ gzip:     1.65 kB
2026-01-08T06:38:22.170Z	dist/assets/PhSpinner-CZMtAFdX.js                                               4.45 kB │ gzip:     1.65 kB
2026-01-08T06:38:22.170Z	dist/assets/MoonpayStatusScreen-lYMS5etL-B1mHOXt3.js                            4.66 kB │ gzip:     2.31 kB
2026-01-08T06:38:22.170Z	dist/assets/ManualTransferScreen-Bn2qhDAI-C2Qg6vGU.js                           4.78 kB │ gzip:     2.28 kB
2026-01-08T06:38:22.170Z	dist/assets/PhLightbulb-DMZJsowR.js                                             4.92 kB │ gzip:     1.86 kB
2026-01-08T06:38:22.170Z	dist/assets/PhQrCode-uIXlI5ER.js                                                4.92 kB │ gzip:     1.47 kB
2026-01-08T06:38:22.170Z	dist/assets/MfaAuthEnrollmentFlowScreen-CWMULcQb-Cnln3miy.js                    4.93 kB │ gzip:     2.13 kB
2026-01-08T06:38:22.170Z	dist/assets/EmbeddedWalletKeyExportScreen-Cmp2CUOa-CUcfRqzM.js                  5.14 kB │ gzip:     2.17 kB
2026-01-08T06:38:22.170Z	dist/assets/PhPuzzlePiece-C-7mYqGO.js                                           5.37 kB │ gzip:     1.96 kB
2026-01-08T06:38:22.170Z	dist/assets/OAuthStatusScreen-DEtT_t2P-CaOf6NWO.js                              5.38 kB │ gzip:     2.56 kB
2026-01-08T06:38:22.170Z	dist/assets/AwaitingSolToEvmBridgingScreen-dC9b-wlg-DeI2IwCX.js                 5.48 kB │ gzip:     2.52 kB
2026-01-08T06:38:22.170Z	dist/assets/to-ui-error-CYFXznYy-CluKZT4w.js                                    5.62 kB │ gzip:     2.38 kB
2026-01-08T06:38:22.170Z	dist/assets/PhGlobe-q1mqj65V.js                                                 5.72 kB │ gzip:     1.92 kB
2026-01-08T06:38:22.170Z	dist/assets/LinkPasskeyScreen-B5LWH116-D6ki8JNS.js                              5.73 kB │ gzip:     2.35 kB
2026-01-08T06:38:22.170Z	dist/assets/features-BE-Sd5PF.js                                                5.84 kB │ gzip:     2.30 kB
2026-01-08T06:38:22.170Z	dist/assets/TransactionDetails-BdW2lq_B-C3YnvB2l.js                             5.91 kB │ gzip:     1.90 kB
2026-01-08T06:38:22.170Z	dist/assets/shared-D8TfUpfU-DI7g_Bc_.js                                         6.14 kB │ gzip:     1.97 kB
2026-01-08T06:38:22.170Z	dist/assets/TurnstileWrapper-Co-t5mTh-v3k6E8W1.js                               6.77 kB │ gzip:     2.65 kB
2026-01-08T06:38:22.170Z	dist/assets/Screen-_0H_rCdH-B4dLCbFf.js                                         6.96 kB │ gzip:     2.19 kB
2026-01-08T06:38:22.170Z	dist/assets/Button-BCV6mjvS-Cp4X5A65.js                                         7.61 kB │ gzip:     1.61 kB
2026-01-08T06:38:22.170Z	dist/assets/FarcasterConnectStatusScreen-BfoDjDwg-BiYO-5wJ.js                   7.76 kB │ gzip:     3.23 kB
2026-01-08T06:38:22.170Z	dist/assets/AwaitingEvmToSolBridgingScreen-C7mp2-Hy-DVTYoGuF.js                 8.01 kB │ gzip:     3.47 kB
2026-01-08T06:38:22.181Z	dist/assets/RecoveryOAuthStatusScreen-Ce6qiP-3-B7AVDHUa.js                      8.06 kB │ gzip:     3.07 kB
2026-01-08T06:38:22.181Z	dist/assets/LinkConflictScreen-DMHPhlV7-78uAKsM6.js                             8.31 kB │ gzip:     3.09 kB
2026-01-08T06:38:22.181Z	dist/assets/AwaitingPasswordlessCodeScreen-NAVmxM9--DP7oadrz.js                 8.71 kB │ gzip:     3.72 kB
2026-01-08T06:38:22.181Z	dist/assets/ConnectionStatusScreen-CZNBQeOQ-B8yqzll6.js                         8.95 kB │ gzip:     3.82 kB
2026-01-08T06:38:22.181Z	dist/assets/index-D9std1Z8.js                                                   8.99 kB │ gzip:     2.95 kB
2026-01-08T06:38:22.182Z	dist/assets/index-u2Wj-c3t.js                                                   9.56 kB │ gzip:     3.60 kB
2026-01-08T06:38:22.182Z	dist/assets/TransferFromWalletScreen-CLqyv8Ra-CQx11vWM.js                       9.92 kB │ gzip:     3.37 kB
2026-01-08T06:38:22.182Z	dist/assets/AwaitingExternalEthereumTransferScreen-EqM4Kcsu-BKaFyHMg.js        10.09 kB │ gzip:     4.04 kB
2026-01-08T06:38:22.182Z	dist/assets/PinInput-C3_MNxMt-ChzUy-5z.js                                      10.28 kB │ gzip:     3.73 kB
2026-01-08T06:38:22.182Z	dist/assets/MfaEnrollmentFlowScreen-DcnqGJ3O-CcAtWZPO.js                       10.29 kB │ gzip:     3.74 kB
2026-01-08T06:38:22.182Z	dist/assets/FundSolWalletWithExternalSolanaWallet-BIk-6GIl-Cr3XirTq.js         10.39 kB │ gzip:     3.95 kB
2026-01-08T06:38:22.182Z	dist/assets/PhSealCheck-BeVLq9PH.js                                            12.10 kB │ gzip:     4.02 kB
2026-01-08T06:38:22.182Z	dist/assets/ModalHeader-BTru6YQw-Cds1eCHA.js                                   12.62 kB │ gzip:     5.39 kB
2026-01-08T06:38:22.182Z	dist/assets/FundingMethodSelectionScreen-DdZxdcVe-DnSWRNi_.js                  12.84 kB │ gzip:     5.31 kB
2026-01-08T06:38:22.182Z	dist/assets/TransferOrBridgeLoadingScreen-BY7Eot6x-rqWJ1DOW.js                 13.03 kB │ gzip:     5.08 kB
2026-01-08T06:38:22.182Z	dist/assets/property-CnFDNXw5.js                                               17.20 kB │ gzip:     6.41 kB
2026-01-08T06:38:22.182Z	dist/assets/HCaptchaWrapper-Dl2Jt_Df-CFYai0kR.js                               19.58 kB │ gzip:     7.21 kB
2026-01-08T06:38:22.182Z	dist/assets/StandardSignAndSendTransactionScreen-Ckxfv32q-CTmpkeDs.js          19.79 kB │ gzip:     6.68 kB
2026-01-08T06:38:22.182Z	dist/assets/CustomLandingScreenView-B_ZwsVad-CKVU-URj.js                       20.56 kB │ gzip:     7.29 kB
2026-01-08T06:38:22.182Z	dist/assets/index-DNmMGazz-C8cx9V_6.js                                         21.22 kB │ gzip:     6.33 kB
2026-01-08T06:38:22.182Z	dist/assets/ArticleDetailPage-C6S6hAia.js                                      22.88 kB │ gzip:     7.03 kB
2026-01-08T06:38:22.182Z	dist/assets/EnrollTotp-CMtBCJbR-DlefhFgg.js                                    23.66 kB │ gzip:     9.86 kB
2026-01-08T06:38:22.182Z	dist/assets/TransactionErrorView-RLIeHdul-D7kLdlXQ.js                          24.34 kB │ gzip:     6.74 kB
2026-01-08T06:38:22.182Z	dist/assets/twitch-5IOe4sIQ-BlSAFow5.js                                        26.25 kB │ gzip:    14.19 kB
2026-01-08T06:38:22.182Z	dist/assets/QrCode-Oxn5GT3C-BpZPsGZy.js                                        27.03 kB │ gzip:    10.68 kB
2026-01-08T06:38:22.182Z	dist/assets/secp256k1-3s06_Mtc.js                                              28.93 kB │ gzip:    11.29 kB
2026-01-08T06:38:22.183Z	dist/assets/ConnectWalletView-Cmm9Ulis-D3rdukju.js                             38.21 kB │ gzip:    12.37 kB
2026-01-08T06:38:22.201Z	dist/assets/BridgeNetworkSelectionView-BXBCujiq-gYFd2qyS.js                    68.60 kB │ gzip:    25.20 kB
2026-01-08T06:38:22.201Z	dist/assets/index-GWZKi1sD.js                                                  79.39 kB │ gzip:    22.23 kB
2026-01-08T06:38:22.201Z	dist/assets/w3m-modal-BEzXK_wP.js                                              79.64 kB │ gzip:    17.48 kB
2026-01-08T06:38:22.201Z	dist/assets/SetWalletPasswordForm-vaG_68V0-ZvAaOj8h.js                         91.04 kB │ gzip:    31.36 kB
2026-01-08T06:38:22.202Z	dist/assets/basic-DZI8xHQ0.js                                                 120.75 kB │ gzip:    30.94 kB
2026-01-08T06:38:22.202Z	dist/assets/ConnectPhoneForm-OQSgPQxP-CZm5eCZc.js                             162.62 kB │ gzip:    39.20 kB
2026-01-08T06:38:22.202Z	dist/assets/index-aW_aSMBf.js                                                 286.48 kB │ gzip:   108.96 kB
2026-01-08T06:38:22.202Z	dist/assets/core-_12TvQ0T.js                                                  558.79 kB │ gzip:   161.05 kB
2026-01-08T06:38:22.202Z	dist/assets/index-scbgdz1v.js                                               5,174.68 kB │ gzip: 1,423.70 kB
2026-01-08T06:38:22.202Z	
2026-01-08T06:38:22.202Z	(!) Some chunks are larger than 500 kB after minification. Consider:
2026-01-08T06:38:22.202Z	- Using dynamic import() to code-split the application
2026-01-08T06:38:22.202Z	- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
2026-01-08T06:38:22.203Z	- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
2026-01-08T06:38:22.213Z	✓ built in 52.55s
2026-01-08T06:38:23.629Z	Success: Build command completed
2026-01-08T06:38:23.739Z	Executing user deploy command: npx wrangler pages deploy dist
2026-01-08T06:38:25.771Z	npm warn exec The following package was not found and will be installed: wrangler@4.57.0
2026-01-08T06:38:34.599Z	
2026-01-08T06:38:34.600Z	 ⛅️ wrangler 4.57.0
2026-01-08T06:38:34.600Z	───────────────────
2026-01-08T06:38:34.613Z	
2026-01-08T06:38:34.846Z	✘ [ERROR] Must specify a project name.
2026-01-08T06:38:34.846Z	
2026-01-08T06:38:34.847Z	
2026-01-08T06:38:34.880Z	🪵  Logs were written to "/opt/buildhome/.config/.wrangler/logs/wrangler-2026-01-08_06-38-34_089.log"
2026-01-08T06:38:35.043Z	Failed: error occurred while running deploy command