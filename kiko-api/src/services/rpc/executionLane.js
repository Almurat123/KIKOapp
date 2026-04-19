"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferExecutionLane = inferExecutionLane;
function inferExecutionLane(method, importance) {
    if (method === 'eth_sendRawTransaction'
        || method === 'eth_sendTransaction'
        || method === 'sendTransaction'
        || method === 'eth_getTransactionByHash'
        || method === 'eth_getTransactionReceipt'
        || method === 'eth_getTransactionCount'
        || method === 'eth_estimateGas'
        || method === 'eth_feeHistory'
        || method === 'eth_gasPrice'
        || method === 'eth_maxPriorityFeePerGas') {
        return 'critical';
    }
    if (method === 'eth_call' && importance === 'critical') {
        return 'critical';
    }
    return 'cheap';
}
