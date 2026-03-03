import React from 'react';
import { Settings, ArrowUp } from 'lucide-react';
import styles from '../../components/Chat/WelcomeScreen.module.css';

interface ActionButtonsProps {
  opacity: number;
  x: number;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ opacity, x }) => {
  return (
    <div
      style={{
        opacity,
        transform: `translateX(${x}px)`,
        position: 'absolute',
        right: '20px',
        bottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 40
      }}
    >
      {/* Settings Button */}
      <div
        className={styles.settingsButton}
        style={{
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          background: 'rgba(30, 30, 35, 0.2)',
          border: '0.5px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(20px) saturate(180%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#a1a1aa'
        }}
      >
        <Settings size={18} />
      </div>

      {/* Send Button */}
      <div
        className={styles.sendButton}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '0.5px solid rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(20px) saturate(180%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#a1a1aa'
        }}
      >
        <ArrowUp size={20} strokeWidth={2.5} />
      </div >
    </div >
  );
};
