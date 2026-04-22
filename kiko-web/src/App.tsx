import React, { Suspense, useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import icon from './assets/images/icon.png';
import { RootLayout } from './layouts/RootLayout';
import { ErrorPage } from './pages/ErrorPage';
import { ChatInterface } from './components/Chat/ChatInterface';
import { lazyRoute } from './utils/lazyRoute';

// CONTEXT MEMORY
// Updated: 2026-04-12
// Author: Rowan
// Reason: Splitting "/" into a lightweight HomePage introduced a second chat
//         boot path (`HomePage -> LazyChatInterface -> navigate('/chat/:id')`),
//         which caused visible "Preparing chat", chat-page loading, and
//         streaming/plan UI remount churn after the first send.
// Goal: keep the primary chat entry on one stable owner path so the first send,
//       conversation creation, and route transition do not remount chat runtime
//       through two different surfaces.
// Owns: top-level route loading policy for the chat entry and whether "/" and
//       `/chat/:conversationId` share one chat owner.
// Does Not Own: internal code splitting inside chat, welcome UI, or backend data timing.
// Design Language:
// - The default chat entry must not boot through two different route owners.
// - First-send flow stability is more important than a theoretical lighter shell.
// - forbidden local patch patterns: welcome-shell wrappers that remount chat runtime during first send
// Document Provenance:
// - Source: Runtime observation of "Preparing chat", chat-page loading, and
//   repeated plan/reply refresh after first send
// - Kind: runtime observation
// - Retrieved: 2026-04-12
// - Applied To: restore one shared `ChatInterface` owner for `/` and `/chat/:conversationId`
// - Verification: verified in runtime
// - Source: Vite production build output
// - Kind: build evidence
// - Retrieved: 2026-04-12
// - Applied To: accepted bundle tradeoff in exchange for removing chat-runtime remount regressions
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-chat-home-shell-regression-revert.md

// Pages
const SocialPage = lazyRoute('social-page', () => import('./pages/SocialPage').then((m) => ({ default: m.SocialPage })));
const OverviewPage = lazyRoute('overview-page', () => import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const TokensPage = lazyRoute('tokens-page', () => import('./pages/TokensPage').then((m) => ({ default: m.TokensPage })));
const TokenDetailPage = lazyRoute('token-detail-page', () => import('./pages/TokenDetailPage').then((m) => ({ default: m.TokenDetailPage })));
const ChainsPage = lazyRoute('chains-page', () => import('./pages/ChainsPage').then((m) => ({ default: m.ChainsPage })));
const SuperDefiPage = lazyRoute('super-defi-page', () => import('./pages/SuperDefiPage').then((m) => ({ default: m.SuperDefiPage })));
const TradePage = lazyRoute('trade-page', () => import('./pages/TradePage').then((m) => ({ default: m.TradePage })));
const WalletPage = lazyRoute('wallet-page', () => import('./pages/WalletPage'));
const AdminPage = lazyRoute('admin-page', () => import('./pages/AdminPage'));
const SettingsPage = lazyRoute('settings-page', () => import('./pages/SettingsPage'));
const NewsPage = lazyRoute('news-page', () => import('./pages/NewsPage'));
const AgentMapPage = lazyRoute('agent-map-page', () => import('./pages/AgentMapPage').then((m) => ({ default: m.AgentMapPage })));

function RouteFallback() {
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowRecovery(true);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg-primary, #0b0b0c)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          animation: 'pulse-gentle 2s ease-in-out infinite',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img
            src={icon}
            alt="KiKo"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              // Fallback to a simple text logo if image fails
              (e.target as HTMLImageElement).style.display = 'none';
              const parent = (e.target as HTMLElement).parentElement;
              if (parent) parent.innerHTML = '<span style="font-size: 24px; font-weight: 800; color: #fff;">K</span>';
            }}
          />
        </div>

        <div style={{
          fontSize: '15px',
          fontWeight: 500,
          letterSpacing: '0.02em',
          opacity: 0.6,
          color: 'var(--text-primary, #f5f5f5)'
        }}>
          Loading Kiko...
        </div>
      </div>

      {showRecovery && (
        <div
          style={{
            position: 'absolute',
            bottom: '10vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            animation: 'fadeIn 0.5s ease-out forwards'
          }}
        >
          <p style={{
            fontSize: '13px',
            opacity: 0.4,
            textAlign: 'center',
            maxWidth: '280px',
            lineHeight: 1.5
          }}>
            Taking longer than expected? It might be a connection issue.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '14px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary, #f5f5f5)',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Reload app
          </button>
        </div>
      )}
    </div>
  );
}

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

// Contexts & Utils


// Define Routes
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <ChatInterface />,
      },
      {
        path: 'chat/:conversationId',
        element: <ChatInterface />,
      },
      {
        path: 'news',
        element: withSuspense(<NewsPage />),
      },
      {
        path: 'market',
        element: withSuspense(<OverviewPage />),
      },
      {
        path: 'tokens',
        children: [
          {
            index: true,
            element: withSuspense(<TokensPage />),
          },
          {
            path: ':chain/:address',
            element: withSuspense(<TokenDetailPage />),
          }
        ]
      },
      {
        path: 'chains',
        element: withSuspense(<ChainsPage />),
      },
      {
        path: 'defi/*',
        element: withSuspense(<SuperDefiPage />),
      },
      {
        path: 'social',
        element: withSuspense(<SocialPage />),
      },
      {
        path: 'trade',
        element: withSuspense(<TradePage />),
      },
      {
        path: 'wallet',
        element: withSuspense(<WalletPage />),
      },
      {
        path: 'admin',
        element: withSuspense(<AdminPage />),
      },
      {
        path: 'settings',
        element: withSuspense(<SettingsPage />),
      },
      {
        path: 'agent-map.json',
        element: withSuspense(<AgentMapPage />),
      },
      // Fallback for unknown routes
      {
        path: '*',
        element: <ErrorPage />,
      }
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
