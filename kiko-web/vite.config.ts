import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'util', 'stream'],
      globals: {
        Buffer: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@features': path.resolve(__dirname, './src/features'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  optimizeDeps: {
    include: [
      '@privy-io/react-auth',
      '@solana/kit',
      '@solana-program/memo',
      '@solana-program/system',
      '@solana-program/token',
      '@xenova/transformers',
    ],
  },
  build: {
    // iOS Safari compatibility settings
    target: 'es2020', // Support iOS 14+ Safari (ES2020 includes BigInt, optional chaining, nullish coalescing)
    minify: 'esbuild', // Use esbuild for faster builds and better compatibility
  },
  server: {
    headers: {
      // Relaxed CSP for local development - Privy requires embedded iframes
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://auth.privy.io https://challenges.cloudflare.com https://accounts.google.com https://apis.google.com https://www.gstatic.com https://relay.walletconnect.com https://verify.walletconnect.com blob:",
        "style-src 'self' 'unsafe-inline' https:",
        "font-src 'self' https://fonts.gstatic.com data: blob:",
        "img-src 'self' data: https: blob: http://localhost:*",
        "media-src 'self' blob: https: data:", // Added for HLS video playback
        "connect-src 'self' https: wss: http://localhost:* ws://localhost:*",
        "frame-src 'self' https://auth.privy.io https://accounts.google.com https://challenges.cloudflare.com https://www.google.com https://verify.walletconnect.com https://www.geckoterminal.com",
        "child-src 'self' https://auth.privy.io https://challenges.cloudflare.com blob:",
        "frame-ancestors 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self' https://auth.privy.io https://accounts.google.com",
        "worker-src 'self' blob:",
      ].join('; '),
      // Removed Permissions-Policy - it was blocking Privy's embedded fullscreen functionality
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/clanker-api': {
        target: 'https://www.clanker.world/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/clanker-api/, ''),
      },
      '/fourmeme-api': {
        target: 'https://four.meme/meme-api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fourmeme-api/, ''),
        timeout: 10000, // 10 second timeout
        secure: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[Vite Proxy] Four.meme API error:', err.message);
          });
          proxy.on('proxyReq', (proxyReq) => {
            // Set timeout on the proxy request
            proxyReq.setTimeout(10000, () => {
              proxyReq.destroy();
            });
          });
        },
      },
      '/pumpfun-api': {
        target: 'https://frontend-api-v3.pump.fun',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pumpfun-api/, ''),
      },
    },
  },
})
