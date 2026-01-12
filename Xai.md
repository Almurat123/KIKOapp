12:34:23 [vite] (client) Pre-transform error: /Users/almurat/KiKo/kiko-web/src/pages/TokensPage.tsx: Missing catch or finally clause. (500:6)

  498 |       let freshTokenId = 1;
  499 |
> 500 |       try {
      |       ^
  501 |         try {
  502 |           const promises = FETCH_CHAINS.map(async (chain) => {
  503 |             if (!mountedRef.current) return [];
  Plugin: vite:react-babel
  File: /Users/almurat/KiKo/kiko-web/src/pages/TokensPage.tsx:500:6
  498 |        let freshTokenId = 1;
  499 |  
  500 |        try {
      |        ^
  501 |          try {
  502 |            const promises = FETCH_CHAINS.map(async (chain) => {
12:34:23 [vite] Internal server error: /Users/almurat/KiKo/kiko-web/src/pages/TokensPage.tsx: Missing catch or finally clause. (500:6)

  498 |       let freshTokenId = 1;
  499 |
> 500 |       try {
      |       ^
  501 |         try {
  502 |           const promises = FETCH_CHAINS.map(async (chain) => {
  503 |             if (!mountedRef.current) return [];
  Plugin: vite:react-babel
  File: /Users/almurat/KiKo/kiko-web/src/pages/TokensPage.tsx:500:6
  498 |        let freshTokenId = 1;
  499 |  
  500 |        try {
      |        ^
  501 |          try {
  502 |            const promises = FETCH_CHAINS.map(async (chain) => {
      at constructor (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:367:19)
      at TypeScriptParserMixin.raise (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:6624:19)
      at TypeScriptParserMixin.parseTryStatement (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:13300:12)
      at TypeScriptParserMixin.parseStatementContent (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:12880:21)
      at TypeScriptParserMixin.parseStatementContent (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:9569:18)
      at TypeScriptParserMixin.parseStatementLike (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:12843:17)
      at TypeScriptParserMixin.parseStatementListItem (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:12823:17)
      at TypeScriptParserMixin.parseBlockOrModuleBlockBody (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:13392:61)
      at TypeScriptParserMixin.parseBlockBody (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:13385:10)
      at TypeScriptParserMixin.parseBlock (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:13373:10)
      at TypeScriptParserMixin.parseFunctionBody (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:12174:24)
      at TypeScriptParserMixin.parseArrowExpression (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:12149:10)
      at TypeScriptParserMixin.parseAsyncArrowFromCallExpression (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:11328:10)
      at TypeScriptParserMixin.parseAsyncArrowFromCallExpression (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:9819:18)
      at TypeScriptParserMixin.parseCoverCallAndAsyncArrowHead (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:11258:27)
      at TypeScriptParserMixin.parseSubscript (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:11184:19)
      at TypeScriptParserMixin.parseSubscript (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:9329:18)
      at TypeScriptParserMixin.parseSubscripts (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:11158:19)
      at TypeScriptParserMixin.parseExprSubscripts (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:11149:17)
      at TypeScriptParserMixin.parseUpdate (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:11130:21)
      at TypeScriptParserMixin.parseMaybeUnary (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:11110:23)
      at TypeScriptParserMixin.parseMaybeUnary (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:9890:18)
      at TypeScriptParserMixin.parseMaybeUnaryOrPrivate (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:10963:61)
      at TypeScriptParserMixin.parseExprOps (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:10968:23)
      at TypeScriptParserMixin.parseMaybeConditional (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:10945:23)
      at TypeScriptParserMixin.parseMaybeAssign (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:10895:21)
      at TypeScriptParserMixin.parseMaybeAssign (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:9839:20)
      at /Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:10864:39
      at TypeScriptParserMixin.allowInAnd (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:12495:16)
      at TypeScriptParserMixin.parseMaybeAssignAllowIn (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:10864:17)
      at TypeScriptParserMixin.parseVar (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:13460:91)
      at TypeScriptParserMixin.parseVarStatement (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:13306:10)
      at TypeScriptParserMixin.parseVarStatement (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:9469:31)
      at TypeScriptParserMixin.parseStatementContent (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:12927:23)
      at TypeScriptParserMixin.parseStatementContent (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:9569:18)
      at TypeScriptParserMixin.parseStatementLike (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:12843:17)
      at TypeScriptParserMixin.parseStatementListItem (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:12823:17)
      at TypeScriptParserMixin.parseBlockOrModuleBlockBody (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:13392:61)
      at TypeScriptParserMixin.parseBlockBody (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:13385:10)
      at TypeScriptParserMixin.parseBlock (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:13373:10)
      at TypeScriptParserMixin.parseFunctionBody (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:12174:24)
      at TypeScriptParserMixin.parseArrowExpression (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:12149:10)
      at TypeScriptParserMixin.parseParenAndDistinguishExpression (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:11759:12)
      at TypeScriptParserMixin.parseExprAtom (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:11395:23)
      at TypeScriptParserMixin.parseExprAtom (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:4793:20)
      at TypeScriptParserMixin.parseExprSubscripts (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:11145:23)
      at TypeScriptParserMixin.parseUpdate (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:11130:21)
      at TypeScriptParserMixin.parseMaybeUnary (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:11110:23)
      at TypeScriptParserMixin.parseMaybeUnary (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:9890:18)
      at TypeScriptParserMixin.parseMaybeUnaryOrPrivate (/Users/almurat/KiKo/kiko-web/node_modules/@babel/parser/lib/index.js:10963:61)