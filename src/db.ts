import Dexie from 'dexie';
import { Block, LitmusDatabase, SwitchBlockHeight, ValidatorWeight, ValidatorWeightRecord } from './interfaces';

// Initialize the database
const db = new Dexie('LitmusDatabase');
db.version(1).stores({
    switch_blocks: 'era, block_height, validated',
    validator_weights: '[era+validator], weight',
    state_store: 'id'
});
const litmusDb = db as LitmusDatabase;

// Save current state to a database
export async function saveCurrentState(state: any): Promise<void> {
    await db.table('state_store').put({ id: 'currentState', state });
}

// Get current state
export async function getCurrentState(property?: string): Promise<any> {
    const result = await db.table('state_store').get('currentState');
    if (result) {
        return property ? result.state[property] : result.state;
    }
    return null;
}

// Update a property in the current state
export async function updateCurrentStateProps(updates: Record<string, number|string|null|Block>): Promise<void> {
    const currentState = await getCurrentState() || {};
    for (const [key, value] of Object.entries(updates)) {
        currentState[key] = value;
    }
    await saveCurrentState(currentState);
}

// Count of records in validator_weights
export function getValidatorWeightsCount(): Promise<number> {
    return litmusDb.validator_weights.count();
}

// Save switch blocks to the database
export async function saveSwitchBlocks(switchBlocks: SwitchBlockHeight[]): Promise<void> {
    await litmusDb.switch_blocks.bulkPut(switchBlocks);
}

// Find the last validated switch block
export async function findLastValidated(): Promise<SwitchBlockHeight | null> {
    const lastValidated = await litmusDb.switch_blocks
        .where('validated')
        .equals(1)
        .reverse()
        .first();
    return lastValidated || null;
}

// Mark a block as validated in the database
export async function dbBlockValidated(era: number): Promise<void> {
    await litmusDb.switch_blocks.update(era, { validated: 1 });
}

// Save validator weights to the database
export async function dbSaveWeights(validatorWeights: ValidatorWeight[]): Promise<void> {
    await litmusDb.validator_weights.bulkPut(validatorWeights);
}
