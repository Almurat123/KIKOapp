import React, { useEffect, useState } from 'react';
import styles from './ChainFundFlowChart.module.css';
import { getChainFundFlows, type ChainFundFlow, formatCurrency } from '../../services/dune';

export const ChainFundFlowChart: React.FC = () => {
    const [data, setData] = useState<ChainFundFlow[]>([]);
    const [loading, setLoading] = useState(true);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        // Fetch chain fund flows from Dune service
        const apiKey = import.meta.env.VITE_DUNE_API_KEY;
        getChainFundFlows(apiKey).then((flows) => {
            setData(flows);
            setLoading(false);
        });
    }, []);

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.skeleton}></div>
            </div>
        );
    }

    // Calculate max value for scaling (use max of inflow or outflow)
    const maxVal = Math.max(...data.map(d => Math.max(d.inflow, d.outflow)));

    // Chart dimensions
    const height = 180;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const graphHeight = height - padding.top - padding.bottom;
    const midY = padding.top + graphHeight / 2;

    // Bar configuration
    const barWidth = 24;
    const gap = 40;
    const width = Math.max(600, padding.left + padding.right + data.length * (barWidth + gap));

    const handleMouseMove = (e: React.MouseEvent<SVGElement>, index: number) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredIndex(index);
        setMousePosition({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    return (
        <div className={styles.chartContainer}>
            <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="xMidYMid meet"
                className={styles.chart}
                onMouseLeave={() => setHoveredIndex(null)}
            >
                <defs>
                    <linearGradient id="inflowGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-success)" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="var(--accent-success)" stopOpacity="0.4" />
                    </linearGradient>
                    <linearGradient id="outflowGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-danger)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--accent-danger)" stopOpacity="0.8" />
                    </linearGradient>
                </defs>

                {/* Zero Line */}
                <line
                    x1={padding.left} y1={midY}
                    x2={width - padding.right} y2={midY}
                    stroke="var(--text-secondary)"
                    strokeWidth="1"
                    strokeOpacity="0.3"
                />

                {/* Bars */}
                {data.map((d, i) => {
                    const x = padding.left + i * (barWidth + gap) + gap / 2;
                    const inflowH = (d.inflow / maxVal) * (graphHeight / 2);
                    const outflowH = (d.outflow / maxVal) * (graphHeight / 2);
                    const isHovered = hoveredIndex === i;

                    return (
                        <g
                            key={i}
                            onMouseMove={(e) => handleMouseMove(e, i)}
                            style={{ cursor: 'pointer', opacity: isHovered ? 1 : 0.85 }}
                        >
                            {/* Inflow (Up) */}
                            <rect
                                x={x}
                                y={midY - inflowH}
                                width={barWidth}
                                height={inflowH}
                                fill="url(#inflowGradient)"
                                rx="2"
                            />

                            {/* Outflow (Down) */}
                            <rect
                                x={x}
                                y={midY}
                                width={barWidth}
                                height={outflowH}
                                fill="url(#outflowGradient)"
                                rx="2"
                            />

                            {/* Chain Label */}
                            <text
                                x={x + barWidth / 2}
                                y={midY + (graphHeight / 2) + 20}
                                textAnchor="middle"
                                fontSize="11"
                                fill="var(--text-secondary)"
                                fontWeight="500"
                            >
                                {d.chain}
                            </text>
                        </g>
                    );
                })}

                {/* Tooltip */}
                {hoveredIndex !== null && mousePosition && data[hoveredIndex] && (
                    <g transform={`translate(${mousePosition.x}, ${mousePosition.y})`}>
                        <rect
                            x="-80"
                            y="-90"
                            width="160"
                            height="80"
                            fill="var(--bg-primary)"
                            stroke="var(--border-color)"
                            rx="6"
                            filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))"
                        />
                        <text x="0" y="-70" textAnchor="middle" fontWeight="bold" fill="var(--text-primary)">
                            {data[hoveredIndex].chain}
                        </text>
                        <text x="-70" y="-50" fontSize="11" fill="var(--text-secondary)">
                            In: <tspan fill="var(--accent-success)">{formatCurrency(data[hoveredIndex].inflow)}</tspan>
                        </text>
                        <text x="-70" y="-35" fontSize="11" fill="var(--text-secondary)">
                            Out: <tspan fill="var(--accent-danger)">{formatCurrency(data[hoveredIndex].outflow)}</tspan>
                        </text>
                        <text x="-70" y="-15" fontSize="11" fontWeight="600" fill="var(--text-primary)">
                            Net: {data[hoveredIndex].netFlow > 0 ? '+' : ''}{formatCurrency(data[hoveredIndex].netFlow)}
                        </text>
                    </g>
                )}
            </svg>
        </div>
    );
};
