import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { ErrorPage } from './pages/ErrorPage';

// Pages
import { ChatInterface } from './components/Chat/ChatInterface';
import { SocialPage } from './pages/SocialPage';
import { OverviewPage } from './pages/OverviewPage';
import { TokensPage } from './pages/TokensPage';
import { TokenDetailPage } from './pages/TokenDetailPage';
import { ChainsPage } from './pages/ChainsPage';
import { SuperDefiPage } from './pages/SuperDefiPage';
import { TradePage } from './pages/TradePage';
import WalletPage from './pages/WalletPage';
import SettingsPage from './pages/SettingsPage';
import NewsPage from './pages/NewsPage';

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
        element: <NewsPage />,
      },
      {
        path: 'market',
        element: <OverviewPage />,
      },
      {
        path: 'tokens',
        children: [
          {
            index: true,
            element: <TokensPage />,
          },
          {
            path: ':chain/:address',
            element: <TokenDetailPage />,
          }
        ]
      },
      {
        path: 'chains',
        element: <ChainsPage />,
      },
      {
        path: 'defi/*',
        element: <SuperDefiPage />,
      },
      {
        path: 'social',
        element: <SocialPage />,
      },
      {
        path: 'trade',
        element: <TradePage />,
      },
      {
        path: 'wallet',
        element: <WalletPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
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
