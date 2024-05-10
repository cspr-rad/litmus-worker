import {SwitchBlockHeight} from './interfaces';
import {getSwitchBlocksHeights, getTrustedBlock, getBlocks} from './fetch';
import {setListeners} from './listeners';
import {broadcastState, sendMessage} from './utils';
import {validateBlocks} from './validate';
import {findLastValidated, saveSwitchBlocks} from './db';

// Set up message listeners for the worker
setListeners(main);

export let currentState = {
    trustedHash: null,
    status: 'idle',
    fetchProgress: 0,
    validateProgress: 0,
};

// Validation process
async function main(trustedBlockHash: string): Promise<void> {
    try {
        // Fetch the starting era from the trusted block
        const startEra: number = await getTrustedBlock(trustedBlockHash).catch((error) => {
            sendMessage('LM_MESSAGE', {
                type: 'error',
                text: 'Can\'t get switch block height from specified hash'
            },);
            throw new Error(error.message);
        });

        // Determine the era to start from
        const lastValidated: SwitchBlockHeight | null = await findLastValidated(startEra);
        const initialEra = lastValidated ? lastValidated.era + 1 : startEra;

        if (lastValidated) {
            console.log('Last validated era:', lastValidated);
        }

        // Fetch switch blocks starting from the initial era
        const switchBlocks: SwitchBlockHeight[] = await getSwitchBlocksHeights(initialEra);
        if (switchBlocks.length) {
            broadcastState({status: 'processing'});

            // Save switch blocks and validate them
            await saveSwitchBlocks(switchBlocks);
            const blocks = await getBlocks(switchBlocks);
            await validateBlocks(blocks);
        } else {
            console.log('No new switch blocks to validate.');
        }

        broadcastState({status: 'completed'});
        sendMessage('LM_MESSAGE', {type: 'info', text: 'Validation completed'});
    } catch (error) {
        sendMessage('LM_MESSAGE', {
            type: 'error',
            text: 'An error occurred during the validation process'
        },);
        throw new Error(`${error instanceof Error ? error.message : String(error)}`);
    }
}
