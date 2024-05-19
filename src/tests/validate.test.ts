import {Block} from '../interfaces';
import {broadcastState, sendMessage} from '../utils';
import {dbSaveWeights} from '../db';
import wasmInit, {BlockValidator} from 'litmus-wasm';
import {jest} from '@jest/globals';
import {logValidationProgress, saveValidatorWeights, validateBlock, validateBlocks} from '../validate';

jest.mock('../utils', () => ({
    broadcastState: jest.fn(),
    sendMessage: jest.fn(),
}));
jest.mock('../db', () => ({
    dbBlockValidated: jest.fn((era) => Promise.resolve()),
    dbSaveWeights: jest.fn((era, validator, weight) => Promise.resolve())
}));
jest.mock('litmus-wasm', () => ({
    __esModule: true,
    default: jest.fn(),
    wasmInit: jest.fn<() => Promise<void>>().mockResolvedValue(),
    BlockValidator: function () {
        return {validate: jest.fn(() => true)};
    }
}));

const mockDbSaveWeights = dbSaveWeights as jest.MockedFunction<typeof dbSaveWeights>;
const sampleBlock: Block = {
    header: {
        era_id: 1,
        height: 1,
        era_end: {
            next_era_validator_weights: [
                {validator: '01ab...', weight: '1000'},
                {validator: '02cd...', weight: '2000'},
            ],
        },
    },
};

describe('Block Validation Services', () => {
    let validatorInstance: any;

    beforeAll(async () => {
        await wasmInit();
        const era_number = BigInt(1);
        const validator_weights_js_value = {'01ab...': '1000', '02cd...': '2000'};
        validatorInstance = new BlockValidator(era_number, validator_weights_js_value);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('logValidationProgress', () => {
        it('should broadcast current validation progress', () => {
            logValidationProgress(50, 100);
            expect(broadcastState).toHaveBeenCalledWith({validateProgress: 50});
        });
    });

    describe('saveValidatorWeights', () => {
        it('should save weights to the database', async () => {
            await saveValidatorWeights(sampleBlock);
            const expectedWeights = sampleBlock.header.era_end.next_era_validator_weights.map(vw => ({
                era: sampleBlock.header.era_id,
                validator: vw.validator,
                weight: vw.weight
            }));
            expect(mockDbSaveWeights).toHaveBeenCalledWith(expectedWeights);
        });

        it('should handle errors when saving weights fails', async () => {
            mockDbSaveWeights.mockRejectedValue(new Error('Database error'));
            await expect(saveValidatorWeights(sampleBlock)).rejects.toThrow('Database error');
            mockDbSaveWeights.mockClear();
        });
    });

    describe('validateBlock', () => {
        it('should handle errors when saving weights fails', async () => {
            mockDbSaveWeights.mockRejectedValue(new Error('Database error'));
            const context = {validatedCount: 0, totalBlocks: 1};
            await expect(validateBlock(sampleBlock, 1, {'01ab...': '1000', '02cd...': '2000'}))
                .rejects.toThrow('Database error');
            expect(mockDbSaveWeights).toHaveBeenCalled();
            expect(context.validatedCount).toBe(0);
            mockDbSaveWeights.mockClear();
        });
    });

    describe('validateBlocks', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            mockDbSaveWeights.mockImplementation(() => {
                throw new Error('Failed to save weights for block with era_id 1');
            });
        });

        it('should process all blocks without errors', async () => {
            mockDbSaveWeights.mockResolvedValueOnce();
            const blocks = [sampleBlock];
            await validateBlocks(blocks);
            expect(mockDbSaveWeights).toHaveBeenCalledTimes(1);
        });

        it('should handle and broadcast validation errors', async () => {
            const blocks = [sampleBlock];
            await expect(validateBlocks(blocks)).rejects.toThrow('Failed to save weights for block with era_id 1');
        });

        it('should update validation progress correctly when all blocks are processed', async () => {
            const blocks = [sampleBlock, sampleBlock];
            mockDbSaveWeights.mockResolvedValue();
            await validateBlocks(blocks);
            expect(broadcastState).toHaveBeenLastCalledWith({validateProgress: 100});
        });
    });
});
