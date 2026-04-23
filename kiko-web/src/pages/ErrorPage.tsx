import React from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/Layout/PageContainer';

const CHUNK_RECOVERY_KEY = 'kiko.error-page.chunk-recovery';

function isRecoverableChunkError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error || '');
    return /failed to fetch dynamically imported module/i.test(message)
        || /importing a module script failed/i.test(message)
        || /loading chunk [\d]+ failed/i.test(message)
        || /unable to preload css/i.test(message)
        || /preload css/i.test(message)
        || /not a valid javascript mime type/i.test(message)
        || /text\/html/i.test(message);
}

export const ErrorPage: React.FC = () => {
    const error = useRouteError();
    const navigate = useNavigate();
    const canRecoverByReload = isRecoverableChunkError(error);

    React.useEffect(() => {
        if (!canRecoverByReload) return;
        if (typeof window === 'undefined') return;
        if (window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) === '1') return;
        window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1');
        window.location.reload();
    }, [canRecoverByReload]);

    React.useEffect(() => {
        if (!canRecoverByReload || typeof window === 'undefined') return;
        return () => {
            window.sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
        };
    }, [canRecoverByReload]);

    let title = "An unexpected error occurred";
    let message = "Something went wrong.";

    if (isRouteErrorResponse(error)) {
        if (error.status === 404) {
            title = "Page Not Found";
            message = "The page you are looking for does not exist.";
        } else if (error.status === 401) {
            title = "Unauthorized";
            message = "You need to be logged in to view this page.";
        } else if (error.status === 503) {
            title = "Service Unavailable";
            message = "Our API is currently down. Please try again later.";
        }
    } else if (error instanceof Error) {
        message = error.message;
    }

    if (canRecoverByReload) {
        title = 'App Update Detected';
        message = 'A stale app bundle or missing route chunk was detected. Reload to fetch the latest version.';
    }

    return (
        <PageContainer>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '60vh',
                textAlign: 'center',
                gap: '20px'
            }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>{title}</h1>
                <p style={{ fontSize: '1.1rem', opacity: 0.8 }}>{message}</p>
                <button
                    onClick={() => {
                        if (canRecoverByReload) {
                            if (typeof window !== 'undefined') {
                                window.sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
                                window.location.reload();
                            }
                            return;
                        }
                        navigate('/');
                    }}
                    style={{
                        padding: '10px 20px',
                        background: 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                >
                    {canRecoverByReload ? 'Reload App' : 'Return Home'}
                </button>
            </div>
        </PageContainer>
    );
};
