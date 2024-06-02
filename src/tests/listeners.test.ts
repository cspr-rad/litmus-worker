import {broadcastState} from '../utils';
import {currentState} from '../service-worker';
import {setListeners} from '../listeners';

declare const self: ServiceWorkerGlobalScope;

const mockServiceWorkerGlobalScope = () => {
    (global as any).self = {
        addEventListener: jest.fn((event, callback) => {
            (self as any)[`on${event}`] = callback;
        }),
        skipWaiting: jest.fn(),
        clients: {claim: jest.fn().mockResolvedValue(undefined)},
        caches: {
            match: jest.fn().mockResolvedValue(null),
        },
    };
};

jest.mock('../utils', () => ({
    broadcastState: jest.fn(),
}));

jest.mock('../service-worker', () => ({
    currentState: {status: 'idle', fetchProgress: 0, validateProgress: 0},
}));

const mockExtendableEvent = (type: string): ExtendableEvent => {
    const event = new Event(type, {bubbles: true, cancelable: true}) as ExtendableEvent;
    (event as any).waitUntil = jest.fn().mockImplementation(promise => promise);
    return event;
};

describe('setListeners', () => {
    beforeEach(() => {
        mockServiceWorkerGlobalScope();
        global.fetch = jest.fn(() => Promise.resolve(new Response('OK')));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should set up install event listener', () => {
        setListeners(jest.fn());
        const installEvent = mockExtendableEvent('install');
        if (typeof self.oninstall === 'function') {
            self.oninstall(installEvent);
        }
        expect(self.skipWaiting).toHaveBeenCalled();
        expect(installEvent.waitUntil).toHaveBeenCalled();
    });

    it('should set up activate event listener', async () => {
        setListeners(jest.fn());
        const activateEvent = mockExtendableEvent('activate');
        if (typeof self.onactivate === 'function') {
            self.onactivate(activateEvent);
        }
        await (activateEvent.waitUntil as jest.Mock).mock.results[0].value;
        expect(self.clients.claim).toHaveBeenCalled();
        expect(broadcastState).toHaveBeenCalledWith(currentState);
    });
});
