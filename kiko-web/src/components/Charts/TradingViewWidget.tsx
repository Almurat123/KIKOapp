import React, { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
    symbol: string;
    theme?: 'light' | 'dark';
    height?: number;
}

declare global {
    interface Window {
        TradingView: any;
    }
}

export const TradingViewWidget: React.FC<TradingViewWidgetProps> = memo(({
    symbol,
    theme = 'light',
    height = 500,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Clear previous widget
        containerRef.current.innerHTML = '';

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => {
            if (typeof window.TradingView !== 'undefined') {
                new window.TradingView.widget({
                    autosize: true,
                    symbol: symbol,
                    interval: '60', // 1 hour
                    timezone: 'Etc/UTC',
                    theme: theme,
                    style: '1', // Candlestick
                    locale: 'en',
                    toolbar_bg: theme === 'light' ? '#FAF7F2' : '#1a1a1a',
                    enable_publishing: false,
                    allow_symbol_change: false,
                    container_id: containerRef.current?.id || 'tradingview_widget',
                    // Drawing tools enabled
                    drawings_access: {
                        type: 'black',
                        tools: [
                            { name: 'Regression Trend' },
                            { name: 'Trend Line' },
                            { name: 'Horizontal Line' },
                            { name: 'Vertical Line' },
                            { name: 'Rectangle' },
                            { name: 'Circle' },
                            { name: 'Fibonacci Retracement' },
                            { name: 'Text' },
                            { name: 'Arrow' },
                        ],
                    },
                    studies: [
                        'MASimple@tv-basicstudies',
                        'RSI@tv-basicstudies',
                    ],
                    hide_side_toolbar: false,
                    hide_top_toolbar: false,
                    save_image: false,
                });
            }
        };

        document.head.appendChild(script);

        return () => {
            if (document.head.contains(script)) {
                document.head.removeChild(script);
            }
        };
    }, [symbol, theme]);

    return (
        <div
            ref={containerRef}
            id="tradingview_widget"
            style={{
                height: `${height}px`,
                width: '100%',
            }}
        />
    );
});

TradingViewWidget.displayName = 'TradingViewWidget';
