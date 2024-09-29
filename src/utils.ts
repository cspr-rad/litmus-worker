import { Block, ProcessContext } from './interfaces';
import { getCurrentState, updateCurrentStateProps } from './db';

declare const self: ServiceWorkerGlobalScope;

export function asyncDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Save and broadcast the current state
export async function saveAndBroadcast(newState?: Record<string, any>) {
    if (newState) {
        await updateCurrentStateProps(newState);
    }
    const state = await getCurrentState();
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: 'UPDATE_STATE',
                data: Object.assign({}, state)
            });
        });
    });
}

// Calculate ETA
export function calculateETA(context: ProcessContext): number {
    const elapsedTime = Date.now() - context.start_time;
    context.average_time_per_block = elapsedTime / context.processed_count;
    const remainingBlocks = context.total_blocks - context.processed_count;
    return remainingBlocks * context.average_time_per_block;
}

// Log validation progress and ETA
export async function logValidationProgress(
    validatedCount: number,
    totalBlocks: number,
    eta: number,
    operation: 'fetch' | 'validate'
): Promise<void> {
    const progress = (validatedCount / totalBlocks) * 100;
    await saveAndBroadcast({
        [`${ operation }_progress`]: progress,
        [`${ operation }_eta`]: eta,
        [`${ operation }_blocks`]: validatedCount,
    });
}

// Check if the block is a switch block
export function isSwitchBlock(block: Block): boolean {
    return !!block.header.era_end;
}

export function convertMotesToCSPR(motes: bigint): string {
    const motesPerCSPR: bigint = BigInt(10 ** 9);
    const cspr = Number(motes) / Number(motesPerCSPR);
    return cspr.toFixed(2);
}
