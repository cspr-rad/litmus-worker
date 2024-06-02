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
export async function validateBlock(currentBlock: Block, eraId: number, validatorWeights: Record<string, string>): Promise<void> {
    const blockValidator = new BlockValidator(BigInt(eraId), validatorWeights);
    blockValidator.validate(currentBlock);
    await dbBlockValidated(eraId);
    await saveValidatorWeights(currentBlock);
}

// Validate a list of blocks
export async function validateBlocks(blocks: Block[]): Promise<void> {
    // Save first block as validated as it is trusted
    await dbBlockValidated(blocks[0].header.era_id);
    await saveValidatorWeights(blocks[0]);
    const context: ProcessContext = {
        validatedCount: 1,
        totalBlocks: blocks.length
    };

    for (let i = 1; i < blocks.length; i++) {
        try {
            const prevBlockValidatorWeights = blocks[i-1].header.era_end.next_era_validator_weights
                .reduce<ValidatorWeightsMap>((acc, cur: ValidatorWeightRecord) => {
                    acc[cur.validator] = cur.weight;
                    return acc;
                }, {});

            await validateBlock(blocks[i], blocks[i].header.era_id, prevBlockValidatorWeights);
            context.validatedCount++;
            logValidationProgress(context.validatedCount, context.totalBlocks);
        } catch (error) {
            sendMessage('LM_MESSAGE', {
                type: 'error',
                text: 'Error during validation of block with height ' + blocks[i].header.height
            },);
            throw new Error(
                `Error during block validation:
                ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
