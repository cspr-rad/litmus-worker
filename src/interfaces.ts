import Dexie from 'dexie';

export interface LitmusDatabase extends Dexie {
    switch_blocks: Dexie.Table<SwitchBlockHeight, number>;
    validator_weights: Dexie.Table<ValidatorWeight, [number, string]>;
}

export interface ValidatorWeight {
    era?: number;
    validator: string;
    weight: string;
}

export interface SwitchBlockHeight {
    era: number;
    block_height: number;
    validated: number; // IndexedDB does not index boolean type, so using number
}

export interface EraHeight {
    id: number;
    endBlock: number;
    validated: boolean;
}

export interface Block {
    header: {
        era_id: number;
        height: number;
        era_end: {
            next_era_validator_weights: ValidatorWeight[]
        }
    }
}

export interface BlockResponse {
    jsonrpc: string;
    id: number;
    result?: {
        block: Block;
    }
}

export interface BatchContext {
    blocks: Block[];
    total_blocks: number;
}

export interface RpcRequest {
    jsonrpc: string;
    id: number;
    method: string;
    params: {
        block_identifier: {
            Hash?: string;
            Height?: number;
        }
    };
}