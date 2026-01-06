import React, { useState } from 'react';
import styles from './SentimentGauge.module.css';

interface SentimentGaugeProps {
    current?: number;
    yesterday?: number;
    lastWeek?: number;
    label?: string;
}

// Mock historical data for the last 30 days
const generateHistory = () => {
    const data = [];
    let value = 50;
    for (let i = 0; i < 30; i++) {
        // Random walk
        value += (Math.random() - 0.5) * 15;
        value = Math.max(10, Math.min(90, value)); // Clamp between 10 and 90
        data.push({ day: i, value });
    }
    // Ensure the last point matches "current" roughly if we were using real data, 
    // but for this mock we'll just let it be and overlay the current value.
    return data;
};

const historyData = generateHistory();

export const SentimentGauge: React.FC<SentimentGaugeProps> = ({
    current = 72,
    label = 'Greed'
}) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

    // Chart dimensions
    const height = 140;
    const width = 300; // Fixed width for SVG coordinate system, scales with CSS
    const padding = { top: 20, bottom: 30, left: 0, right: 0 };
    const graphHeight = height - padding.top - padding.bottom;
    const graphWidth = width - padding.left - padding.right;

    // Scales
    const xScale = (index: number) => padding.left + (index / (historyData.length - 1)) * graphWidth;
    const yScale = (value: number) => padding.top + graphHeight - (value / 100) * graphHeight;

    // Generate path
    const linePath = `M ${historyData.map((d, i) => `${xScale(i)},${yScale(d.value)}`).join(' L ')}`;

    // Area path
    const areaPath = `${linePath} L ${width},${height - padding.bottom} L ${0},${height - padding.bottom} Z`;

    const getSentimentColor = (val: number) => {
        if (val >= 75) return 'var(--accent-success)';
        if (val >= 55) return 'var(--accent-warning)'; // Greed is usually green/orange, let's stick to standard
        if (val >= 45) return 'var(--text-secondary)';
        if (val <= 25) return 'var(--accent-danger)';
        return 'var(--accent-warning)'; // Fear
    };

    const currentColor = getSentimentColor(current);

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        // Find closest data point
        const index = Math.min(
            historyData.length - 1,
            Math.max(0, Math.round(((x - padding.left) / graphWidth) * (historyData.length - 1)))
        );

        setHoveredIndex(index);
        setMousePosition({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    return (
        <div className={styles.sentimentGauge}>
            <div className={styles.headerStats}>
                <div className={styles.mainScore}>
                    <span className={styles.scoreValue} style={{ color: currentColor }}>{current}</span>
                    <span className={styles.scoreLabel}>{label}</span>
                </div>
                <div className={styles.dateRange}>Last 30 Days</div>
            </div>

            <div className={styles.chartWrapper}>
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className={styles.historyChart}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoveredIndex(null)}
                >
                    <defs>
                        <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={currentColor} stopOpacity="0.2" />
                            <stop offset="100%" stopColor={currentColor} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Background Zones */}
                    <rect x="0" y={yScale(100)} width={width} height={graphHeight * 0.25} fill="var(--accent-success)" fillOpacity="0.05" />
                    <rect x="0" y={yScale(75)} width={width} height={graphHeight * 0.25} fill="var(--accent-warning)" fillOpacity="0.05" />
                    <rect x="0" y={yScale(50)} width={width} height={graphHeight * 0.25} fill="var(--text-secondary)" fillOpacity="0.05" />
                    <rect x="0" y={yScale(25)} width={width} height={graphHeight * 0.25} fill="var(--accent-danger)" fillOpacity="0.05" />

                    {/* Grid Lines */}
                    {[25, 50, 75].map(val => (
                        <line
                            key={val}
                            x1="0" y1={yScale(val)}
                            x2={width} y2={yScale(val)}
                            stroke="var(--text-secondary)"
                            strokeOpacity="0.1"
                            strokeDasharray="4 4"
                        />
                    ))}

                    {/* Trend Line */}
                    <path
                        d={areaPath}
                        fill="url(#sentimentGradient)"
                    />
                    <path
                        d={linePath}
                        fill="none"
                        stroke={currentColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Hover Effect */}
                    {hoveredIndex !== null && (
                        <g>
                            <line
                                x1={xScale(hoveredIndex)} y1={padding.top}
                                x2={xScale(hoveredIndex)} y2={height - padding.bottom}
                                stroke="var(--text-secondary)"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                            />
                            <circle
                                cx={xScale(hoveredIndex)}
                                cy={yScale(historyData[hoveredIndex].value)}
                                r="4"
                                fill={getSentimentColor(historyData[hoveredIndex].value)}
                                stroke="var(--bg-primary)"
                                strokeWidth="2"
                            />
                        </g>
                    )}
                </svg>

                {/* Tooltip */}
                {hoveredIndex !== null && mousePosition && (
                    <div
                        className={styles.tooltip}
                        style={{
                            left: mousePosition.x,
                            top: mousePosition.y - 40
                        }}
                    >
                        <span className={styles.tooltipValue}>
                            {Math.round(historyData[hoveredIndex].value)}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};




