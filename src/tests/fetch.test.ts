import {BlockResponse, SwitchBlockHeight, EraHeight, BatchContext} from '../interfaces';
import {sendMessage, processInBatches} from '../utils';
import {fetchBlock, fetchWithRetry, getBlocks, getSwitchBlocksHeights, getTrustedBlock} from '../fetch';

jest.mock('../utils', () => ({
    broadcastState: jest.fn(),
    sendMessage: jest.fn(),
    processInBatches: jest.fn()
}));
global.fetch = jest.fn() as jest.Mock;

describe('serviceWorker', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getTrustedBlock', () => {
        it('should fetch the trusted block and return the era ID', async () => {
            const mockBlockResponse: BlockResponse = {
                jsonrpc: '2.0',
                id: 1,
                result: {
                    block: {
                        header: {
                            era_id: 40,
                            height: 1000,
                            era_end: {
                                next_era_validator_weights: [
                                    {validator: '01ab...', weight: '1000'},
                                    {validator: '02cd...', weight: '2000'}
                                ]
                            }
                        }
                    }
                }
            };
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValueOnce(mockBlockResponse)
            });

            const eraId = await getTrustedBlock('someHash');
            expect(eraId).toBe(40);
        });

        it('should throw an error if the response format is invalid', async () => {
            const mockBlockResponse = {};
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValueOnce(mockBlockResponse)
            });
            await expect(getTrustedBlock('someHash')).rejects.toThrow('Invalid block response format');
        });

        it('should send an error message if fetching fails', async () => {
            (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            await expect(getTrustedBlock('someHash')).rejects.toThrow(/Error fetching trusted block:\s+Network error/);
            expect(sendMessage).toHaveBeenCalledWith('LM_MESSAGE', expect.anything());
        });
    });

    describe('getSwitchBlocksHeights', () => {
        it('should fetch switch block heights starting from a given era', async () => {
            const mockResponse: EraHeight[] = [
                {id: 1, endBlock: 100, validated: false},
                {id: 2, endBlock: 200, validated: false}
            ];
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValueOnce(mockResponse)
            });

            const switchBlockHeights = await getSwitchBlocksHeights(0);
            expect(switchBlockHeights).toEqual([
                {era: 1, block_height: 100, validated: 0},
                {era: 2, block_height: 200, validated: 0}
            ]);
        });

        it('should throw an error if fetching switch blocks fails', async () => {
            (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            await expect(getSwitchBlocksHeights(0)).rejects.toThrow(/Error fetching switch block heights:\s+Network error/);
            expect(sendMessage).toHaveBeenCalledWith('LM_MESSAGE', expect.anything());
        });
    });

    describe('getBlocks', () => {
        it('should fetch blocks based on switch block heights', async () => {
            const switchBlocks: SwitchBlockHeight[] = [
                {era: 1, block_height: 100, validated: 0},
                {era: 2, block_height: 200, validated: 0}
            ];
            const mockBlocks = [
                {header: {height: 100}},
                {header: {height: 200}}
            ];

            (processInBatches as jest.Mock).mockImplementation(async (items, batchSize, delayMs, fn, context) => {
                for (const item of items) {
                    await fn(item, context);
                }
            });

            (fetch as jest.Mock).mockImplementation((url, options) => {
                const requestBody = JSON.parse(options.body);
                const blockHeight = requestBody.params.block_identifier.Height;

                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        result: {
                            block: {header: {height: blockHeight}}
                        }
                    })
                });
            });

            const blocks = await getBlocks(switchBlocks);
            expect(blocks).toEqual(mockBlocks);
        });

        it('should throw an error if fetching blocks fails', async () => {
            (processInBatches as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            await expect(getBlocks([])).rejects.toThrow(/Error fetching blocks:\s+Network error/);
            expect(sendMessage).toHaveBeenCalledWith('LM_MESSAGE', expect.anything());
        });
    });


    describe('fetchBlock', () => {
        it('should fetch a single block', async () => {
            const switchBlock: SwitchBlockHeight = {era: 1, block_height: 100, validated: 0};
            const context: BatchContext = {blocks: [], total_blocks: 1};
            const mockBlockResponse = {
                result: {block: {header: {height: 100}}}
            };
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValueOnce(mockBlockResponse)
            });

            await fetchBlock(switchBlock, context);
            expect(context.blocks).toEqual([mockBlockResponse.result.block]);
        });

        it('should throw an error if fetching the block fails', async () => {
            const switchBlock: SwitchBlockHeight = {era: 1, block_height: 100, validated: 0};
            const context: BatchContext = {blocks: [], total_blocks: 1};

            (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            await expect(fetchBlock(switchBlock, context)).rejects.toThrow(/Error fetching block 100:\s+Network error/);
            expect(sendMessage).toHaveBeenCalledWith('LM_MESSAGE', expect.anything());
        });
    });

    describe('fetchWithRetry', () => {
        it('should retry fetching and succeed', async () => {
            const mockResponse = {ok: true};
            (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
            const response = await fetchWithRetry(
                'url', {
                    jsonrpc: '2.0',
                    method: 'test',
                    params: {block_identifier: {}},
                    id: 1
                }
            );
            expect(response).toBe(mockResponse);
        });
    });
});
