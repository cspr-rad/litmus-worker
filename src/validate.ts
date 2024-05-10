import {Block, ValidatorWeight} from './interfaces';
import {broadcastState, sendMessage} from './utils';
import {dbBlockValidated, dbSaveWeights} from './db';
import wasmInit, {BlockValidator} from 'litmus-wasm';

// Initialize WebAssembly
await wasmInit();

// Log validation progress
function logValidationProgress(validatedCount: number, totalBlocks: number): void {
    const progress = (validatedCount / totalBlocks) * 100;
    broadcastState({validateProgress: progress});
}

// Save validator weights to the database
async function saveValidatorWeights(block: Block): Promise<void> {
    const validatorWeights = block.header.era_end.next_era_validator_weights.map(
        (validatorWeight: ValidatorWeight) => ({
            era: block.header.era_id,
            validator: validatorWeight.validator,
            weight: validatorWeight.weight
        })
    );
    await dbSaveWeights(validatorWeights);
}

// Validate a single block
async function validateBlock(currentBlock: Block, previousSwitchBlock: Block): Promise<void> {
    const blockValidator = new BlockValidator(previousSwitchBlock);
    blockValidator.validate(currentBlock);
}

// Validate a single block with the previous switch block and save to db
async function validateBlockWithPrevious(
    currentBlock: Block,
    previousSwitchBlock: Block
): Promise<void> {
    await validateBlock(currentBlock, previousSwitchBlock);
    await dbBlockValidated(currentBlock.header.era_id);
}

// Validate a list of blocks
export async function validateBlocks(blocks: Block[]): Promise<void> {
    if (blocks.length < 2) {
        console.log('Insufficient blocks to validate.');
        return;
    }
    try {
        let validatedCount = 0;
        let previousSwitchBlock = blocks[0];

        // Save the first block as validated, as it's a trusted block
        await dbBlockValidated(previousSwitchBlock.header.era_id);
        validatedCount++;
        logValidationProgress(validatedCount, blocks.length);

        // Iterate over remaining blocks for validation
        for (let i = 1; i < blocks.length; i++) {
            const currentBlock = blocks[i];

            // Validate the current block
            await validateBlockWithPrevious(currentBlock, previousSwitchBlock);
            validatedCount++;
            logValidationProgress(validatedCount, blocks.length);

            // Save validator weights for the current block
            await saveValidatorWeights(currentBlock);

            // Update previous switch block reference
            previousSwitchBlock = currentBlock;
        }

        console.log(`${blocks.length} blocks validated and updated in the database. Validator weights have been saved.`);
    } catch (error) {
        sendMessage('LM_MESSAGE', {
            type: 'error',
            text: 'Error during block validation.'
        },);
        throw new Error(
            `Error during block validation::
            ${error instanceof Error ? error.message : String(error)}`
        );
    }
}
