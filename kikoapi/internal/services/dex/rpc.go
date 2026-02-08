package dex

import "context"

// RPCCaller calls JSON-RPC (e.g. eth_call). Implemented by rpc manager; dex only depends on this interface.
type RPCCaller interface {
	Call(ctx context.Context, chainID int, method string, params interface{}) (result []byte, err error)
}
