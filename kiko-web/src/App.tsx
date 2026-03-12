import React, { Suspense, useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { ErrorPage } from './pages/ErrorPage';
import { lazyRoute } from './utils/lazyRoute';

// Pages
const ChatInterface = lazyRoute('chat-interface', () => import('./components/Chat/ChatInterface').then((m) => ({ default: m.ChatInterface })));
const SocialPage = lazyRoute('social-page', () => import('./pages/SocialPage').then((m) => ({ default: m.SocialPage })));
const OverviewPage = lazyRoute('overview-page', () => import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const TokensPage = lazyRoute('tokens-page', () => import('./pages/TokensPage').then((m) => ({ default: m.TokensPage })));
const TokenDetailPage = lazyRoute('token-detail-page', () => import('./pages/TokenDetailPage').then((m) => ({ default: m.TokenDetailPage })));
const ChainsPage = lazyRoute('chains-page', () => import('./pages/ChainsPage').then((m) => ({ default: m.ChainsPage })));
const SuperDefiPage = lazyRoute('super-defi-page', () => import('./pages/SuperDefiPage').then((m) => ({ default: m.SuperDefiPage })));
const TradePage = lazyRoute('trade-page', () => import('./pages/TradePage').then((m) => ({ default: m.TradePage })));
const WalletPage = lazyRoute('wallet-page', () => import('./pages/WalletPage'));
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
        minHeight: '100vh',
        background: 'var(--bg-primary, #0b0b0c)',
        color: 'var(--text-primary, #f5f5f5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: 'min(420px, 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '24px',
          background: 'rgba(255,255,255,0.04)',
          padding: '24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Loading Kiko</div>
        <div style={{ fontSize: '14px', lineHeight: 1.5, opacity: 0.8 }}>
          We&apos;re restoring the page and reconnecting the app.
        </div>
        {showRecovery ? (
          <div style={{ marginTop: '18px' }}>
            <div style={{ fontSize: '13px', lineHeight: 1.5, opacity: 0.72, marginBottom: '12px' }}>
              This is taking longer than expected. A stale route chunk or mobile browser restore can leave the page stuck here.
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: 0,
                borderRadius: '999px',
                padding: '10px 16px',
                fontWeight: 600,
                cursor: 'pointer',
                background: '#f5f5f5',
                color: '#111',
              }}
            >
              Reload app
            </button>
          </div>
        ) : null}
      </div>
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
        element: withSuspense(<ChatInterface />),
      },
      {
        path: 'chat/:conversationId',
        element: withSuspense(<ChatInterface />),
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
