import {currentState} from "./service-worker";

declare const self: ServiceWorkerGlobalScope;

export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function processInBatches<T>(
    items: T[],
    batchSize: number,
    delayMs: number,
    fn: (item: T, context: any) => Promise<any>,
    context: any
): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map(item => fn(item, context)));
        await delay(delayMs);
    }
}

export function sendMessage(type: string, message?: string|number|object): void {
    self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({
            type: type,
            message: message
        }));
    });
}

export function broadcastState(newState?: any) {
    if (newState) {
        Object.assign(currentState, newState);
    }
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: 'UPDATE_STATE',
                data: currentState
            });
        });
    });
}