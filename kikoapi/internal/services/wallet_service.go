package services

import "context"

// WalletService provides wallet/balance operations. Stub until Privy/wallet backend is wired.
type WalletService struct{}

// GetBalance returns native and optional token balances. Stub: returns nil.
func (w *WalletService) GetBalance(ctx context.Context, userID, chainID string) (native string, tokens map[string]string, err error) {
	_ = ctx
	_ = userID
	_ = chainID
	return "", nil, nil
}

// GetAddress returns the wallet address for the user. Stub: returns empty.
func (w *WalletService) GetAddress(ctx context.Context, userID string, chainID int) (string, error) {
	_ = ctx
	_ = userID
	_ = chainID
	return "", nil
}
