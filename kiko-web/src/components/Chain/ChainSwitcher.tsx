import React, { useState, useRef, useEffect } from 'react';
import { useChain } from '../../contexts/ChainContext';
import { ChevronDown, Check } from 'lucide-react';
import styles from './ChainSwitcher.module.css';

export const ChainSwitcher: React.FC = () => {
    const { currentChain, switchChain, supportedChains } = useChain();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleChainSelect = (chainId: number) => {
        switchChain(chainId);
        setIsOpen(false);
    };

    return (
        <div className={styles.container} ref={dropdownRef}>
            <button
                className={styles.trigger}
                onClick={() => setIsOpen(!isOpen)}
            >
                {currentChain.icon && <img src={currentChain.icon} alt={currentChain.name} className={styles.chainIcon} />}
                <span className={styles.chainName}>{currentChain.name}</span>
                <ChevronDown size={14} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    {supportedChains.map((chain) => (
                        <button
                            key={chain.id}
                            className={`${styles.option} ${chain.id === currentChain.id ? styles.selected : ''}`}
                            onClick={() => handleChainSelect(chain.id)}
                        >
                            <div className={styles.optionContent}>
                                {chain.icon && <img src={chain.icon} alt={chain.name} className={styles.chainIcon} />}
                                <span>{chain.name}</span>
                            </div>
                            {chain.id === currentChain.id && <Check size={14} className={styles.check} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
