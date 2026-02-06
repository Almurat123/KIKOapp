import React from 'react';
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { logger } from '../utils/logger';

// Fallback UI component to show when an error occurs
const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
    const errorMessage = (error as any)?.message || String(error);
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 font-sans text-gray-900">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
                <p className="text-gray-600 mb-6">
                    We encountered an unexpected error. The application has been paused to prevent data loss.
                </p>
                <pre className="bg-gray-100 p-4 rounded text-left text-sm text-gray-700 overflow-auto mb-6 max-h-40">
                    {errorMessage}
                </pre>
                <button
                    onClick={resetErrorBoundary}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
                >
                    Try Again
                </button>
            </div>
        </div>
    );
};

// Log error to your logging service
const logError = (error: unknown, info: React.ErrorInfo) => {
    logger.error('[ErrorBoundary] Caught error:', {
        message: (error as any)?.message || String(error),
        stack: (error as any)?.stack,
        componentStack: info.componentStack
    });
};

export const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <ReactErrorBoundary
            FallbackComponent={ErrorFallback}
            onError={logError}
            onReset={() => {
                // Optional: Reset the state of your app so the error doesn't happen again
                window.location.reload();
            }}
        >
            {children}
        </ReactErrorBoundary>
    );
};
