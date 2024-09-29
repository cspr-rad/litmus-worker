import { banRpc, createRpcRequest, getAvailableRpcUrl, increaseRpcScore } from './rpcs';
import { Block, RpcRequest } from './interfaces';
import { asyncDelay, saveAndBroadcast } from './utils';
import { OFFLINE_DELAY_MS, RPC_PROXY_URL } from './constants';

export async function getLastBlock(): Promise<Block> {
    const rpcRequest: RpcRequest = createRpcRequest('chain_get_block');
    return await fetchFromRPC(rpcRequest) as Block;
}

export async function getBlockByHeight(height: number): Promise<Block> {
    const rpcRequest: RpcRequest = createRpcRequest(
        'chain_get_block',
        { block_identifier: { Height: height } }
    );
    return await fetchFromRPC(rpcRequest) as Block;
}

export async function getBlockByHash(hash: string): Promise<Block> {
    const rpcRequest: RpcRequest = createRpcRequest(
        'chain_get_block',
        { block_identifier: { Hash: hash } }
    );
    return await fetchFromRPC(rpcRequest) as Block;
}

export async function getAccountInfo(publicKey: string, blockHash: string): Promise<any> {
    const rpcRequest: RpcRequest = createRpcRequest(
        'state_get_account_info',
        {
            public_key: publicKey,
            block_identifier: { Hash: blockHash }
        }
    );
    return await fetchFromRPC(rpcRequest);
}

export async function getAccountBalanceData(balanceUref: string, stateRootHash: string): Promise<any> {
    const rpcRequest: RpcRequest = createRpcRequest(
        'query_global_state',
        {
            state_identifier: {
                StateRootHash: stateRootHash
            },
            key: balanceUref,
            path: []
        }
    );
    return await fetchFromRPC(rpcRequest);
}

export async function fetchFromRPC(rpcRequest: RpcRequest): Promise<any> {
    while (true) {
        const rpcUrl = await getAvailableRpcUrl();
        let isStopError = false;
        try {
            const response = await fetch(
                RPC_PROXY_URL ? `${ RPC_PROXY_URL }?target=${ rpcUrl }` : `http://${ rpcUrl }/rpc`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rpcRequest)
                });
            if (response.ok) {
                const data: any = await response.json();
                if (data?.error) {
                    if (data.error.code === -32001) {
                        isStopError = true;
                        const errorMessage = 'Block is too old and doesnt exist on the RPC node. Enter new trusted block.';
                        await saveAndBroadcast({
                            error: errorMessage,
                            status: 'idle',
                            trusted_block: null,
                            trusted_block_hash: null
                        });
                        throw Error(errorMessage);
                    }
                    banRpc(rpcUrl);
                } else if (data?.result?.block) {
                    return data.result.block;
                } else {
                    return data;
                }
            } else {
                increaseRpcScore(rpcUrl);
            }
        } catch (fetchError) {
            if (isStopError) {
                throw fetchError;
            }
            increaseRpcScore(rpcUrl);
        }
        if (!navigator.onLine) {
            await asyncDelay(OFFLINE_DELAY_MS);
        }
    }
}
