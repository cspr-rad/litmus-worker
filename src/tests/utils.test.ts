import {delay, processInBatches, sendMessage, broadcastState} from '../utils';
import {currentState} from '../service-worker';

declare const self: ServiceWorkerGlobalScope;
jest.mock('../service-worker', () => ({
    currentState: {}
}));

beforeEach(() => {
    const mockClients = [
        {postMessage: jest.fn()},
        {postMessage: jest.fn()}
    ];

    const mockClientsObject = {
        matchAll: jest.fn().mockResolvedValue(mockClients),
        claim: jest.fn(),
        get: jest.fn(),
        openWindow: jest.fn()
    };

    Object.defineProperty(global, 'self', {
        value: {
            clients: mockClientsObject
        },
        writable: true
    });
});

describe('Utils', () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('delay', () => {
        it('should delay for the specified milliseconds', async () => {
            const ms = 200;
            const promise = delay(ms);

            await expect(promise).resolves.toBeUndefined();
        });
    });

    describe('processInBatches', () => {
        it('should process items in batches with delay', async () => {
            const items = [1, 2, 3, 4];
            const batchSize = 2;
            const delayMs = 200;
            const context = {};
            const fn = jest.fn().mockResolvedValue(undefined);

            await processInBatches(items, batchSize, delayMs, fn, context);

            expect(fn).toHaveBeenCalledTimes(items.length);
            items.forEach(item => {
                expect(fn).toHaveBeenCalledWith(item, context);
            });
        });
    });

    describe('sendMessage', () => {
        it('should send a message to all clients', async () => {
            const type = 'TEST_TYPE';
            const message = 'Test message';

            sendMessage(type, message);
            await Promise.resolve();

            expect(self.clients.matchAll).toHaveBeenCalled();
            expect(self.clients.matchAll).toHaveBeenCalledWith();

            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                expect(client.postMessage).toHaveBeenCalledWith({type, message});
            });
        });
    });

    describe('broadcastState', () => {
        it('should broadcast the current state to all clients', async () => {
            const newState = {key: 'value'};
            broadcastState(newState);

            await Promise.resolve();

            expect(currentState).toEqual(newState);
            expect(self.clients.matchAll).toHaveBeenCalled();

            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                expect(client.postMessage).toHaveBeenCalledWith({type: 'UPDATE_STATE', data: currentState});
            });
        });

        it('should broadcast the current state without modifying it if no new state is provided', async () => {
            broadcastState();
            await Promise.resolve();

            expect(self.clients.matchAll).toHaveBeenCalled();

            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                expect(client.postMessage).toHaveBeenCalledWith({type: 'UPDATE_STATE', data: currentState});
            });
        });
    });
});
