import { Block, ProcessContext, ValidatorWeight, ValidatorWeightRecord, ValidatorWeightsMap } from './interfaces';
import { calculateETA, logValidationProgress, saveAndBroadcast } from './utils';
import { dbBlockValidated, dbSaveWeights, getCurrentState } from './db';
import wasmInit, { BlockValidator } from 'casper-litmus-wasm';

// Initialize WebAssembly
wasmInit();

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
export async function validateBlock(
    currentBlock: Block,
    eraId: number,
    validatorWeights: Record<string, string>
): Promise<void> {
    const blockValidator = new BlockValidator(BigInt(eraId), validatorWeights);
    blockValidator.validate(currentBlock);
    await dbBlockValidated(eraId);
    await saveValidatorWeights(currentBlock);
    await saveAndBroadcast();
}

// Validate a list of blocks
export async function validateBlocks(blocks: Block[]): Promise<void> {
    await saveValidatorWeights(blocks[0]);
    const context: ProcessContext = {
        processed_count: 1,
        total_blocks: blocks.length,
        start_time: Date.now(),
        average_time_per_block: 0
    };

    for (let i = 1; i < blocks.length; i++) {
        if ((await getCurrentState('status')) !== 'processing') {
            throw new Error( 'Current state changed without finishing the validating task.');
        }
        const prevBlockValidatorWeights = blocks[i - 1].header.era_end.next_era_validator_weights
            .reduce<ValidatorWeightsMap>((acc, cur: ValidatorWeightRecord) => {
                acc[cur.validator] = cur.weight;
                return acc;
            }, {});
        await validateBlock(blocks[i], blocks[i].header.era_id, prevBlockValidatorWeights);
        context.processed_count++;
        const eta = calculateETA(context);
        await logValidationProgress(context.processed_count, context.total_blocks, eta, 'validate');

    }
}
