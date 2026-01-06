import React from 'react';
import styles from '../../pages/MarketDataPage.module.css';

interface TokenCandlestickChartProps {
    tokenSymbol?: string;
}

export const TokenCandlestickChart: React.FC<TokenCandlestickChartProps> = ({ tokenSymbol = 'ETH' }) => {
    // Mock OHLC data - In production, this would come from Gecko Terminal API
    // API endpoint: https://api.geckoterminal.com/api/v2/networks/{network}/pools/{pool_address}/ohlcv/{timeframe}
    const mockData = [
        { o: 3400, c: 3450, h: 3480, l: 3380, time: '09:00' },
        { o: 3450, c: 3420, h: 3470, l: 3400, time: '10:00' },
        { o: 3420, c: 3500, h: 3520, l: 3410, time: '11:00' },
        { o: 3500, c: 3480, h: 3530, l: 3470, time: '12:00' },
        { o: 3480, c: 3550, h: 3570, l: 3470, time: '13:00' },
        { o: 3550, c: 3530, h: 3560, l: 3520, time: '14:00' },
        { o: 3530, c: 3600, h: 3620, l: 3520, time: '15:00' },
        { o: 3600, c: 3580, h: 3610, l: 3570, time: '16:00' },
    ];

    const maxPrice = Math.max(...mockData.map(d => d.h));
    const minPrice = Math.min(...mockData.map(d => d.l));
    const priceRange = maxPrice - minPrice;
    const chartHeight = 200;
    const chartWidth = 400;
    const candleWidth = 30;
    const spacing = chartWidth / mockData.length;

    const priceToY = (price: number) => {
        return chartHeight - ((price - minPrice) / priceRange) * chartHeight;
    };

    return (
        <div className={styles.chartSection}>
            <div className={styles.sectionTitle}>
                <span>{tokenSymbol}/USD Price Chart</span>
                <span className={styles.metricLabel} style={{ marginLeft: 'auto' }}>
                    Powered by Gecko Terminal
                </span>
            </div>
            <div style={{ height: '300px', padding: '1rem', position: 'relative' }}>
                <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`} preserveAspectRatio="xMidYMid meet">
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                        const y = chartHeight * ratio;
                        const price = maxPrice - (priceRange * ratio);
                        return (
                            <g key={i}>
                                <line
                                    x1="0"
                                    y1={y}
                                    x2={chartWidth}
                                    y2={y}
                                    stroke="var(--text-secondary)"
                                    strokeOpacity="0.1"
                                    strokeDasharray="4 4"
                                />
                                <text
                                    x={chartWidth - 5}
                                    y={y - 5}
                                    textAnchor="end"
                                    fontSize="10"
                                    fill="var(--text-secondary)"
                                    opacity="0.6"
                                >
                                    ${price.toFixed(0)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Candlesticks */}
                    {mockData.map((candle, i) => {
                        const x = i * spacing + spacing / 2;
                        const isBullish = candle.c >= candle.o;
                        const color = isBullish ? 'var(--accent-success)' : 'var(--accent-danger)';
                        const bodyTop = Math.min(candle.o, candle.c);
                        const bodyBottom = Math.max(candle.o, candle.c);

                        return (
                            <g key={i}>
                                {/* Wick (high-low line) */}
                                <line
                                    x1={x}
                                    y1={priceToY(candle.h)}
                                    x2={x}
                                    y2={priceToY(candle.l)}
                                    stroke={color}
                                    strokeWidth="1.5"
                                />
                                {/* Body (open-close rectangle) */}
                                <rect
                                    x={x - candleWidth / 2}
                                    y={priceToY(bodyBottom)}
                                    width={candleWidth}
                                    height={Math.max(2, priceToY(bodyTop) - priceToY(bodyBottom))}
                                    fill={color}
                                    rx="2"
                                />
                                {/* Time label */}
                                <text
                                    x={x}
                                    y={chartHeight + 15}
                                    textAnchor="middle"
                                    fontSize="9"
                                    fill="var(--text-secondary)"
                                    opacity="0.6"
                                >
                                    {candle.time}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
};
