import React, { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { walletApi } from '../../services/walletApi';

interface AddWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const AddWalletModal: React.FC<AddWalletModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [address, setAddress] = useState('');
    const [name, setName] = useState('');
    const [tags, setTags] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const tagsList = tags.split(',').map(t => t.trim()).filter(t => t);
            await walletApi.addWallet(address, name, tagsList);
            onSuccess();
            onClose();
            // Reset form
            setAddress('');
            setName('');
            setTags('');
        } catch (err: any) {
            console.error('Failed to add wallet:', err);
            setError(err.response?.data?.error || 'Failed to add wallet');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }}>
            <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '480px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden',
            }}>
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <h3 style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: '#1a1a1a',
                    }}>Add Wallet to Monitor</h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#666666',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#1a1a1a',
                            marginBottom: '8px',
                        }}>Wallet Address</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="0x..."
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(0, 0, 0, 0.1)',
                                fontSize: '14px',
                                fontFamily: 'monospace',
                                outline: 'none',
                                background: '#fafafa',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#1a1a1a',
                            marginBottom: '8px',
                        }}>Label / Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Smart Money 1"
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(0, 0, 0, 0.1)',
                                fontSize: '14px',
                                outline: 'none',
                                background: '#fafafa',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#1a1a1a',
                            marginBottom: '8px',
                        }}>Tags (comma separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="whale, defi, sniper"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(0, 0, 0, 0.1)',
                                fontSize: '14px',
                                outline: 'none',
                                background: '#fafafa',
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '12px',
                            borderRadius: '8px',
                            background: 'rgba(231, 76, 60, 0.1)',
                            color: '#e74c3c',
                            fontSize: '14px',
                            marginBottom: '20px',
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: '1px solid rgba(0, 0, 0, 0.1)',
                                background: 'transparent',
                                color: '#666666',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#1a1a1a',
                                color: '#ffffff',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                opacity: loading ? 0.7 : 1,
                            }}
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            Add Wallet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
