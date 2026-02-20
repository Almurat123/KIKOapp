import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './CustomSelect.module.css';
import { agentAttrs } from '../../agent/attrs';

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
    agentBaseId?: string;
    agentPage?: string;
    agentKey?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    className,
    triggerClassName,
    agentBaseId,
    agentPage,
    agentKey
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
        <div
            className={`${styles.container} ${className || ''}`}
            ref={containerRef}
            {...(agentBaseId ? agentAttrs({ id: agentBaseId, role: 'list', page: agentPage || 'chat', key: agentKey }) : {})}
        >
            <div
                className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''} ${triggerClassName || ''}`}
                onClick={() => setIsOpen(!isOpen)}
                {...(agentBaseId ? agentAttrs({ id: `${agentBaseId}.trigger`, role: 'button', action: 'open', page: agentPage || 'chat', key: agentKey }) : {})}
            >
                <span className={styles.value}>
                    {selectedOption ? selectedOption.label : <span className={styles.placeholder}>{placeholder}</span>}
                </span>
                <ChevronDown size={14} className={`${styles.icon} ${isOpen ? styles.iconOpen : ''}`} />
            </div>

            {isOpen && (
                <div
                    className={styles.dropdown}
                    {...(agentBaseId ? agentAttrs({ id: `${agentBaseId}.dropdown`, role: 'list', page: agentPage || 'chat', key: agentKey }) : {})}
                >
                    {options.map((option) => (
                        <div
                            key={option.value}
                            className={`${styles.option} ${option.value === value ? styles.optionSelected : ''}`}
                            onClick={() => handleSelect(option.value)}
                            {...(agentBaseId ? agentAttrs({
                                id: `${agentBaseId}.option.${option.value.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
                                role: 'button',
                                action: 'select',
                                page: agentPage || 'chat',
                                key: agentKey
                            }) : {})}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
