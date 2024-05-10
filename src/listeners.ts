import {broadcastState} from "./utils";
import {currentState} from "./service-worker";

declare const self: ServiceWorkerGlobalScope;

export function setListeners(main: any) {
    self.addEventListener('install', (event: ExtendableEvent) => {
        console.log('install');
        event.waitUntil(self.skipWaiting());
    });

    self.addEventListener('activate', (event: ExtendableEvent) => {
        console.log('activate');
        event.waitUntil(
            self.clients.claim().then(() => {
                return broadcastState(currentState);
            })
        );
    });

    self.addEventListener('fetch', (event: FetchEvent) => {
        if (event.request.mode === 'navigate' && event.request.method === 'GET') {
            event.respondWith(
                fetch(event.request)
                    .then(response => {
                        return response;
                    })
                    .catch(async error => {
                        const cachedResponse = await caches.match(event.request);
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        return new Response('Offline', {status: 503, statusText: 'Service Unavailable'});
                    })
            );
        }
    });

    self.addEventListener('message', async (event: ExtendableMessageEvent) => {
        if (event.data.target === 'litmus-worker' && event.data.command === 'startFetching') {
            broadcastState({
                trustedHash: event.data.trusted_block_hash,
                status:'started',
                fetchProgress: 0,
                validateProgress: 0
            });
            await main(event.data.trusted_block_hash);
        }
    });
}
