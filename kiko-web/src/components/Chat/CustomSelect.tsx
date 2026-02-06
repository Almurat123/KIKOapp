import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './CustomSelect.module.css';

interface Option {
    value: string;
    label: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    className?: string;
    triggerClassName?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    className,
    triggerClassName
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className={`${styles.container} ${className || ''}`} ref={containerRef}>
            <div
                className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''} ${triggerClassName || ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={styles.value}>
                    {selectedOption ? selectedOption.label : <span className={styles.placeholder}>{placeholder}</span>}
                </span>
                <ChevronDown size={14} className={`${styles.icon} ${isOpen ? styles.iconOpen : ''}`} />
            </div>

            {isOpen && (
                <div className={styles.dropdown}>
                    {options.map((option) => (
                        <div
                            key={option.value}
                            className={`${styles.option} ${option.value === value ? styles.optionSelected : ''}`}
                            onClick={() => handleSelect(option.value)}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
