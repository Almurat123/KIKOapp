import React from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/Layout/PageContainer';

export const ErrorPage: React.FC = () => {
    const error = useRouteError();
    const navigate = useNavigate();

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
                    onClick={() => navigate('/')}
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
                    Return Home
                </button>
            </div>
        </PageContainer>
    );
};
