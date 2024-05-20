import { getSwitchBlocksHeights, getTrustedBlock, getBlocks } from '../fetch';
import { broadcastState, sendMessage } from '../utils';
import { validateBlocks } from '../validate';
import { findLastValidated, saveSwitchBlocks } from '../db';
import { main } from '../service-worker';

jest.mock('../fetch', () => ({
    getSwitchBlocksHeights: jest.fn(),
    getTrustedBlock: jest.fn(),
    getBlocks: jest.fn(),
}));

jest.mock('../listeners', () => ({
    setListeners: jest.fn(),
}));

jest.mock('../utils', () => ({
    broadcastState: jest.fn(),
    sendMessage: jest.fn(),
}));

jest.mock('../validate', () => ({
    validateBlocks: jest.fn(),
}));

jest.mock('../db', () => ({
    findLastValidated: jest.fn(),
    saveSwitchBlocks: jest.fn(),
}));

describe('main function', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch the starting era from the trusted block and proceed with validation', async () => {
        const trustedBlockHash = 'someTrustedHash';
        const startEra = 1;
        const lastValidated = null;
        const switchBlocks = [{ era: 1, block_height: 1, validated: 1 }];
        const blocks = [{ someBlockData: true }];

        (getTrustedBlock as jest.Mock).mockResolvedValue(startEra);
        (findLastValidated as jest.Mock).mockResolvedValue(lastValidated);
        (getSwitchBlocksHeights as jest.Mock).mockResolvedValue(switchBlocks);
        (getBlocks as jest.Mock).mockResolvedValue(blocks);
        (validateBlocks as jest.Mock).mockResolvedValue(undefined);

        await main(trustedBlockHash);

        expect(getTrustedBlock).toHaveBeenCalledWith(trustedBlockHash);
        expect(findLastValidated).toHaveBeenCalledWith(startEra);
        expect(getSwitchBlocksHeights).toHaveBeenCalledWith(startEra);
        expect(saveSwitchBlocks).toHaveBeenCalledWith(switchBlocks);
        expect(getBlocks).toHaveBeenCalledWith(switchBlocks);
        expect(validateBlocks).toHaveBeenCalledWith(blocks);
        expect(broadcastState).toHaveBeenCalledWith({ status: 'processing' });
        expect(broadcastState).toHaveBeenCalledWith({ status: 'completed' });
        expect(sendMessage).toHaveBeenCalledWith('LM_MESSAGE', { type: 'info', text: 'Validation completed' });
    });

    it('should handle error when fetching the trusted block', async () => {
        const trustedBlockHash = 'someTrustedHash';
        const error = new Error("Can't get switch block height from specified hash");
        (getTrustedBlock as jest.Mock).mockRejectedValue(error);

        await expect(main(trustedBlockHash)).rejects.toThrow(error.message);

        expect(sendMessage).toHaveBeenCalledWith('LM_MESSAGE', {
            type: 'error',
            text: "Can't get switch block height from specified hash"
        });
    });

    it('should log "No new switch blocks to validate" if no new blocks', async () => {
        const trustedBlockHash = 'someTrustedHash';
        const startEra = 1;

        (getTrustedBlock as jest.Mock).mockResolvedValue(startEra);
        (findLastValidated as jest.Mock).mockResolvedValue(null);
        (getSwitchBlocksHeights as jest.Mock).mockResolvedValue([]);

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        await main(trustedBlockHash);

        expect(consoleSpy).toHaveBeenCalledWith('No new switch blocks to validate.');
        consoleSpy.mockRestore();
    });
});
