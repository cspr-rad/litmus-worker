import { getBlockByHeight, getLastBlock } from './fetch';
import { calculateETA, isSwitchBlock, logValidationProgress, saveAndBroadcast } from './utils';
import { Block, ProcessContext, SwitchBlockHeight } from './interfaces';
import { MAX_BLOCKS_PER_ERA } from './constants';
import { getCurrentState, saveSwitchBlocks } from './db';

// Get the last switch block
export async function getLastSwitchBlock(): Promise<Block> {
    const lastBlock = await getLastBlock();
    if (isSwitchBlock(lastBlock)) return lastBlock;

    const currentEraId = lastBlock.header.era_id;
    const lastSwitchBlock = await findSwitchBlock(
        currentEraId - 1,
        lastBlock.header.height - MAX_BLOCKS_PER_ERA,
        lastBlock.header.height
    );
    if (!lastSwitchBlock) {
        throw new Error('Last switch block not found ');
    }
    return lastSwitchBlock;
}

// Binary search for switch blocks
async function findSwitchBlock(targetEraId: number, startHeight: number, endHeight: number): Promise<Block | null> {
    let foundSwitchBlock: Block | null = null;
    while (startHeight <= endHeight) {
        const midHeight = Math.floor((startHeight + endHeight) / 2);
        const midBlock = await getBlockByHeight(midHeight);

        if (midBlock.header.era_id < targetEraId) {
            startHeight = midHeight + 1;
        } else if (midBlock.header.era_id > targetEraId) {
            endHeight = midHeight - 1;
        } else {
            if (isSwitchBlock(midBlock)) {
                foundSwitchBlock = midBlock;
                break;
            } else {
                startHeight = midHeight + 1;
            }
        }
    }
    return foundSwitchBlock;
}

// Retrieve switch blocks heights starting from a given era
export async function getSwitchBlocks(startEra: SwitchBlockHeight): Promise<Block[]> {
    const firstSwitchBlock = await getBlockByHeight(startEra.block_height);
    const lastBlock = await getLastBlock();
    await saveSwitchBlocks([{
        era: firstSwitchBlock.header.era_id,
        block_height: firstSwitchBlock.header.height,
        validated: 1
    }]);
    const switchBlocks: Block[] = [firstSwitchBlock];
    let currentEraId = startEra.era + 1;
    let startHeight = startEra.block_height + 1;
    const context: ProcessContext = {
        total_blocks: lastBlock.header.era_id - startEra.era,
        processed_count: 1,
        average_time_per_block: 0,
        start_time: Date.now(),
    };
    await saveAndBroadcast({ last_block: lastBlock, blocks_to_process: context.total_blocks });
    await logValidationProgress(context.processed_count, context.total_blocks, calculateETA(context), 'fetch');

    while (true) {
        if ((await getCurrentState('status')) !== 'processing') {
            throw new Error( 'Current state changed without finishing the fetching task.');
        }
        const switchBlock = await findSwitchBlock(
            currentEraId,
            startHeight,
            lastBlock.header.height
        );
        if (!switchBlock) break;
        switchBlocks.push(switchBlock);
        await saveSwitchBlocks([{
            era: switchBlock.header.era_id,
            block_height: switchBlock.header.height,
            validated: 0
        }
        ]);
        context.processed_count++;
        await logValidationProgress(context.processed_count, context.total_blocks, calculateETA(context), 'fetch');
        startHeight = switchBlock.header.height + 1;
        currentEraId++;
    }
    return switchBlocks;
}