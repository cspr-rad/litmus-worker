import {BATCH_DELAY_MS, BATCH_SIZE, INDEXER_ERA_LIMIT, INDEXER_URL, RPC_URL} from './constants';
import {BatchContext, Block, BlockResponse, EraHeight, RpcRequest, SwitchBlockHeight} from './interfaces';
import {broadcastState, processInBatches, sendMessage} from './utils';

// Fetch the trusted block's era ID based on its hash
export async function getTrustedBlock(trustedBlockHash: string): Promise<number> {
    const rpcRequest: RpcRequest = createRpcRequest('chain_get_block', {Hash: trustedBlockHash});
    try {
        const response = await fetchWithRetry(RPC_URL, rpcRequest);
        const data: BlockResponse = await response.json();
        validateBlockResponse(data);
        if (data?.result?.block?.header?.era_id) {
            return data.result.block.header.era_id;
        }
        throw new Error('Invalid block response format');
    } catch (error) {
        sendMessage('LM_MESSAGE', {
            type: 'error',
            text: 'Error fetching trusted block. Check the provided hash.'
        },);
        throw new Error(
            `Error fetching trusted block:
            ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

// Retrieve switch blocks heights starting from a given era
export async function getSwitchBlocksHeights(startEra: number): Promise<SwitchBlockHeight[]> {
    let switchBlockHeights: SwitchBlockHeight[] = [];
    try {
        while (true) {
            const response = await fetchSwitchBlocks(startEra);
            const responseJson: EraHeight[] = await response.json();
            if (responseJson.length === 0) break;
            startEra = responseJson[responseJson.length - 1].id + 1;
            switchBlockHeights.push(...mapEraHeightsToSwitchBlocks(responseJson));
            if (responseJson.length < INDEXER_ERA_LIMIT) break;
        }

        console.log('Switch blocks fetched:', switchBlockHeights.length);
        return switchBlockHeights;
    } catch (error) {
        sendMessage('LM_MESSAGE', {
            type: 'error',
            text: 'Error fetching switch block heights.'
        },);
        throw new Error(
            `Error fetching switch block heights:
            ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

// Fetch blocks based on switch block heights
export async function getBlocks(switchBlocks: SwitchBlockHeight[]): Promise<Block[]> {
    const blocks: Block[] = [];
    const context: BatchContext = {blocks, total_blocks: switchBlocks.length};
    try {
        await processInBatches(switchBlocks, BATCH_SIZE, BATCH_DELAY_MS, fetchBlock, context);
        blocks.sort((a, b) => a.header.height - b.header.height);
        return blocks;
    } catch (error) {
        sendMessage('LM_MESSAGE', {
            type: 'error',
            text: 'Error fetching blocks.'
        },);
        throw new Error(
            `Error fetching blocks:
            ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

// Fetch a single block
async function fetchBlock(switchBlock: SwitchBlockHeight, context: BatchContext): Promise<void> {
    const rpcRequest: RpcRequest = createRpcRequest('chain_get_block', {Height: switchBlock.block_height});
    try {
        const response = await fetchWithRetry(RPC_URL, rpcRequest);
        const data = await response.json();
        if (!data.result) {
            handleRpcError(data, switchBlock.block_height);
        }
        context.blocks.push(data.result.block);
        broadcastState({fetchProgress: (context.blocks.length / context.total_blocks) * 100});
    } catch (error) {
        sendMessage('LM_MESSAGE', {
            type: 'error',
            text: `Error fetching block ${switchBlock.block_height}`
        },);
        throw new Error(
            `Error fetching block ${switchBlock.block_height}:
            ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

// Create an RPC request
function createRpcRequest(method: string, params: any): RpcRequest {
    return {
        jsonrpc: '2.0',
        method,
        params: {block_identifier: params},
        id: 1
    };
}

// Fetch with retry logic
async function fetchWithRetry(url: string, request: RpcRequest, retries = 3): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(request)
        });

        if (response.ok) return response;
        if (attempt < retries - 1) await new Promise(res => setTimeout(res, 1000));
    }
    throw new Error(`Failed to fetch after ${retries} attempts.`);
}

// Validate block response
function validateBlockResponse(data: BlockResponse): void {
    if (!data.result || !data.result.block || !data.result.block.header) {
        throw new Error('Invalid block response format');
    }
}

// Handle RPC errors
function handleRpcError(data: any, blockHeight: number): void {
    const error = data.error;
    if (error?.code === -32001) {
        const low = error?.data?.available_block_range?.low;
        if (low && low < blockHeight) {
            throw new Error(`Block ${blockHeight} not found on node. Available low: ${low}`);
        }
        throw new Error(`Block ${blockHeight} not available on this RPC node. Available low: ${low}`);
    }
    throw new Error('Invalid RPC response');
}

// Map era heights to switch blocks
function mapEraHeightsToSwitchBlocks(eraHeights: EraHeight[]): SwitchBlockHeight[] {
    return eraHeights.map(eraHeight => ({
        era: eraHeight.id,
        block_height: eraHeight.endBlock,
        validated: 0
    }));
}

// Fetch switch blocks
async function fetchSwitchBlocks(startEra: number): Promise<Response> {
    const url = `${INDEXER_URL}/era?filter=` + encodeURIComponent(JSON.stringify({
        fields: ["id", "endBlock"],
        where: {"id": {"gte": startEra}, "endBlock": {"gt": 0}},
        limit: INDEXER_ERA_LIMIT
    }));
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
}
