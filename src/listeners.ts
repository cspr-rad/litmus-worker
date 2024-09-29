import { saveAndBroadcast } from './utils';
import { setTrustedBlockHash, syncUpdate } from './service-worker';
import { validateAccount } from './validate-account';
import { getLastSwitchBlock } from './fetch-blocks';
import { getCurrentState } from './db';
import { validateMerkleProof } from './merkle';

declare const self: ServiceWorkerGlobalScope;

export function setListeners() {
    self.addEventListener('install', (event: ExtendableEvent) => {
        console.log('Litmus service worker is installing...');
        event.waitUntil(self.skipWaiting());
    });

    self.addEventListener('activate', (event: ExtendableEvent) => {
        event.waitUntil(self.clients.claim().then(async () => {
            console.log('activate - launching sync event...');
            await (self.registration.sync as SyncManager).register('sync-fetch');
        }));
    });

    self.addEventListener('message', async (event: ExtendableMessageEvent) => {
        if (event.data.target !== 'litmus-worker') {
            return;
        }
        await saveAndBroadcast({
            error: '',
            info: '',
            last_switch_block: null,
            merkle_proof_parsed: null,
            status: 'idle'
        });

        if (event.data.command === 'validateAccount') {
            try {
                await validateAccount(event.data.account, event.data.block);
            } catch (error: unknown) {
                const errorMessage = (error instanceof Error) ? error.message : 'Error validating account.';
                await saveAndBroadcast({ error: errorMessage });
            }
        }
        if (event.data.command === 'getLastSwitchBlock') {
            try {
                await saveAndBroadcast({
                    status: 'searching',
                    last_switch_block: null
                });
                const block = await getLastSwitchBlock();
                await saveAndBroadcast({
                    status: 'idle',
                    last_switch_block: block
                });
            } catch (error: unknown) {
                const errorMessage = (error instanceof Error) ? error.message : 'Error getting last switch block.';
                await saveAndBroadcast({ error: errorMessage, status: 'idle' });
            }
        }
        if (event.data.command === 'setTrustedBlockHash') {
            try {
                await setTrustedBlockHash(event.data.trusted_block_hash);
            } catch (error: unknown) {
                const errorMessage = (error instanceof Error) ? error.message : 'Error setting trusted block hash.';
                await saveAndBroadcast({ error: errorMessage, status: 'idle' });
            }
        }
        if (event.data.command === 'validateMerkle') {
            try {
                const result = await validateMerkleProof(event.data.merkle);
                await saveAndBroadcast({ merkle_proof_parsed: result });
            } catch (error: unknown) {
                const errorMessage = (error instanceof Error) ? error.message : 'Error validating Merkle proof.';
                await saveAndBroadcast({ error: errorMessage, status: 'idle' });
            }
        }
    });

    self.addEventListener('sync', async (event: any) => {
        if (event.tag === 'sync-fetch') {
            try {
                event.waitUntil(syncUpdate());
            } catch (error: unknown) {
                const errorMessage = (error instanceof Error) ? error.message : 'Error in sync fetch routine.';
                await saveAndBroadcast({ error: errorMessage, status: 'idle' });
            }
        }
    });
}
