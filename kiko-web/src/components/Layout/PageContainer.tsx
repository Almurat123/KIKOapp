import React, { type ReactNode } from 'react';
import styles from './PageContainer.module.css';

interface PageContainerProps {
    children: ReactNode;
    title?: string;
    subtitle?: string;
    className?: string;
    actions?: ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({
    children,
    title,
    subtitle,
    className = '',
    actions
}) => {
    return (
        <div className={`${styles.container} ${className}`}>
            {(title || actions) && (
                <div className={styles.header}>
                    <div className={styles.titleSection}>
                        {title && <h1 className={styles.title}>{title}</h1>}
                        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                    </div>
                    {actions && <div className={styles.actions}>{actions}</div>}
                </div>
            )}
            <div className={styles.content}>
                {children}
            </div>
        </div>
    );
};

export default PageContainer;
