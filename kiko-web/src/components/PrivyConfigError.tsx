import React from 'react';

// Privy Configuration Error Component
export const PrivyConfigError: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#f5f5f5',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '40px',
        maxWidth: '600px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}>
        <h1 style={{ margin: '0 0 16px 0', color: '#333', fontSize: '24px' }}>
          ⚠️ Privy App ID Not Configured
        </h1>
        <p style={{ margin: '0 0 24px 0', color: '#666', lineHeight: 1.6 }}>
          Please set your Privy App ID to use authentication and wallet features.
        </p>
        <div style={{
          background: '#f8f9fa',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#333', fontSize: '16px' }}>
            Setup Steps:
          </h3>
          <ol style={{ margin: 0, paddingLeft: '20px', color: '#666', lineHeight: 1.8 }}>
            <li>
              Create a <code style={{
                background: '#e9ecef',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}>.env</code> file in the project root directory
            </li>
            <li>
              Add the following content:<br />
              <code style={{
                background: '#e9ecef',
                padding: '8px 12px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                display: 'block',
                marginTop: '8px',
              }}>
                VITE_PRIVY_APP_ID=your-actual-privy-app-id
              </code>
            </li>
            <li>
              Get your App ID from the{' '}
              <a
                href="https://dashboard.privy.io"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#6A6FF5', textDecoration: 'none' }}
              >
                Privy Dashboard
              </a>
            </li>
            <li>Restart the development server</li>
          </ol>
        </div>
        <p style={{ margin: 0, color: '#999', fontSize: '14px' }}>
          If you don't have a Privy account yet, visit{' '}
          <a
            href="https://privy.io"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#6A6FF5', textDecoration: 'none' }}
          >
            privy.io
          </a>{' '}
          to sign up and create an application.
        </p>
      </div>
    </div>
  );
};
