package services

import "context"

// RPCCaller calls JSON-RPC (e.g. eth_call). Used by dex and other services.
type RPCCaller interface {
	Call(ctx context.Context, chainID int, method string, params interface{}) (result []byte, err error)
}

// RPCManager holds RPC endpoints and implements RPCCaller. Stub until configured.
type RPCManager struct{}

// Call executes a JSON-RPC call. Stub: returns nil until wired.
func (m *RPCManager) Call(ctx context.Context, chainID int, method string, params interface{}) ([]byte, error) {
	_ = ctx
	_ = chainID
	_ = method
	_ = params
	return nil, nil
}
