import { RECOVER_BANNED_RPC_SEC, RPC_MAX_SCORE, RPC_URLS } from './constants';
import { RpcRequest } from './interfaces';
import { saveAndBroadcast } from './utils';

export let rpcScores = RPC_URLS.map(url => ({ url, score: 0 }));
export let rpcCounter = 0;

// Create an RPC request
export function createRpcRequest(method: string, params: any = []): RpcRequest {
    return {
        jsonrpc: '2.0',
        method,
        params: params,
        id: 1
    };
}

// Get an available RPC URL using round-robin selection
export async function getAvailableRpcUrl(): Promise<string> {
    const availableRpcs = rpcScores.filter(rpc => rpc.score < RPC_MAX_SCORE);
    await saveAndBroadcast({
        total_rpcs: rpcScores.length,
        available_rpcs: availableRpcs.length
    });
    if (availableRpcs.length === 0) {
        throw new Error('No available RPC nodes');
    }
    const rpc = availableRpcs[rpcCounter % availableRpcs.length];
    rpcCounter++;
    return rpc.url;
}

// Increase or set RPC score
export function increaseRpcScore(url: string): void {
    const rpc = rpcScores.find(rpc => rpc.url === url);
    if (rpc) rpc.score++;
}

// Increase or set RPC score
export function resetRpcScore(url: string): void {
    const rpc = rpcScores.find(rpc => rpc.url === url);
    if (rpc) rpc.score = 0;
}

// Ban RPC node
export function banRpc(url: string): void {
    const rpc = rpcScores.find(rpc => rpc.url === url);
    if (rpc) rpc.score = RPC_MAX_SCORE;
    setTimeout(() => resetRpcScore(url), RECOVER_BANNED_RPC_SEC * 1000);
}
