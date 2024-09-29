interface ServiceWorkerRegistration {
    readonly sync: SyncManager;
}

interface SyncManager {
    register(tag: string): Promise<void>;
}
