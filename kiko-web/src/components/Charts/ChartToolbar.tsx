import React, { useState } from 'react';
import {
    MousePointer2,
    TrendingUp,
    Minus,
    Circle,
    Square,
    Type,
    Ruler,
    Pencil,
    Eraser,
} from 'lucide-react';
import styles from './ChartToolbar.module.css';

interface ChartToolbarProps {
    onToolSelect?: (tool: string) => void;
}

export const ChartToolbar: React.FC<ChartToolbarProps> = ({ onToolSelect }) => {
    const [selectedTool, setSelectedTool] = useState('cursor');

    const tools = [
        { id: 'cursor', icon: MousePointer2, label: 'Cursor' },
        { id: 'crosshair', icon: '+', label: 'Crosshair', isText: true },
        { id: 'trendline', icon: TrendingUp, label: 'Trend Line' },
        { id: 'horizontal', icon: Minus, label: 'Horizontal Line' },
        { id: 'circle', icon: Circle, label: 'Circle' },
        { id: 'rectangle', icon: Square, label: 'Rectangle' },
        { id: 'text', icon: Type, label: 'Text' },
        { id: 'measure', icon: Ruler, label: 'Measure' },
        { id: 'draw', icon: Pencil, label: 'Draw' },
        { id: 'eraser', icon: Eraser, label: 'Eraser' },
    ];

    const handleToolClick = (toolId: string) => {
        setSelectedTool(toolId);
        onToolSelect?.(toolId);
    };

    return (
        <div className={styles.toolbar}>
            {tools.map((tool) => (
                <button
                    key={tool.id}
                    className={`${styles.toolButton} ${selectedTool === tool.id ? styles.active : ''}`}
                    onClick={() => handleToolClick(tool.id)}
                    title={tool.label}
                >
                    {tool.isText ? (
                        <span style={{ fontSize: '20px', fontWeight: 300 }}>+</span>
                    ) : (
                        <tool.icon size={18} strokeWidth={1.5} />
                    )}
                </button>
            ))}
        </div>
    );
};
