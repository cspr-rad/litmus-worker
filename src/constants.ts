// RPC nodes. Don't use protocol or '/rpc' path here.
export const RPC_URLS = (process.env.RPC_URLS?.split(',') || [
    '144.76.109.213:7777',
    '195.201.86.100:7777',
    '136.243.7.175:7777',
]);

// Attempt to connect to http RPC nodes from https will result in the mixed content error, so we need to use a proxy.
// Proxy also can set CORS headers. The easiest way to set up a proxy is to use Nginx.
export const RPC_PROXY_URL = process.env.RPC_PROXY_URL ?? 'https://proxy.litmus-demo.app';

// Whe browser is offline it increases the delay between fetches
export const OFFLINE_DELAY_MS = parseInt(process.env.OFFLINE_DELAY_MS ?? '10000', 10);

// The penalty score for RPC nodes when they get banned from the pool.
export const RPC_MAX_SCORE = parseInt(process.env.RPC_MAX_SCORE ?? '10', 10);

// The time in seconds to recover the banned RPC node.
export const RECOVER_BANNED_RPC_SEC = parseInt(process.env.RECOVER_BANNED_RPC_SEC ?? '1000', 10);

// That is an optimisation for the binary search for switch blocks.
export const MAX_BLOCKS_PER_ERA = parseInt(process.env.RPC_MAX_SCORE ?? '500', 10);

// Interval to check for the new block.
export const BLOCK_CHECK_SEC = parseInt(process.env.NEW_SWITCH_CHECK_SEC ?? '2', 10);
