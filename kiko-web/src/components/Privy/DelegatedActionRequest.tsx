import React, { useState } from 'react';
import { useSessionSigners, usePrivy } from '@privy-io/react-auth';

// The Authorization Key ID from your Privy Dashboard
// This should match the PRIVY_AUTHORIZATION_KEY_ID in your backend .env
const AUTHORIZATION_KEY_ID = 'crdgro3bw07z2y27zl08yydo';

export const DelegatedActionRequest = ({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) => {
    const { addSessionSigners } = useSessionSigners();
    const { user } = usePrivy();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuthorize = async () => {
        setLoading(true);
        setError(null);
        try {
            const wallet = user?.wallet?.address;
            if (!wallet) throw new Error('No wallet connected');

            console.log('[DelegatedActionRequest] Adding session signer for wallet:', wallet);

            // Add the server's authorization key as a session signer for this wallet
            // This allows the server to sign transactions on behalf of the user
            await addSessionSigners({
                address: wallet,
                signers: [
                    {
                        signerId: AUTHORIZATION_KEY_ID,
                        policyIds: [], // Empty means all actions allowed; add specific policies if needed
                    }
                ]
            });

            console.log('[DelegatedActionRequest] Session signer added successfully');
            onSuccess();
        } catch (err: any) {
            console.error('[DelegatedActionRequest] Failed to add session signer:', err);
            setError(err.message || 'Failed to authorize');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#1E1E1E] p-6 rounded-xl max-w-md w-full border border-[#333]">
                <h3 className="text-xl font-bold text-white mb-4">授权 KiKo 代您交易</h3>
                <p className="text-gray-400 mb-6">
                    要启用即时 AI 交易，您需要授权 KiKo 为您签署交易。
                    此权限允许 AI 立即执行交易，无需每次都征求您的确认。
                </p>

                {error && (
                    <div className="bg-red-500/10 text-red-500 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleAuthorize}
                        disabled={loading}
                        className="px-4 py-2 bg-[#00A3FF] hover:bg-[#0082CC] text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {loading ? '授权中...' : '允许 / Allow'}
                    </button>
                </div>
            </div>
        </div>
    );
};
