import { getTrendingTokens } from '../src/repositories/tokenRepository.js';

const rows = await getTrendingTokens('base', 120, { bypassMemoryCache: true, lightweight: true });
const target = rows.find((r: any) => String(r.address).toLowerCase() === '0xdd505db2f238c85004e01632c252906065a6ab07');
console.log(target);
