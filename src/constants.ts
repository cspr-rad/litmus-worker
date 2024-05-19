export const RPC_URL = process.env.RPC_URL || 'https://mainnet.casper-node.xyz/rpc';
export const INDEXER_URL = process.env.INDEXER_URL || 'https://mainnet.cspr.art3mis.net';
export const INDEXER_ERA_LIMIT = parseInt(process.env.INDEXER_ERA_LIMIT ?? '1000', 10);
export const FETCH_BATCH_SIZE = parseInt(process.env.FETCH_BATCH_SIZE ?? '10', 10);
export const FETCH_BATCH_DELAY_MS = parseInt(process.env.FETCH_BATCH_DELAY_MS ?? '1000', 10);
export const FETCH_RETRIES = parseInt(process.env.FETCH_RETRIES ?? '5', 10);
export const FETCH_RETRY_DELAY_MS = parseInt(process.env.FETCH_RETRY_DELAY_MS ?? '1000', 10);
