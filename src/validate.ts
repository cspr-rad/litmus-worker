import {Block, ValidatorWeight} from './interfaces';
import {broadcastState, processInBatches, sendMessage} from './utils';
import {dbBlockValidated, dbSaveWeights} from './db';
import wasmInit, {BlockValidator} from 'litmus-wasm';

// Initialize WebAssembly
await wasmInit();

type ValidatorWeightRecord = {
    validator: string;
    weight: string;
};

type ValidatorWeightsMap = {
    [key: string]: string;
};

type ProcessContext = {
    validatedCount: number;
    totalBlocks: number;
}

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
async function validateBlock(block: Block) {
    const eraId = block.header.era_id;
    const validatorWeights = block.header.era_end.next_era_validator_weights
        .reduce<ValidatorWeightsMap>((acc, cur: ValidatorWeightRecord) => {
            acc[cur.validator] = cur.weight;
            return acc;
        }, {});

    const blockValidator = new BlockValidator(BigInt(eraId), validatorWeights);
    blockValidator.validate(block);
    await dbBlockValidated(eraId);
}

// Validate a list of blocks
export async function validateBlocks(blocks: Block[]): Promise<void> {
    try {
        const context: ProcessContext = {
            validatedCount: 0,
            totalBlocks: blocks.length
        };
        for (const block of blocks) {
            await processBlock(block, context);
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

// Process a single block
async function processBlock(block: Block, context: ProcessContext): Promise<void> {
    await validateBlock(block);
    await saveValidatorWeights(block);
    context.validatedCount++;
    logValidationProgress(context.validatedCount, context.totalBlocks);
}