import { setListeners } from './listeners';
import { asyncDelay, isSwitchBlock, saveAndBroadcast } from './utils';
import { findLastValidated, getCurrentState } from './db';
import { getBlockByHash, getLastBlock } from './fetch';
import { Block, SwitchBlockHeight } from './interfaces';
import { getSwitchBlocks } from './fetch-blocks';
import { validateBlocks } from './validate-blocks';
import { BLOCK_CHECK_SEC } from './constants';

declare const self: ServiceWorkerGlobalScope;
setListeners();

export async function syncUpdate(): Promise<void> {
    const lastBlock = await getLastBlock();
    const lastValidated = await findLastValidated();
    await saveAndBroadcast({ last_block: lastBlock, last_validated: lastValidated });
    if (
        lastValidated &&
        (lastBlock.header.era_id > lastValidated.era + 1 || isSwitchBlock(lastBlock)) &&
        (await getCurrentState('status')) !== 'processing'
    ) {
        await fetchAndValidate();
    }

    await asyncDelay(BLOCK_CHECK_SEC * 1000);
    await (self.registration.sync as SyncManager).register('sync-fetch');
}

export async function setTrustedBlockHash(hash: string): Promise<void> {
    if (await getCurrentState('status') === 'processing') {
        return;
    }
    const block = await getBlockByHash(hash);
    if (!isSwitchBlock(block)) {
        throw new Error('Block is not a switch block');
    }
    await saveAndBroadcast({ trusted_block: block, status: 'processing', blocks_to_process: 0 });
    await fetchAndValidate(block);
    await saveAndBroadcast({ status: 'idle' });
}

export async function fetchAndValidate(trustedBlock?: Block): Promise<void> {
    const lastValidated = await findLastValidated();
    let initialEra: SwitchBlockHeight;
    await saveAndBroadcast({
        status: 'processing',
        last_validated: { era: lastValidated?.era, block_height: lastValidated?.block_height }
    });

    if (lastValidated && trustedBlock && lastValidated.era > trustedBlock.header.era_id) {
        initialEra = lastValidated;
    } else if (trustedBlock) {
        const startEra = trustedBlock.header.era_id;
        initialEra = {
            era: startEra,
            block_height: trustedBlock.header.height,
            validated: 1
        };
    } else if (lastValidated) {
        initialEra = lastValidated;
    } else {
        throw new Error('No last validated block found and no trusted block specified.');
    }

    await saveAndBroadcast({ blocks_to_process: 0 });
    const switchBlocks = await getSwitchBlocks(initialEra);
    await saveAndBroadcast({ blocks_to_process: switchBlocks.length });
    await validateBlocks(switchBlocks);
    await saveAndBroadcast({
        status: 'idle',
        fetch_progress: 0,
        validate_progress: 0,
        fetch_blocks: 0,
        validate_blocks: 0,
        info: trustedBlock ? 'Validation completed. Waiting for the new switch block.' : ''
    });
}
