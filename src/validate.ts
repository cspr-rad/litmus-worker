import {Block, ValidatorWeight} from './interfaces';
import {broadcastState, processInBatches, sendMessage} from './utils';
import {dbBlockValidated, dbSaveWeights} from './db';
import wasmInit, {BlockValidator} from 'litmus-wasm';

// Initialize WebAssembly
wasmInit();

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
export function logValidationProgress(validatedCount: number, totalBlocks: number): void {
    const progress = (validatedCount / totalBlocks) * 100;
    broadcastState({validateProgress: progress});
}

// Save validator weights to the database
export async function saveValidatorWeights(block: Block): Promise<void> {
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
export async function validateBlock(block: Block) {
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
    const context: ProcessContext = {
        validatedCount: 0,
        totalBlocks: blocks.length
    };
    for (const block of blocks) {
        try {
            await processBlock(block, context);
        } catch (error) {
            sendMessage('LM_MESSAGE', {
                type: 'error',
                text: 'Error during block validation.'
            },);
            throw new Error(
                `Error during block validation:
                ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}

// Process a single block
export async function processBlock(block: Block, context: ProcessContext): Promise<void> {
    try {
        await validateBlock(block);
    } catch (error) {
        console.error('Validation failed:', error);
        throw new Error(`Validation failed for block with era_id ${block.header.era_id}`);
    }

    try {
        await saveValidatorWeights(block);
        context.validatedCount++;
        logValidationProgress(context.validatedCount, context.totalBlocks);
    } catch (error) {
        console.error('Saving weights failed:', error);
        throw new Error(`Failed to save weights for block with era_id ${block.header.era_id}`);
    }
}
