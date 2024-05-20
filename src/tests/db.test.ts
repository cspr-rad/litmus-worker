import 'fake-indexeddb/auto';
import * as db from '../db';
import {Block, SwitchBlockHeight, ValidatorWeight} from '../interfaces';
import Dexie from "dexie";

jest.mock('../utils', () => ({
    sendMessage: jest.fn(),
}));
const litmusDb = new Dexie('LitmusDatabase');
litmusDb.version(1).stores({
    switch_blocks: 'era, block_height, validated',
    validator_weights: '[era+validator], weight'
});
(db as any).litmusDb = litmusDb;

describe('saveSwitchBlocks', () => {
    it('should save switch blocks to the database', async () => {
        const switchBlocks: SwitchBlockHeight[] = [{era: 1, block_height: 1, validated: 1}];
        await expect(db.saveSwitchBlocks(switchBlocks)).resolves.toBeUndefined();
    });

    it('should throw an error if fails to save switch blocks', async () => {
        const switchBlocks: SwitchBlockHeight[] = [{era: 1, block_height: 1, validated: 1}];
        const errorMessage = 'Failed to save switch block heights';
        const mockBulkPut = jest.fn().mockRejectedValueOnce(new Error('Mock error'));
        (db as any).litmusDb.switch_blocks.bulkPut = mockBulkPut;
        try {
            await db.saveSwitchBlocks(switchBlocks);
        } catch (error: any) {
            expect(error.message).toContain(errorMessage);
        }
    });
});

describe('dbBlockValidated', () => {
    beforeEach(async () => {
        await litmusDb.table('switch_blocks').clear();
    });

    afterAll(async () => {
        await litmusDb.delete();
    });

    it('should mark the block as validated', async () => {
        await litmusDb.table('switch_blocks').add({era: 1, block_height: 100, validated: 0});
        await db.dbBlockValidated(1);
        const block = await litmusDb.table('switch_blocks').get(1);
        expect(block.validated).toBe(1);
    });
});

describe('dbSaveWeights', () => {
    it('should save validator weights to the database', async () => {
        const validatorWeights: ValidatorWeight[] = [{era: 1, validator: 'validator1', weight: '1'}];
        await expect(db.dbSaveWeights(validatorWeights)).resolves.toBeUndefined();
    });
});
