import Dexie from "dexie";
import {LitmusDatabase, SwitchBlockHeight, ValidatorWeight} from "./interfaces";
import {sendMessage} from "./utils";

// Initialize the database
const db = new Dexie('LitmusDatabase');
db.version(1).stores({
    switch_blocks: 'era, block_height, validated',
    validator_weights: '[era+validator], weight'
});
const litmusDb = db as LitmusDatabase;

// Save switch blocks to the database
export async function saveSwitchBlocks(switchBlocks: SwitchBlockHeight[]): Promise<void> {
    try {
        await litmusDb.switch_blocks.bulkPut(switchBlocks);
        console.log('Switch block heights saved to database.');
    } catch (error) {
        sendMessage('LM_MESSAGE', {
            type: 'error',
            text: 'Error saving switch block heights to database.'
        },);
        throw new Error(
            `Failed to save switch block heights:
            ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

// Find the last validated switch block
export async function findLastValidated(era: number): Promise<SwitchBlockHeight | null> {
    try {
        const lastValidated = await litmusDb.switch_blocks
            .where('validated')
            .equals(1)
            .and(block => block.era > era)
            .reverse()
            .first();
        return lastValidated || null;
    } catch (error) {
        sendMessage('LM_MESSAGE', {
            type: 'error',
            text: 'Error finding last validated switch block for era ' + era
        },);
        throw new Error(
            `Failed to find last validated switch block for era ${era}:
            ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

// Mark a block as validated in the database
export async function dbBlockValidated(era: number): Promise<void> {
    try {
        const updated = await litmusDb.switch_blocks.update(era, {validated: 1});
        if (updated) {
            console.log(`Block for era ${era} marked as validated.`);
        } else {
            console.warn(`No block found for era ${era} to update.`);
        }
    } catch (error) {
        sendMessage('LM_MESSAGE', {
            type: 'error',
            text: 'Error marking block as validated for era ' + era
        },);
        throw new Error(
            `Failed to mark block as validated for era ${era}:
            ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

// Save validator weights to the database
export async function dbSaveWeights(validatorWeights: ValidatorWeight[]): Promise<void> {
    try {
        await litmusDb.validator_weights.bulkPut(validatorWeights);
        console.log('Validator weights saved to database.');
    } catch (error) {
        sendMessage('LM_MESSAGE', {
            type: 'error',
            text: 'Error saving validator weights to database.'
        },);
        throw new Error(
            `Failed to save validator weights:
            ${error instanceof Error ? error.message : String(error)}`
        );
    }
}
