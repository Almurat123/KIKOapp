import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle, CandlestickSeries, AreaSeries, LineSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

export interface ChartData {
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

/**
 * Format price with appropriate precision based on price value
 * - Prices >= 1: 2-4 decimal places
 * - Prices < 1: 6-8 decimal places
 * - Prices < 0.01: 8-10 decimal places
 */
function formatPrice(price: number): string {
    if (isNaN(price) || !isFinite(price)) return '0.00';
    if (price >= 1) {
        if (price >= 1000) return price.toFixed(2);
        if (price >= 100) return price.toFixed(3);
        return price.toFixed(4);
    } else if (price >= 0.01) {
        return price.toFixed(6);
    } else if (price >= 0.0001) {
        return price.toFixed(8);
    } else {
        return price.toFixed(10);
    }
}

/**
 * Normalize time value to Unix timestamp in seconds
 */
function normalizeTime(time: string | number): number | null {
    if (typeof time === 'number') {
        // If timestamp is in milliseconds (> 1e12), convert to seconds
        if (time > 1e12) {
            return Math.floor(time / 1000);
        }
        return Math.floor(time);
    } else if (typeof time === 'string') {
        const parsed = Math.floor(new Date(time).getTime() / 1000);
        if (!isNaN(parsed) && isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}

/**
 * Validate and normalize chart data with enhanced validation and outlier detection
 */
function normalizeChartData(data: ChartData[]): ChartData[] {
    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    const normalized: ChartData[] = [];
    const seenTimes = new Set<number>();
    let invalidCount = 0;
    let duplicateCount = 0;
    let outlierCount = 0;

    // First pass: collect valid candles and calculate statistics for outlier detection
    const validCandles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> = [];

    for (const item of data) {
        if (!item || typeof item !== 'object') {
            invalidCount++;
            continue;
        }

        const time = normalizeTime(item.time);
        if (time === null) {
            invalidCount++;
            continue;
        }

        // Skip duplicates (keep the latest one)
        if (seenTimes.has(time)) {
            duplicateCount++;
            // Replace existing candle with same time
            const existingIndex = validCandles.findIndex(c => c.time === time);
            if (existingIndex >= 0) {
                validCandles.splice(existingIndex, 1);
            }
        }
        seenTimes.add(time);

        const open = Number(item.open);
        const high = Number(item.high);
        const low = Number(item.low);
        const close = Number(item.close);
        const volume = item.volume !== undefined ? Number(item.volume) : 0;

        // Validate numbers are finite and positive
        if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) {
            invalidCount++;
            continue;
        }

        if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
            invalidCount++;
            continue;
        }

        // Validate time is reasonable (between 2000 and 2100)
        if (time < 946684800 || time > 4102444800) {
            invalidCount++;
            continue;
        }

        // Validate volume is non-negative
        if (!isFinite(volume) || volume < 0) {
            invalidCount++;
            continue;
        }

        // Strict OHLC validation and auto-correction
        const maxPrice = Math.max(open, high, low, close);
        const minPrice = Math.min(open, high, low, close);

        // High must be >= max(open, close, low)
        let correctedHigh = Math.max(high, maxPrice);
        // Low must be <= min(open, close, high)
        let correctedLow = Math.min(low, minPrice);

        // Final validation: high must be >= low
        if (correctedHigh < correctedLow - 0.00000001) {
            invalidCount++;
            continue;
        }

        validCandles.push({
            time,
            open,
            high: correctedHigh,
            low: correctedLow,
            close,
            volume: isFinite(volume) ? volume : 0,
        });
    }

    if (validCandles.length === 0) {
        console.warn('[normalizeChartData] No valid candles after validation');
        return [];
    }

    // Sort by time
    validCandles.sort((a, b) => a.time - b.time);

    // Second pass: detect and filter outliers (price changes > 50% from previous candle)
    const PRICE_CHANGE_THRESHOLD = 0.5; // 50% change threshold

    for (let i = 0; i < validCandles.length; i++) {
        const candle = validCandles[i];
        let isOutlier = false;

        // Check against previous candle
        if (i > 0) {
            const prevCandle = validCandles[i - 1];
            const priceChange = Math.abs((candle.close - prevCandle.close) / prevCandle.close);

            // If price change is > 50%, mark as suspicious but don't reject
            // (could be legitimate market movement, but log it)
            if (priceChange > PRICE_CHANGE_THRESHOLD) {
                console.warn(`[normalizeChartData] Large price movement detected at index ${i}: ${(priceChange * 100).toFixed(2)}% (${prevCandle.close} -> ${candle.close})`);
                // Don't filter out, but mark for review
            }
        }

        // Check for zero-volume candles (might indicate data quality issues)
        if (candle.volume === 0 && i > 0) {
            // Check if this is unusual (most candles have volume)
            const hasVolumeCount = validCandles.filter(c => c.volume > 0).length;
            const volumeRatio = hasVolumeCount / validCandles.length;
            if (volumeRatio > 0.8) {
                // Most candles have volume, this zero-volume candle might be suspicious
                // But don't filter it out - some legitimate candles can have zero volume
            }
        }

        if (!isOutlier) {
            normalized.push({
                time: candle.time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume,
            });
        } else {
            outlierCount++;
        }
    }

    // Final validation: ensure chronological order
    normalized.sort((a, b) => (a.time as number) - (b.time as number));

    if (invalidCount > 0 || duplicateCount > 0 || outlierCount > 0) {
        console.log(`[normalizeChartData] Filtered: ${invalidCount} invalid, ${duplicateCount} duplicates, ${outlierCount} outliers. Returning ${normalized.length} valid candles`);
    }

    return normalized;
}

interface TradingViewChartProps {
    data: ChartData[];
    chartType?: 'candle' | 'area' | 'line';
    symbol?: string;
    colors?: {
        backgroundColor?: string;
        lineColor?: string;
        textColor?: string;
        areaTopColor?: string;
        areaBottomColor?: string;
    };
    height?: number;
}


const TIMEZONES = [
    { label: '(UTC-10) Honolulu', value: 'Pacific/Honolulu' },
    { label: '(UTC-9) Anchorage', value: 'America/Anchorage' },
    { label: '(UTC-8) Los Angeles', value: 'America/Los_Angeles' },
    { label: '(UTC-8) Vancouver', value: 'America/Vancouver' },
    { label: '(UTC-7) Denver', value: 'America/Denver' },
    { label: '(UTC-6) Chicago', value: 'America/Chicago' },
    { label: '(UTC-6) Mexico City', value: 'America/Mexico_City' },
    { label: '(UTC-5) New York', value: 'America/New_York' },
    { label: '(UTC-5) Toronto', value: 'America/Toronto' },
    { label: '(UTC-4) Santiago', value: 'America/Santiago' },
    { label: '(UTC-3) Sao Paulo', value: 'America/Sao_Paulo' },
    { label: '(UTC) London', value: 'Europe/London' },
    { label: '(UTC+1) Paris', value: 'Europe/Paris' },
    { label: '(UTC+1) Berlin', value: 'Europe/Berlin' },
    { label: '(UTC+2) Cairo', value: 'Africa/Cairo' },
    { label: '(UTC+2) Johannesburg', value: 'Africa/Johannesburg' },
    { label: '(UTC+3) Moscow', value: 'Europe/Moscow' },
    { label: '(UTC+3) Dubai', value: 'Asia/Dubai' },
    { label: '(UTC+4) Baku', value: 'Asia/Baku' },
    { label: '(UTC+5) Karachi', value: 'Asia/Karachi' },
    { label: '(UTC+5:30) Kolkata', value: 'Asia/Kolkata' },
    { label: '(UTC+6) Almaty', value: 'Asia/Almaty' },
    { label: '(UTC+7) Bangkok', value: 'Asia/Bangkok' },
    { label: '(UTC+7) Jakarta', value: 'Asia/Jakarta' },
    { label: '(UTC+8) Shanghai', value: 'Asia/Shanghai' },
    { label: '(UTC+8) Singapore', value: 'Asia/Singapore' },
    { label: '(UTC+8) Taipei', value: 'Asia/Taipei' },
    { label: '(UTC+8) Hong Kong', value: 'Asia/Hong_Kong' },
    { label: '(UTC+9) Tokyo', value: 'Asia/Tokyo' },
    { label: '(UTC+9) Seoul', value: 'Asia/Seoul' },
    { label: '(UTC+10) Sydney', value: 'Australia/Sydney' },
    { label: '(UTC+12) Auckland', value: 'Pacific/Auckland' },
];

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
    data,
    chartType = 'candle',
    symbol = 'BTC',
    height = 400,
    colors,
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<any> | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const fitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const requestIdRef = useRef<number>(0);
    const isUpdatingRef = useRef<boolean>(false);
    const crosshairUnsubscribeRef = useRef<(() => void) | null>(null);
    const [tooltip, setTooltip] = useState<ChartData & { change?: number, changePercent?: number } | null>(null);

