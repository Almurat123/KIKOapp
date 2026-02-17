import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { ErrorPage } from './pages/ErrorPage';

// Pages
const ChatInterface = lazy(() => import('./components/Chat/ChatInterface').then((m) => ({ default: m.ChatInterface })));
const SocialPage = lazy(() => import('./pages/SocialPage').then((m) => ({ default: m.SocialPage })));
const OverviewPage = lazy(() => import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const TokensPage = lazy(() => import('./pages/TokensPage').then((m) => ({ default: m.TokensPage })));
const TokenDetailPage = lazy(() => import('./pages/TokenDetailPage').then((m) => ({ default: m.TokenDetailPage })));
const ChainsPage = lazy(() => import('./pages/ChainsPage').then((m) => ({ default: m.ChainsPage })));
const SuperDefiPage = lazy(() => import('./pages/SuperDefiPage').then((m) => ({ default: m.SuperDefiPage })));
const TradePage = lazy(() => import('./pages/TradePage').then((m) => ({ default: m.TradePage })));
const WalletPage = lazy(() => import('./pages/WalletPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));

function RouteFallback() {
  return <div style={{ minHeight: '100vh', background: 'var(--bg-primary, #0b0b0c)' }} />;
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
