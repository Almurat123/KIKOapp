import React, { useState, useMemo } from 'react';
import styles from './MarketCapTrendChart.module.css';

interface DataPoint {
    value: number; // Market cap in billions
    volume: number; // Volume in billions
    date: string;
    timestamp: number;
}

interface MarketCapTrendChartProps {
    data?: DataPoint[];
}

// Generate more granular mock data (hourly for 7 days = 168 points)
const generateMockData = (): DataPoint[] => {
    const points: DataPoint[] = [];
    const now = Date.now();
    let value = 450;

    for (let i = 168; i >= 0; i--) {
        // Random walk for price
        value += (Math.random() - 0.48) * 5;

        // Volume spikes when price moves a lot
        const volatility = Math.abs(Math.random() - 0.5);
        const volume = 10 + volatility * 50;

        points.push({
            value: Math.max(400, value),
            volume,
            date: new Date(now - i * 3600 * 1000).toLocaleDateString(),
            timestamp: now - i * 3600 * 1000
        });
    }
    return points;
};

const defaultData = generateMockData();

export const MarketCapTrendChart: React.FC<MarketCapTrendChartProps> = ({
    data = defaultData
}) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

    const { minVal, maxVal, maxVol } = useMemo(() => {
        const vals = data.map(d => d.value);
        const vols = data.map(d => d.volume);
        return {
            minVal: Math.min(...vals),
            maxVal: Math.max(...vals),
            maxVol: Math.max(...vols)
        };
    }, [data]);

    // Chart dimensions
    const height = 200;
    const width = 600;
    const padding = { top: 20, right: 0, bottom: 20, left: 0 };
    const graphHeight = height - padding.top - padding.bottom;
    const graphWidth = width - padding.left - padding.right;

    // Scales
    const xScale = (index: number) => padding.left + (index / (data.length - 1)) * graphWidth;
    const yScale = (val: number) => padding.top + graphHeight - ((val - minVal) / (maxVal - minVal)) * graphHeight;
    const volScale = (vol: number) => (vol / maxVol) * (graphHeight * 0.3); // Volume takes up bottom 30%

    // Generate paths
    const linePath = `M ${data.map((d, i) => `${xScale(i)},${yScale(d.value)}`).join(' L ')}`;
    const areaPath = `${linePath} L ${width},${height - padding.bottom} L ${0},${height - padding.bottom} Z`;

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const index = Math.min(
            data.length - 1,
            Math.max(0, Math.round(((x - padding.left) / graphWidth) * (data.length - 1)))
        );

        setHoveredIndex(index);
        setMousePosition({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    return (
        <div className={styles.chartContainer}>
            <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                className={styles.chart}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredIndex(null)}
            >
                <defs>
                    <linearGradient id="capGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Volume Bars */}
                {data.map((d, i) => {
                    if (i % 2 !== 0) return null; // Render every other bar for performance/clarity
                    const barHeight = volScale(d.volume);
                    return (
                        <rect
                            key={i}
                            x={xScale(i) - 1}
                            y={height - padding.bottom - barHeight}
                            width={2}
                            height={barHeight}
                            fill="var(--text-secondary)"
                            fillOpacity="0.1"
                        />
                    );
                })}

                {/* Market Cap Area */}
                <path
                    d={areaPath}
                    fill="url(#capGradient)"
                />
                <path
                    d={linePath}
                    fill="none"
                    stroke="var(--accent-primary)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                />

                {/* Hover Effects */}
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
                            cy={yScale(data[hoveredIndex].value)}
                            r="4"
                            fill="var(--accent-primary)"
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
                        top: mousePosition.y - 60
                    }}
                >
                    <div className={styles.tooltipDate}>
                        {new Date(data[hoveredIndex].timestamp).toLocaleString()}
                    </div>
                    <div className={styles.tooltipRow}>
                        <span>Cap:</span>
                        <span className={styles.tooltipValue}>
                            ${data[hoveredIndex].value.toFixed(2)}B
                        </span>
                    </div>
                    <div className={styles.tooltipRow}>
                        <span>Vol:</span>
                        <span className={styles.tooltipValue}>
                            ${data[hoveredIndex].volume.toFixed(2)}B
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};