    // Timezone State
    const [timezone, setTimezone] = useState(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch (e) {
            return 'Asia/Shanghai';
        }
    });
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showTimezoneMenu, setShowTimezoneMenu] = useState(false);

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Initialize chart (only once) - don't recreate on data/type changes
    useEffect(() => {
        // Prevent re-initialization if chart already exists
        if (!chartContainerRef.current || chartRef.current) {
            return;
        }

        try {
            const bgColor = colors?.backgroundColor || '#FFFFFF';
            const textColor = colors?.textColor || '#131722';
            const isDark = bgColor !== '#FFFFFF' && bgColor !== '#ffffff';
            const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#F0F3FA';
            const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#E0E3EB';
            const crosshairColor = isDark ? 'rgba(255, 255, 255, 0.3)' : '#9598A1';

            const chart = createChart(chartContainerRef.current, {
                layout: {
                    background: { type: ColorType.Solid, color: bgColor },
                    textColor: textColor,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
                    fontSize: 11,
                },
                width: chartContainerRef.current.clientWidth,
                height: height,
                grid: {
                    vertLines: { color: gridColor },
                    horzLines: { color: gridColor },
                },
                crosshair: {
                    mode: CrosshairMode.Normal,
                    vertLine: {
                        width: 1,
                        color: crosshairColor,
                        style: LineStyle.Dashed,
                        labelBackgroundColor: isDark ? '#1f1f23' : '#131722',
                    },
                    horzLine: {
                        width: 1,
                        color: crosshairColor,
                        style: LineStyle.Dashed,
                        labelBackgroundColor: isDark ? '#1f1f23' : '#131722',
                    },
                },
                rightPriceScale: {
                    borderColor: borderColor,
                    visible: true,
                    borderVisible: true,
                    alignLabels: true,
                    entireTextOnly: true,
                    scaleMargins: {
                        top: 0.1,
                        bottom: 0.1,
                    },
                },
                timeScale: {
                    borderColor: borderColor,
                    visible: true,
                    borderVisible: true,
                    timeVisible: true,
                    secondsVisible: false,
                    rightOffset: 12,
                },
                handleScroll: {
                    mouseWheel: true,
                    pressedMouseMove: true,
                    horzTouchDrag: true,
                    vertTouchDrag: false,
                },
                handleScale: {
                    axisPressedMouseMove: true,
                    mouseWheel: true,
                    pinch: true,
                },
            });

            chartRef.current = chart;

            // Setup resize observer
            if (chartContainerRef.current) {
                resizeObserverRef.current = new ResizeObserver(() => {
                    if (chartRef.current && chartContainerRef.current) {
                        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
                    }
                });
                resizeObserverRef.current.observe(chartContainerRef.current);
            }

            // Cleanup function - only run on actual unmount
            return () => {
                console.log('[TradingViewChart] Cleaning up chart instance');

                // Cancel any pending updates and timeouts
                if (updateTimeoutRef.current) {
                    clearTimeout(updateTimeoutRef.current);
                    updateTimeoutRef.current = null;
                }

                if (fitTimeoutRef.current) {
                    clearTimeout(fitTimeoutRef.current);
                    fitTimeoutRef.current = null;
                }

                // Unsubscribe from crosshair events
                if (crosshairUnsubscribeRef.current) {
                    try {
                        crosshairUnsubscribeRef.current();
                    } catch (unsubError) {
                        console.warn('[TradingViewChart] Error unsubscribing crosshair:', unsubError);
                    }
                    crosshairUnsubscribeRef.current = null;
                }

                // Disconnect resize observer
                if (resizeObserverRef.current) {
                    try {
                        resizeObserverRef.current.disconnect();
                    } catch (disconnectError) {
                        console.warn('[TradingViewChart] Error disconnecting resize observer:', disconnectError);
                    }
                    resizeObserverRef.current = null;
                }

                // Remove series before removing chart
                if (seriesRef.current && chartRef.current) {
                    try {
                        chartRef.current.removeSeries(seriesRef.current);
                    } catch (removeSeriesError) {
                        console.warn('[TradingViewChart] Error removing series:', removeSeriesError);
                    }
                    seriesRef.current = null;
                }

                // Remove chart instance
                if (chartRef.current) {
                    try {
                        chartRef.current.remove();
                    } catch (removeError) {
                        console.warn('[TradingViewChart] Error removing chart:', removeError);
                    }
                    chartRef.current = null;
                }

                // Reset state
                isUpdatingRef.current = false;
                requestIdRef.current = 0;
                setTooltip(null);

                console.log('[TradingViewChart] Chart cleanup completed');
            };
        } catch (error) {
            console.error('[TradingViewChart] Error creating chart:', error);
        }
    }, []); // Only run once

    // Update series type when chartType changes or when we have data
    useEffect(() => {
        if (!chartRef.current) return;

        // Cancel any pending updates
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
            updateTimeoutRef.current = null;
        }

        // Don't update if already updating
        if (isUpdatingRef.current) {
            console.log('[TradingViewChart] Skipping series update - already updating');
            return;
        }

        try {
            isUpdatingRef.current = true;

            // Remove old series
            if (seriesRef.current && chartRef.current) {
                try {
                    chartRef.current.removeSeries(seriesRef.current);
                } catch (removeError) {
                    console.warn('[TradingViewChart] Error removing series:', removeError);
                }
                seriesRef.current = null;
            }

            // Create new series
            if (!chartRef.current) {
                isUpdatingRef.current = false;
                return;
            }

            const lineColor = colors?.lineColor || '#2962FF';
            const areaTopColor = colors?.areaTopColor || 'rgba(41, 98, 255, 0.3)';
            const areaBottomColor = colors?.areaBottomColor || 'rgba(41, 98, 255, 0.0)';

            let series: ISeriesApi<any>;
            if (chartType === 'area') {
                series = chartRef.current.addSeries(AreaSeries, {
                    lineColor: lineColor,
                    topColor: areaTopColor,
                    bottomColor: areaBottomColor,
                    lineWidth: 2,
                });
            } else if (chartType === 'line') {
                series = chartRef.current.addSeries(LineSeries, {
                    color: lineColor,
                    lineWidth: 2,
                });
            } else {
                // Candlestick colors - use green/red for up/down
                series = chartRef.current.addSeries(CandlestickSeries, {
                    upColor: '#089981',
                    downColor: '#F23645',
                    borderUpColor: '#089981',
                    borderDownColor: '#F23645',
                    wickUpColor: '#089981',
                    wickDownColor: '#F23645',
                    priceFormat: {
                        type: 'price',
                        precision: 10,
                        minMove: 0.00000001,
                    },
                });
            }

            seriesRef.current = series;
            console.log('[TradingViewChart] Series created successfully');
        } catch (error) {
            console.error('[TradingViewChart] Error updating series:', error);
        } finally {
            isUpdatingRef.current = false;
        }
    }, [chartType, colors, data.length]); // Add data.length to trigger series creation when data arrives

    // Update data when data prop changes
    useEffect(() => {
        // Don't update if chart is not initialized
        if (!chartRef.current) {
            console.log('[TradingViewChart] Chart not initialized yet, skipping data update');
            return;
        }

        // Cancel any pending updates
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
            updateTimeoutRef.current = null;
        }

        // Debounce rapid updates
        updateTimeoutRef.current = setTimeout(() => {
            // Double-check chart and series still exist
            if (!chartRef.current) {
                console.warn('[TradingViewChart] Chart was removed during debounce, skipping update');
                if (updateTimeoutRef.current) {
                    clearTimeout(updateTimeoutRef.current);
                    updateTimeoutRef.current = null;
                }
                return;
            }

            // If series doesn't exist, we need to create it first (handled by series type effect)
            if (!seriesRef.current) {
                console.log('[TradingViewChart] Series not created yet, skipping data update');
                return;
            }

            // Skip if series is being updated
            if (isUpdatingRef.current) {
                console.log('[TradingViewChart] Skipping data update - series is being updated');
                return;
            }

            try {
                // Generate unique request ID for this update
                const currentRequestId = Date.now();
                requestIdRef.current = currentRequestId;

                isUpdatingRef.current = true;

                // Handle empty data gracefully
                if (!data || !Array.isArray(data) || data.length === 0) {
                    console.log(`[TradingViewChart] Empty data received, clearing chart`);

                    // Safely clear chart data
                    if (seriesRef.current) {
                        try {
                            seriesRef.current.setData([]);
                        } catch (clearError) {
                            console.warn('[TradingViewChart] Error clearing empty data:', clearError);
                            // If clearing fails, try to remove and recreate series
                            if (chartRef.current) {
                                try {
                                    chartRef.current.removeSeries(seriesRef.current);
                                    seriesRef.current = null;
                                } catch (removeError) {
                                    console.warn('[TradingViewChart] Error removing series:', removeError);
                                }
                            }
                        }
                    }

                    setTooltip(null);
                    isUpdatingRef.current = false;
                    return;
                }

                const normalizedData = normalizeChartData(data);

                console.log(`[TradingViewChart] Updating chart with ${normalizedData.length} candles (from ${data.length} raw)`);

                if (normalizedData.length === 0) {
                    console.warn(`[TradingViewChart] No valid data after normalization (had ${data.length} raw items)`);
                    if (seriesRef.current && chartRef.current) {
                        try {
                            seriesRef.current.setData([]);
                        } catch (clearError) {
                            console.warn('[TradingViewChart] Error clearing invalid data:', clearError);
                        }
                    }
                    setTooltip(null);
                    isUpdatingRef.current = false;
                    return;
                }

                // Double-check refs are still valid
                if (!chartRef.current || !seriesRef.current) {
                    console.warn('[TradingViewChart] Chart or series ref became null during update');
                    isUpdatingRef.current = false;
                    return;
                }

                const chartData = chartType === 'area' || chartType === 'line'
                    ? normalizedData.map(item => ({
                        time: item.time as number,
                        value: item.close,
                    }))
                    : normalizedData.map(item => ({
                        time: item.time as number,
                        open: item.open,
                        high: item.high,
                        low: item.low,
                        close: item.close,
                        volume: item.volume,
                    }));

                // Use requestAnimationFrame to ensure chart is ready
                requestAnimationFrame(() => {
                    // Double-check chart and series still exist
                    if (!chartRef.current || !seriesRef.current) {
                        console.warn('[TradingViewChart] Chart or series was removed during RAF, skipping update');
                        isUpdatingRef.current = false;
                        return;
                    }

                    // Check if this is still the latest request
                    if (currentRequestId !== requestIdRef.current) {
                        console.log('[TradingViewChart] Request is stale, skipping update');
                        isUpdatingRef.current = false;
                        return;
                    }

                    try {
                        // Validate chartData before setting
                        if (!chartData || chartData.length === 0) {
                            console.warn('[TradingViewChart] chartData is empty, clearing instead');
                            if (seriesRef.current && chartRef.current) {
                                seriesRef.current.setData([]);
                            }
                            setTooltip(null);
                            return;
                        }

                        // Final check before setting data
                        if (!seriesRef.current || !chartRef.current) {
                            console.warn('[TradingViewChart] Chart or series removed just before setData');
                            return;
                        }

                        seriesRef.current.setData(chartData);

                        // Fit content after a short delay to ensure data is rendered
                        if (fitTimeoutRef.current) {
                            clearTimeout(fitTimeoutRef.current);
                        }

                        fitTimeoutRef.current = setTimeout(() => {
                            // Check again before fitting
                            if (chartRef.current && currentRequestId === requestIdRef.current) {
                                try {
                                    chartRef.current.timeScale().fitContent();
                                } catch (fitError) {
                                    console.warn('[TradingViewChart] Error fitting content:', fitError);
                                }
                            }
                        }, 50);
                    } catch (setDataError: any) {
                        console.error('[TradingViewChart] Error setting data:', setDataError);

                        // Try to recover by clearing data (only if chart still exists)
                        if (seriesRef.current && chartRef.current) {
                            try {
                                seriesRef.current.setData([]);
                            } catch (clearError) {
                                console.error('[TradingViewChart] Error clearing after setData failure:', clearError);
                            }
                        }

                        setTooltip(null);
                    } finally {
                        // Always reset the updating flag
                        isUpdatingRef.current = false;
                    }
                });

                // Update tooltip
                const lastItem = normalizedData[normalizedData.length - 1];
                const prevItem = normalizedData.length > 1 ? normalizedData[normalizedData.length - 2] : lastItem;
                const change = lastItem.close - prevItem.close;
                const changePercent = prevItem.close !== 0 ? (change / prevItem.close) * 100 : 0;

                setTooltip({
                    ...lastItem,
                    change,
                    changePercent
                });
            } catch (error) {
                console.error('[TradingViewChart] Error updating data:', error);
                if (seriesRef.current && chartRef.current) {
                    try {
                        seriesRef.current.setData([]);
                    } catch (clearError) {
                        console.error('[TradingViewChart] Error clearing data:', clearError);
                    }
                }
                setTooltip(null);
                isUpdatingRef.current = false;
            }
        }, 100); // 100ms debounce

        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
                updateTimeoutRef.current = null;
            }
        };
    }, [data, chartType]);

    // Setup crosshair handler
    useEffect(() => {
        if (!chartRef.current || !seriesRef.current) return;

        const handleCrosshairMove = (param: any) => {
            if (!param || !param.time || !param.seriesData || !seriesRef.current) {
                return;
            }

            const seriesData = param.seriesData.get(seriesRef.current);
            if (seriesData) {
                let priceData: any = seriesData;
                if ('value' in seriesData) {
                    priceData = {
                        time: param.time as number,
                        open: (seriesData as any).value,
                        high: (seriesData as any).value,
                        low: (seriesData as any).value,
                        close: (seriesData as any).value,
                    };
                }
                setTooltip(priceData);
            }
        };

        try {
            const unsubscribe = chartRef.current.subscribeCrosshairMove(handleCrosshairMove);
            // subscribeCrosshairMove returns a function to unsubscribe, or void
            if (typeof unsubscribe === 'function') {
                crosshairUnsubscribeRef.current = unsubscribe;
            } else {
                // If it doesn't return a function, create a no-op cleanup
                crosshairUnsubscribeRef.current = () => { };
            }
        } catch (error) {
            console.warn('[TradingViewChart] Error subscribing to crosshair:', error);
            crosshairUnsubscribeRef.current = null;
        }

        return () => {
            if (crosshairUnsubscribeRef.current) {
                try {
                    crosshairUnsubscribeRef.current();
                } catch (error) {
                    console.warn('[TradingViewChart] Error unsubscribing crosshair in cleanup:', error);
                }
                crosshairUnsubscribeRef.current = null;
            }
        };
    }, [chartType]);

    // Update height
    useEffect(() => {
        if (chartRef.current) {
            chartRef.current.applyOptions({ height });
        }
    }, [height]);

    // Helper to get display label
    const getDisplayLabel = (tzValue: string) => {
        const found = TIMEZONES.find(tz => tz.value === tzValue);
        if (found) {
            // Extract (UTC+X) part
            const match = found.label.match(/\(UTC[+-]?\d*:?\d*\)/);
            return match ? match[0] : found.label;
        }
        // Fallback: calculate offset manually
        try {
            const date = new Date();
            const str = date.toLocaleString('en-US', { timeZone: tzValue, timeZoneName: 'shortOffset' });
            const offset = str.split(' ').pop(); // GMT+8
            return `(UTC${offset?.replace('GMT', '')})`;
        } catch (e) {
            return '(UTC)';
        }
    };

    const timeString = currentTime.toLocaleTimeString('en-GB', {
        timeZone: timezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    return (
        <div style={{ position: 'relative' }}>
            <div ref={chartContainerRef} />

            {/* Simplified Legend (Top Left) */}
            <div style={{
                position: 'absolute',
                left: '12px',
                top: '10px',
                zIndex: 20,
                fontSize: '12px',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
            }}>
                {/* Line 1: Symbol Only */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#131722' }}>{symbol}</span>
                </div>

                {/* Line 2: OHLC Values */}
                {tooltip && (
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                        <span style={{ color: '#131722' }}>O <span style={{ color: tooltip.open > tooltip.close ? '#F23645' : '#089981' }}>{formatPrice(tooltip.open)}</span></span>
                        <span style={{ color: '#131722' }}>H <span style={{ color: tooltip.open > tooltip.close ? '#F23645' : '#089981' }}>{formatPrice(tooltip.high)}</span></span>
                        <span style={{ color: '#131722' }}>L <span style={{ color: tooltip.open > tooltip.close ? '#F23645' : '#089981' }}>{formatPrice(tooltip.low)}</span></span>
                        <span style={{ color: '#131722' }}>C <span style={{ color: tooltip.open > tooltip.close ? '#F23645' : '#089981' }}>{formatPrice(tooltip.close)}</span></span>
                        {tooltip.changePercent !== undefined && (
                            <span style={{ color: tooltip.changePercent >= 0 ? '#089981' : '#F23645' }}>
                                {tooltip.changePercent >= 0 ? '+' : ''}{tooltip.changePercent.toFixed(2)}%
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Timezone Indicator & Real-time Clock (Bottom Right) */}
            <div
                style={{
                    position: 'absolute',
                    right: '12px',
                    bottom: '8px',
                    zIndex: 30,
                    fontSize: '11px',
                    color: '#5D606B',
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
                    cursor: 'pointer',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: showTimezoneMenu ? '#fff' : 'transparent',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    boxShadow: showTimezoneMenu ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                }}
                onClick={() => setShowTimezoneMenu(!showTimezoneMenu)}
            >
                <span>{timeString}</span>
                <span>{getDisplayLabel(timezone)}</span>
            </div>

            {/* Timezone Menu */}
            {showTimezoneMenu && (
                <div style={{
                    position: 'absolute',
                    right: '12px',
                    bottom: '36px',
                    zIndex: 40,
                    background: '#fff',
                    border: '1px solid #E0E3EB',
                    borderRadius: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    width: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '4px 0',
                }}>
                    {TIMEZONES.map((tz) => (
                        <div
                            key={tz.value}
                            onClick={(e) => {
                                e.stopPropagation();
                                setTimezone(tz.value);
                                setShowTimezoneMenu(false);
                            }}
                            style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                color: timezone === tz.value ? '#2962FF' : '#131722',
                                background: timezone === tz.value ? '#F0F3FA' : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'background 0.1s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#F0F3FA'}
                            onMouseLeave={(e) => e.currentTarget.style.background = timezone === tz.value ? '#F0F3FA' : 'transparent'}
                        >
                            {tz.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
