export const RPC_URL = process.env.RPC_URL || 'https://mainnet.casper-node.xyz/rpc';
export const INDEXER_URL = process.env.INDEXER_URL || 'https://mainnet.cspr.art3mis.net';
export const INDEXER_ERA_LIMIT = parseInt(process.env.INDEXER_ERA_LIMIT, 10) || 1000;
export const FETCH_BATCH_SIZE = parseInt(process.env.FETCH_BATCH_SIZE, 10) || 10;
export const FETCH_BATCH_DELAY_MS = parseInt(process.env.FETCH_BATCH_DELAY_MS, 10) || 1000;
