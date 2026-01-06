import React, { useState, useRef, useEffect } from 'react';

export type TimePeriod = '1m' | '1y' | 'all';

export interface ChartDataPoint {
    timestamp: number;
    value: number;
}

interface ChartWithTimePeriodProps {
    data: ChartDataPoint[];
    height?: number;
    color?: string;
    onPeriodChange?: (period: TimePeriod) => void;
    onDataPointClick?: (dataPoint: ChartDataPoint) => void;
    showTimePeriodSelector?: boolean;
    clickable?: boolean;
    formatValue?: (value: number) => string;
    formatDate?: (timestamp: number) => string;
}

const defaultFormatValue = (value: number): string => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
};

const defaultFormatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const ChartWithTimePeriod: React.FC<ChartWithTimePeriodProps> = ({
    data,
    height = 300,
    color = '#5B8DEF',
    onPeriodChange,
    onDataPointClick,
    showTimePeriodSelector = true,
    clickable = true,
    formatValue = defaultFormatValue,
    formatDate = defaultFormatDate,
}) => {
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all');
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handlePeriodChange = (period: TimePeriod) => {
        setSelectedPeriod(period);
        onPeriodChange?.(period);
    };

    const filterDataByPeriod = (data: ChartDataPoint[], period: TimePeriod): ChartDataPoint[] => {
        if (period === 'all' || data.length === 0) return data;

        const now = Date.now();
        const periodMs = period === '1m' ? 30 * 24 * 60 * 60 * 1000 : 365 * 24 * 60 * 60 * 1000;
        const cutoff = now - periodMs;

        return data.filter(point => point.timestamp >= cutoff);
    };

    const filteredData = filterDataByPeriod(data, selectedPeriod);

    if (filteredData.length === 0) {
        return (
            <div style={{
                width: '100%',
                height: `${height}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a1a1aa',
                fontSize: '14px',
            }}>
                No data available
            </div>
        );
    }

    const width = 1000;
    const values = filteredData.map(d => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    // Generate path for area chart
    let areaPath = `M 0,${height} `;
    filteredData.forEach((d, i) => {
        const x = (i / (filteredData.length - 1)) * width;
        const y = height - ((d.value - min) / range) * height * 0.8 - 20;
        areaPath += `L ${x},${y} `;
    });
    areaPath += `L ${width},${height} Z`;

    // Generate path for line
    let linePath = '';
    filteredData.forEach((d, i) => {
        const x = (i / (filteredData.length - 1)) * width;
        const y = height - ((d.value - min) / range) * height * 0.8 - 20;
        linePath += `${i === 0 ? 'M' : 'L'} ${x},${y} `;
    });

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!clickable || !svgRef.current || !containerRef.current) return;

        const svgRect = svgRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - svgRect.left;
        const relativeX = x / svgRect.width;

        const index = Math.round(relativeX * (filteredData.length - 1));
        const clampedIndex = Math.max(0, Math.min(filteredData.length - 1, index));

        setHoveredPoint(clampedIndex);
        setTooltipPosition({
            x: e.clientX - containerRect.left,
            y: e.clientY - containerRect.top,
        });
    };

    const handleMouseLeave = () => {
        setHoveredPoint(null);
        setTooltipPosition(null);
    };

    const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!clickable || !onDataPointClick || hoveredPoint === null) return;
        onDataPointClick(filteredData[hoveredPoint]);
    };

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            {/* Time Period Selector */}
            {showTimePeriodSelector && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginBottom: '12px',
                    gap: '8px',
                }}>
                    {(['1m', '1y', 'all'] as TimePeriod[]).map(period => (
                        <button
                            key={period}
                            onClick={() => handlePeriodChange(period)}
                            style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                borderRadius: '6px',
                                background: selectedPeriod === period ? '#5B8DEF' : 'rgba(91, 141, 239, 0.1)',
                                color: selectedPeriod === period ? '#ffffff' : '#5B8DEF',
                                border: selectedPeriod === period ? 'none' : '1px solid rgba(91, 141, 239, 0.3)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                if (selectedPeriod !== period) {
                                    e.currentTarget.style.background = 'rgba(91, 141, 239, 0.2)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (selectedPeriod !== period) {
                                    e.currentTarget.style.background = 'rgba(91, 141, 239, 0.1)';
                                }
                            }}
                        >
                            {period === '1m' ? '1M' : period === '1y' ? '1Y' : 'All'}
                        </button>
                    ))}
                </div>
            )}

            {/* Chart */}
            <div style={{ flex: 1, width: '100%', position: 'relative' }}>
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`}
                    style={{
                        width: '100%',
                        height: '100%',
                        overflow: 'visible',
                        cursor: clickable ? 'pointer' : 'default',
                    }}
                    preserveAspectRatio="none"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleClick}
                >
                    <defs>
                        <linearGradient id={`chartGradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Area */}
                    <path d={areaPath} fill={`url(#chartGradient-${color})`} />

                    {/* Line */}
                    <path
                        d={linePath}
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />

                    {/* Hover point indicator */}
                    {hoveredPoint !== null && (
                        <circle
                            cx={(hoveredPoint / (filteredData.length - 1)) * width}
                            cy={height - ((filteredData[hoveredPoint].value - min) / range) * height * 0.8 - 20}
                            r="6"
                            fill={color}
                            stroke="white"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                        />
                    )}
                </svg>

                {/* Tooltip */}
                {hoveredPoint !== null && tooltipPosition && (
                    <div style={{
                        position: 'absolute',
                        left: `${tooltipPosition.x}px`,
                        top: `${tooltipPosition.y - 60}px`,
                        transform: 'translateX(-50%)',
                        background: 'rgba(0, 0, 0, 0.9)',
                        color: 'white',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        zIndex: 1000,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                            {formatValue(filteredData[hoveredPoint].value)}
                        </div>
                        <div style={{ color: '#a1a1aa', fontSize: '11px' }}>
                            {formatDate(filteredData[hoveredPoint].timestamp)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
